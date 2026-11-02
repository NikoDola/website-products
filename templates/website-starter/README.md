# Independent client website

Run `npm install`, then `npm run dev`. Edit `src/content/site.json`, project CSS
in `src/styles/`, page sections in `src/app/`, and served images in `public/`.
Run `npm run build` before deployment. Give this site its own hosting project,
domain, credentials and content storage. Confirm the public URL and contacts.

This is a clean file-content starter. It does not include Breeze's visual CMS,
credentials, customer copy, storage or deployment identity. If the client needs a
visual CMS, implement that site's content schema and provision separate D1/R2
resources before enabling the capability in `site.config.json`.

Add the website in the agency admin; monitoring works with any approved public
HTTPS site. A CMS status URL is optional and must implement the version-1 read-only
contract documented in the main workspace's `docs/SETUP.md`.
