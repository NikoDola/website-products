# Homepage Lighthouse audit — 2 November 2026

## Latest result: local SEO correction

The public homepage's unnecessary noindex metadata/header have been removed.
Fresh **local SEO-only Lighthouse runs score 100 for both [English](seo-local-en.html)
and [Macedonian](seo-local-mk.html)**, with the indexing check passing and no run
warnings. No audits were skipped or their results altered. Canonical configuration
still depends on the final domain, and structured data still needs manual review.

Local Lighthouse testing does not require publication or a noindex rule. Public
pages now use `index, follow`; admin/API/contact responses retain noindex and the
owner authentication gate. The production build/typecheck and HTTP checks passed.
The existing port-3001 process was identified as `next start`, still serving an
older build. It was restarted with the same command, and all three homepage
routes returned the corrected settings. After the owner reported the admin
sign-in gate, port 3001 was restored to `npm run dev`: production mode deliberately
disables the local-admin shortcut. Both admin hostnames and their read-only API
were verified successfully, and the homepage indexing correction remains.
No site was published. The reports below preserve the earlier full-audit measurements.

## Earlier full audit, before the indexing correction

The optimized Next.js production build was tested on an isolated local server
with Lighthouse 12.8.2 and a fresh headless Chrome profile. The development server
on port 3001 was left running. These are lab measurements, not field data or a
guarantee that every accessibility concern has been found.

| Page / device | Performance | Accessibility | Best practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| [English mobile](mobile-en.html) | 94 | 100 | 100 | 63 |
| [English desktop](desktop-en.html) | 99 | 100 | 100 | 63 |
| [Macedonian mobile](mobile-mk.html) | 94 | 100 | 100 | 63 |

The earlier SEO score of 63 came from the failed `is-crawlable` check: the preview
served both a `noindex, nofollow` meta tag and X-Robots-Tag header. That block was
unnecessary for local auditing and is now resolved, as the newer reports show.

The first English mobile audit scored 80 performance, 97 accessibility, 100 best
practices and 63 SEO. Fixes included self-hosted fonts without visitor requests to
Google, responsive hero/portfolio images, stronger text contrast, readable small
labels and an accessible name for the decorative Breeze preview. The final mobile
English LCP was 2.9s, TBT 50ms and CLS 0.068; desktop LCP 0.9s, TBT 0ms and CLS 0.

Lighthouse still lists optional loading opportunities, including CSS blocking,
Next.js framework JavaScript/polyfills and some image sizing. The local preview's
private/no-store policy also prevents back/forward caching. These were not hidden
or disabled to improve the scores. Public hosting and device conditions can
produce different performance scores.

TypeScript, the production build and all 57 shared tests passed.

Separate axe WCAG 2 A/AA and 2.1 A/AA checks found zero violations on either
language page. Browser checks covered scrolling, the seamless rightward loop,
hover/touch/keyboard and button pause controls, readable review labels, absent
notice/checkbox, no external font requests, responsive layouts and intercepted
form submission without consent. No test inquiry reached the real inbox.

The review loop now takes 90 seconds (150 with reduced motion). Individual
sample-review labels remain; the long section notice is removed. New inquiries
do not require a checkbox or record a fictional consent timestamp. Existing
inquiry records remain intact. No publication was performed.
