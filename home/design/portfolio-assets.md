# Portfolio thumbnail sources

Added 1 November 2026 from the owner's projects in
`C:/Users/Dolov/Desktop/Junk code`. The project folders were read only; no source
projects, configuration or deployments were changed.

Thumbnails are local WebP assets in `public/home/portfolio/`, compressed at
quality 88 and resized to at most 1200 pixels wide without enlarging originals.
They load without depending on external screenshot services. The screenshots are
saved project snapshots; the artwork is representative imagery, not a new live
browser screenshot.

| Project | Source within Junk code | Kind | Output |
| --- | --- | --- | --- |
| GMunchies Vending | `gmunchies/public/uploads/hero.webp` | Website hero artwork | `gmunchies.webp`, 1200 × 800 |
| Emilija Petrova | `emilija-petrova/public/images/ai-screenshots/1-hero.avif` | Existing homepage screenshot | `emilija-petrova.webp`, 801 × 539 |
| T. Hendo — Dreamstation | `hendo/public/hendo-og.jpg` | Public website social/artist artwork | `hendo.webp`, 1024 × 682 |
| Indoor Plants | `indoor-plants/section-images/section-1.png` | Existing booklet-cover screenshot | `indoor-plants.webp`, 1038 × 734 |

The four new project thumbnails total approximately 335 KB. Screenshots use
`object-fit: contain` so text and booklet attribution are retained. Photographic
artwork fills the thumbnail frame. Original asset files remain in their source
projects. Breeze retains its existing illustrative homepage preview and link.

The owner supplied these exact destination URLs:

- `http://emilijapetrova.com/`
- `https://gmunchiesvending.com/`
- `https://www.thelegendofhendo.com/`
- `https://nikodola.github.io/indoor-plants/`

Public project records and English/Macedonian summaries live in
`src/website/portfolio.mjs`. Summaries were checked against the local
page code and project documentation. The same records hold sample review drafts
for all five projects. They are visibly labelled as drafts, with no star ratings,
invented reviewers or claims of approval. Replace them only with approved wording.
