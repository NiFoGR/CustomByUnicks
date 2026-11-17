# UNICKS design rules: "Lit stone"

One theme, used everywhere: the website, the 3D designer, social images.
It comes from his rooms: dark ground, real stone, brushed brass, and hidden
LED lines that make the stone glow. If something new doesn't fit these rules,
change the new thing, not the rules.

## 1. Colour

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0b0a09` | page background |
| `--ink-2` | `#100f0d` | alternate sections, side panels |
| `--surface` | `#161411` | cards, inputs, options |
| `--surface-2` | `#1d1a16` | raised surface (rare) |
| `--gold` | `#c6a15b` | the accent: labels, prices, chosen state, one solid button |
| `--gold-lt` | `#e2c792` | LED lines and hover on gold |
| `--text` | `#efebe4` | headings and body text |
| `--muted` | `#aaa398` | secondary text |
| `--muted-2` | `#878076` | small print, notes |
| `--line` | gold at 24% | lines that matter (chosen card, summary box) |
| `--line-soft` | ivory at 8% | structure lines (section borders, card edges) |

- Gold is never a background for text blocks. One solid gold button per view.
- No other accent colours. Error red (`#c9786a`) appears only on form errors.
- No white backgrounds. Light comes from photos and the 3D room, not from the page.

## 2. Type

- **Cormorant Garamond 400**, uppercase, for `h1` and `h2`. Sentence case for `h3`.
- **Jost 300** for body text at 16.5px / 1.7.
- Labels: Jost 400 to 500, 0.6 to 0.74rem, uppercase, letter-spacing 0.16 to 0.32em.
- Prices and big numbers: Cormorant, lining tabular figures.
- Both fonts are served from the site. No Google Fonts requests.

## 3. Shape and line

- Square corners on everything. The only circles are small controls
  (step numbers, rail arrows, the light switch).
- 1px hairlines only. Never thicker borders.
- The one ornament is the four-point star from the logo, used small:
  eyebrows and list bullets only.
- The "LED line": 1px of `--gold-lt` with a soft glow. Used for the lit edge of
  a chosen or featured card, the seam beside the hero photo, the opening
  animation and the loading line in the 3D designer. Once per component.

## 4. Space and layout

- Content width 1200px with side gutters `clamp(20px, 5vw, 56px)`.
- One spacing scale, set in `:root`: `--section` (above and below every
  section, builder steps included), `--head-gap` (heading block to its
  content) and `--lede-gap` (heading to the paragraph under it). Use these,
  never one-off numbers.
- Gaps between options and swatches: 8 to 10px. Between cards: 22 to 24px.
- Inner padding of cards: `clamp(26px, 3vw, 38px)`; of panels: 22 to 28px.
- Everything lines up on the same left edge inside `.wrap`. Centre only
  page headings, FAQs and short calls to action.

## 5. Components (reuse, don't reinvent)

- `.btn` outline, `.btn--solid` gold. `.link` for text links with an arrow.
- `.eyebrow` star plus label above every heading.
- `.opt` tick or radio row with name, note and price (both builders).
- `.sw` swatch with a 48px square sample (3D designer).
- `.tier` package card. `.summary` / `.studio__foot` price box with an LED top edge.
- `.field` form fields, `.faq` details list, `.next` numbered list.

## 6. Motion

- Easing `cubic-bezier(.16,1,.3,1)`. Reveals 1 to 1.4s, staggered by 90ms.
- Text rises out of a mask, photos uncover from the bottom, the camera in the
  3D designer glides. Nothing bounces, flashes or spins quickly.
- Hover effects only on devices with a mouse. Everything switches off for
  `prefers-reduced-motion`.

## 7. Photography and 3D

- Warm, low light, lit by the room's own LEDs. Real rooms only, no stock.
- The 3D room sits on black like an architectural model, cut open towards
  the viewer, with a fine gold line on the cut walls and gold dimension lines.
- Light in 3D is warm white (about 2700K). Evening light dims the ceiling and
  lets the LED strips carry the room.
- Stone textures are CC0 scans from ambientCG (see `assets/tex/`).
- In 3D, changes happen instantly. Finishes cross-fade quickly; only the
  camera moves smoothly. Surfaces that touch are always set a few millimetres
  apart, and the wall core stands back from niche openings, so nothing
  flickers.
- In the 3D designer, every choice is a picture card (4:3) rendered from the
  3D room in the same light, so the options read as one set.
- Package cards and the extras on the installations page use crops of his
  own room photos (`assets/img/pick/`), never 3D renders.

## 8. Words

- Plain British English, written to the customer ("you"), short sentences.
  Say it in as few words as possible.
- One thing to do per section. Prices shown early. No jargon.
- No em dashes, no colons in sentences, no middle dots between words, no slogans, no lists of three
  used for rhythm, no "elevate", "seamless", "unparalleled" and the like.
- Unknown facts stay as visible placeholders (`class="ph"`) until confirmed.
