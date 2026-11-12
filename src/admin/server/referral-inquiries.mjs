import { existsSync } from 'node:fs';
import { openInbox, inboxPath } from '../../shared/home-contact.mjs';
import { PlatformError } from '../../shared/entities.mjs';

export function referralInquiries(env = process.env) {
  const path = inboxPath(env);
  if (!existsSync(path)) return [];
  const inbox = openInbox(path);
  try { return inbox.list().filter(row => row.referral_partner_id).map(({ id, created_at, name, email, service, message, referral_code, referral_partner_id, referral_name }) => ({ id, created_at, name, email, service, message, referral_code, referral_partner_id, referral_name })); }
  finally { inbox.close(); }
}
export function verifyReferralInquiry(id, partnerId, env = process.env) {
  if (!id) return;
  if (!referralInquiries(env).some(row => row.id === id && row.referral_partner_id === partnerId)) throw new PlatformError('This enquiry does not belong to the selected referral partner. Refresh and try again.', 409);
}
