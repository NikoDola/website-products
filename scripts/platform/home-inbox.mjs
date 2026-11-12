import { existsSync } from 'node:fs';
import { openInbox, inboxPath } from '../../src/shared/home-contact.mjs';

const path = inboxPath();
if (!existsSync(path)) console.log('No enquiries have been received yet.');
else {
  const inbox = openInbox(path);
  try {
    const rows = inbox.list();
    if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
    else {
      console.log(`${rows.length} enquiries in the private website inbox.\n`);
      for (const row of rows) console.log(`${row.created_at} | ${row.name} <${row.email}>\n${row.service} (${row.locale})${row.referral_code ? `\nReferral: ${row.referral_name} | ${row.referral_code}` : ''}\n${row.message}\n`);
    }
  } finally { inbox.close(); }
}
