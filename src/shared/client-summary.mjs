export function monthlyPricing(services) {
  const months = { monthly: 1, quarterly: 3, yearly: 12 }, totals = new Map();
  for (const service of services) {
    if (service.status !== "active" || !months[service.cadence]) continue;
    totals.set(service.currency, (totals.get(service.currency) || 0) + service.amount / months[service.cadence]);
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount }));
}

export function stripeSchedule(subscription) {
  const status = subscription.status || "unknown";
  const none = note => ({ status, nextPaymentAt: null, note });
  if (!["active", "trialing"].includes(status)) return none(status === "past_due" ? "Payment overdue; check the invoice in Stripe" : `Subscription ${status.replaceAll("_", " ")}`);
  if (subscription.pause_collection) return none("Payment collection paused");
  if (subscription.collection_method !== "charge_automatically") return none("Paid by invoice; no automatic charge date");
  if (subscription.items?.has_more) return none("Full subscription schedule is not available");
  const ends = (subscription.items?.data || []).map(item => item.current_period_end).filter(value => Number.isFinite(value) && value > 0);
  const next = status === "trialing" && subscription.trial_end ? subscription.trial_end : ends.length ? Math.min(...ends) : subscription.current_period_end;
  if (subscription.cancel_at_period_end || next && subscription.cancel_at && subscription.cancel_at <= next) return none("Cancels before the next renewal");
  const at = new Date(next * 1000);
  if (!next || !Number.isFinite(at.getTime())) return none("Next payment date is not available");
  return { status, nextPaymentAt: at.toISOString(), note: status === "trialing" ? "Expected when the trial ends" : "Expected at the next billing cycle" };
}
