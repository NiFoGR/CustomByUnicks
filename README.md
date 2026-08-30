# Unick's: Premium Bathroom Design & Installation

Marketing site for **Unick's** (`@custombyunicks`), a UK bathroom design-and-build
company. Static HTML/CSS/JS, with no build step, no dependencies and no framework.

Positioned as a portfolio-led site with a **free design consultation** as the primary
call to action, following the pattern used by the leading UK firms in this trade
(Hugo Oliver, The London Bath Co., North Arch, Ripples, West One).

---

## Run it locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Or just open `index.html` in a browser.

## Deploy

**GitHub Pages**: Settings → Pages → deploy from branch, root folder.
(`.nojekyll` is committed so the `assets/` folder is served as-is.)

**Netlify / Vercel / Cloudflare Pages**: drag the folder in, or connect the repo.
No build command, publish directory is the repo root.

---

## Before it goes live

### 1. Connect the enquiry form

The form currently validates but has nowhere to send to. Open
`assets/js/main.js` and fill in **one** of the two values at the top:

```js
var FORM_ENDPOINT = '';   // e.g. 'https://formspree.io/f/xxxxxxx'
var CONTACT_EMAIL = '';   // e.g. 'hello@custombyunicks.co.uk'
```

- `FORM_ENDPOINT`: a form service URL (Formspree, Basin, Getform, Netlify Forms).
  Enquiries are POSTed there and the visitor stays on the page. **Preferred.**
- `CONTACT_EMAIL`: fallback only. Opens the visitor's own email client, which
  loses a meaningful share of enquiries. Use it as a stopgap.

A honeypot field is already in place, so form spam should be minimal.

### 2. Replace the placeholders

Anything still unknown is marked in the page with a gold dashed underline, so it is
obvious in the browser. Search the source for `class="ph"` to find them all:

| Placeholder | Where |
|---|---|
| `[Add your number]`, `[Add your email]` | Contact block + footer |
| `[Add your areas]`, `[list your core areas]` | Contact block + FAQ |
| `[X]`-year / `[X years]` guarantee | Trust strip + FAQ |
| `[2–4 weeks]` typical build time | Process + FAQ |
| `[£X,XXX]` starting price | FAQ |
| `[24 hours]` response time | Consultation block |
| `[Add your registration details…]` | FAQ, Part P / NICEIC / Gas Safe numbers |
| `[Company no.]`, `[VAT no.]` | Footer |
| Testimonials ×3 | Reviews section |

**The three testimonials are deliberately empty.** They are structural placeholders,
not draft copy. Do not publish invented reviews. Ask past clients for one at
handover, which is when they are most willing to write it.

### 3. Set the real domain

`index.html` references `https://custombyunicks.co.uk/` in the canonical tag and
the structured data. Update both if the domain differs.

---

## Photography

The images in `assets/img/` were extracted from the company's own Instagram posts
and story highlights, cropped to remove the Instagram interface and nothing else.
They are placeholders in the sense that they are screenshot-resolution.

**Replace them with the original full-resolution files** when available. The three
small square tiles (`grid-*.jpg`) come from profile-grid thumbnails and are the
lowest quality of the set, so they are sized small on purpose.

Filenames map to the layout, so swapping a file is enough:

| File | Used for |
|---|---|
| `project-onyx-wetroom.jpg` | Hero background, "Dark" panel, portfolio |
| `project-stone-ensuite.jpg` | "Light" panel, portfolio |
| `project-brass-suite.jpg` | About section, portfolio |
| `detail-brassware.jpg` | Quote band, portfolio |
| `grid-*.jpg` | Small portfolio tiles |
| `logo-avatar.jpg` | Header, footer, favicon |
| `brand-mark.jpg` | Unused. The gold "US" monogram, kept for future use |

### Adding a project

Copy any `<figure class="tile …">` block in the `#grid` section and change the
image, title and `data-cat`. Valid categories: `dark`, `light`, `detail`. They
drive the filter buttons, so a new category needs a matching button adding.

Use `tile--lg` for full-resolution photos and `tile--sm` for lower-resolution ones.

---

## Structure

```
index.html              # the whole page
assets/css/style.css    # all styles; design tokens in :root at the top
assets/js/main.js       # nav, filters, accordion, reveals, form
assets/img/             # photography
```

Sections in order: hero → trust strip → about → services → dark/light →
portfolio → process → quote band → testimonials → FAQ → consultation form → footer.

## Motion

The feel of the site is deliberate, and lives in `assets/js/main.js` (sections 1–7)
plus the `MOTION LAYER` block at the end of `style.css`.

- **Damped scrolling.** Wheel input is captured and eased toward a target
  (`window.scrollTo` each frame), so scrolling has weight instead of stepping.
  Native scrollbar, keyboard, anchors and IntersectionObserver all still work
  because real scroll position still moves. Desktop pointers only; touch already
  has its own momentum.
- **Parallax.** The hero image drifts at 0.2× scroll with a slow entrance scale;
  the about image and quote band drift against their sections. Both have extra
  image height so the drift never exposes an edge. If you change a parallax
  amount, check the matching `height`/`top` in CSS.
- **Curtain reveals.** `data-rv="mask"` wipes a curtain off the image while the
  image settles back from a 1.18 over-scale. This deliberately does *not* use
  `clip-path` on the observed element: Chromium factors an element's own
  `clip-path` into its IntersectionObserver rect, so a fully clipped box reports
  zero intersection and never reveals.
- **Word-rise headings.** `data-split` wraps each word in a clipping span so it
  rises from behind its own baseline, staggered left to right. Nested markup
  (`<em>`, `<span>`) is preserved.
- **Stagger.** Siblings in a group get an increasing `--i`, which feeds
  `transition-delay`, so rows cascade rather than landing together.
- **Surface.** A fine animated grain and a vignette sit over everything at very
  low opacity; they are what stop a flat dark page reading as flat.
- **Intro.** Brand mark and a loading bar, once per session (`sessionStorage`),
  handing off to the hero choreography.

Tuning: easing tokens (`--e-expo`, `--e-quart`) and durations (`--d-slow`,
`--d-mid`) are at the top of the motion layer. Slower and further = heavier.

## Notes

- Responsive down to 320px; breakpoints at 1080 / 900 / 620px.
- Respects `prefers-reduced-motion`. The entire motion layer disables itself:
  no intro, no grain, no cursor, no damped scroll, everything visible immediately.
- Fonts load from Google Fonts, with a system serif/sans fallback stack.
- Includes `HomeAndConstructionBusiness` structured data for search results,
  worth extending with the real address and phone once known, since local search
  drives most enquiries in this trade.
