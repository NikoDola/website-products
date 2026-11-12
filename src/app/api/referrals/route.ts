import 'server-only';
import { owner, AccessError, verifyMutation } from '@/admin/server/auth';
import { openReferrals } from '@/admin/server/referral-store.mjs';
import { referralOrigin, referralSvg } from '@/admin/server/referral-assets.mjs';
import { referralInquiries, verifyReferralInquiry } from '@/admin/server/referral-inquiries.mjs';
import { PlatformError } from '@/shared/entities.mjs';
import { readLimited } from '@/shared/security.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
function failure(error: unknown) {
  const known = error instanceof AccessError || error instanceof PlatformError;
  return Response.json({ error: known ? error.message : 'Referral records could not be loaded or saved. Check storage and try again.' }, { status: known ? error.status : 503, headers });
}
export async function GET(request: Request) {
  let store: ReturnType<typeof openReferrals> | undefined;
  try {
    await owner(); store = openReferrals();
    const query = new URL(request.url).searchParams;
    if (query.get('download') === 'backup') return Response.json({ ...store.backup(), inquiries: referralInquiries() }, { headers: { ...headers, 'Content-Disposition': 'attachment; filename="referral-program-backup.json"' } });
    if (query.has('asset')) {
      const partner = store.partner(query.get('partner')), { origin } = referralOrigin(request);
      if (!['qr', 'flyer'].includes(query.get('asset') || '')) throw new PlatformError('Choose a QR card or flyer.');
      const svg = await referralSvg(partner, origin, query.get('asset') === 'flyer');
      return new Response(svg, { headers: { ...headers, 'Content-Type': 'image/svg+xml; charset=utf-8', 'Content-Disposition': `${query.get('download') === '1' ? 'attachment' : 'inline'}; filename="${partner.code}-${query.get('asset')}.svg"`, 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" } });
    }
    let website: { origin: string; local: boolean } | { error: string };
    try { website = referralOrigin(request); } catch { website = { error: 'Set HOME_PUBLIC_ORIGIN to your public HTTPS website address to enable QR downloads.' }; }
    return Response.json({ ...store.snapshot(), inquiries: referralInquiries(), website }, { headers });
  } catch (error) { return failure(error); } finally { store?.close(); }
}
export async function POST(request: Request) {
  let store: ReturnType<typeof openReferrals> | undefined;
  try {
    const actor = await owner(); verifyMutation(request);
    let input;
    try { input = JSON.parse(await readLimited(request, 32 * 1024)); } catch (error) { if (error instanceof PlatformError) throw error; throw new PlatformError('Invalid JSON request.'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PlatformError('Invalid referral request.');
    store = openReferrals(); let result;
    switch (input.action) {
      case 'partner.save': result = store.savePartner(input, actor.email); break;
      case 'commission.add': verifyReferralInquiry(input.record?.inquiry_id, input.partner_id); result = store.addCommission(input, actor.email); break;
      case 'commission.settle': result = store.settle(input, actor.email); break;
      default: throw new PlatformError('Choose a valid referral action.');
    }
    return Response.json({ result }, { headers });
  } catch (error) { return failure(error); } finally { store?.close(); }
}
