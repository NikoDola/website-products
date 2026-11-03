export async function outreachPost(body: Record<string, any>) {
  const response = await fetch("/api/outreach", { method: "POST", headers: { "Content-Type": "application/json", "x-platform-request": "admin" }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "The outreach request could not complete.");
  return payload.result ?? payload;
}
