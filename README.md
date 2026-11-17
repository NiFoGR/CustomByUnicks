# UNICKS: Luxury Bathrooms

Static site for **UNICKS** (`@custombyunicks`). Plain HTML/CSS/JS, no build step.

```
index.html                  home: hero, the three services, why us, work, how it works, packages, survey form
installations.html          service 1, price builder: 1 package, 2 extras, 3 book a survey
design.html                 service 2, 3D designer: build the room, see the price, send the design
shop.html                   service 3, shop: floating seats and shelves, pedestal basins, brand fittings (to be stocked soon)
packages.html               old address, forwards to installations.html (keeps shared links working)
privacy.html                privacy notice (needed because the forms collect personal details)
404.html                    page-not-found (uses root links, works on the real domain)
DESIGN.md                   the locked design rules: colours, type, spacing, motion, words
assets/js/packages-data.js  packages, extras and prices for installations.html
assets/js/studio-data.js    options and prices for the 3D designer
assets/js/main.js           header, menu, slides, work rail, price builder, forms
assets/js/studio.js         3D designer: options panel, price, link, save image
assets/js/studio-scene.js   3D designer: the room itself (three.js)
assets/css/style.css        all styles, colours and fonts set in :root at the top
assets/vendor/three/        three.js r160 (MIT), served from the site
assets/tex/                 stone and wood textures for the 3D room (CC0, ambientCG)
assets/fonts/               Cormorant Garamond and Jost, served from the site (no Google requests)
assets/img/                 photos (.jpg plus smaller .webp copies), logo mark, icons, share image
robots.txt, sitemap.xml     for search engines
```

Run locally: `python3 -m http.server 8000`, open http://localhost:8000.

---

## Installation packages and prices

Everything on the installations page is generated from `assets/js/packages-data.js`.
The comment at the top of that file explains the format. In short:

- `price: 950` costs the same on every package.
- `price: { a: 950, b: 0, c: 0 }` varies per package. `0` shows as **Included**
  (pre-ticked and locked), `null` hides the option on that package.
- `type: 'single'` groups are pick-one (first option is the default);
  `type: 'multi'` groups are tick-any.

**All current prices are placeholders.** Replace them before going live.

A customer's build is kept in the URL (`installations.html?p=b&finish=dark&o=bench,rain`),
so it can be shared, and the full list plus that link are sent with the enquiry.

## The 3D designer (design.html)

The customer builds their room and sees it drawn live in the browser with
three.js. What they can set:

- **Room:** width and length, walk-in shower or shower and bath.
- **Stone:** walls, a different stone inside the shower if they want one,
  floor, and how the floor is laid (large, staggered or square).
- **Vanity:** metal finish, wood or stone, flat or fluted front, basin
  (trough, round bowl or double trough) and mirror shape.
- **Shower:** slim-framed, frameless or fluted glass, bench, rain shower.
- **Lighting:** five LED options and warm or neutral white.
- **Extras:** star inlay, floor border, towel rail, underfloor heating.

How it behaves:

- Every choice is a picture card showing what it looks like. The pictures
  are photographs of the 3D room itself (`assets/img/opt/`).
- Changing something rebuilds only that part, instantly. Stone and metal
  cross-fade in a quarter of a second; nothing else animates but the camera.
- Drag to orbit, scroll or pinch to zoom, or jump to the vanity, shower, bath
  or a plan view. Inside the room you can look up at the ceiling. Evening
  light dims the room so the LEDs show.
- Click anything in the room to open its options. Hovering names it.
- Copy a link, save a picture, or send the design with the form.
- On a slow machine it turns off the soft-shadow pass, then lowers the
  resolution, so it stays smooth.

For whoever maintains it:

- **Prices and wording:** `assets/js/studio-data.js` (the comment at the top
  explains the formula). All prices are placeholders.
- **What you receive:** the enquiry includes the full list (room size, layout,
  every finish and option, guide price) and a link that reopens the exact room.
  Links made before an option existed still open, with the plain version of it.
- **No 3D?** On a device without WebGL the page shows a still image and every
  option, price and the form still work.
- **Real models later:** each fitting is a function in `studio-scene.js`
  (`vanityPart`, `toiletPart`, `bathPart`...). A model made in Blender can
  replace one: export it as `.glb` and load it with three.js's GLTFLoader in
  that function.
- **Stone textures:** `assets/tex/<stone>-2k.webp` (desktop), `-1k.webp`
  (phones) and `-sw.webp` (the swatch). To add a stone, add the three files and
  a line in `studio-data.js`.
- **Still images:** `assets/img/studio-poster*.webp` (shown dimmed while the 3D
  loads) and `assets/img/studio-door*` (homepage) are renders of the default
  room. Re-shoot them if the default look changes.
- **Option pictures:** `assets/img/opt/` holds one 640 x 480 render per
  designer option, taken from the 3D room. The packages and extras on the
  installations page use crops of the project photos instead
  (`assets/img/pick/`, 800 x 600 for packages and 640 x 480 for extras). Each
  names its picture with `img` in `packages-data.js`.

## The shop (shop.html): plan for going live

The page shows what is coming, marked "To be stocked soon": floating stone
seats and shelves (straight, corner, rectangular) and round pedestal basins
made in the workshop, plus taps, rails and lighting from supplier brands.
Its pictures are crops of his own project photos and a render from the 3D
designer (`assets/img/shop-*.webp`).

GitHub Pages cannot take payments, so a real checkout needs a hosted store
linked from this page or embedded in it (Shopify Buy Button, or Stripe
Payment Links). Indicative UK costs, November 2026 (get quotes before
committing):

- **Shopify Basic:** about £19 a month billed yearly, £25 monthly; online card
  payments about 2% + 25p.
- **Klarna Pay in 3:** the shop pays, not the customer. Reported at roughly
  5% to 6% plus 20p to 35p per order; Klarna does not publish a standard rate.
  UK pay-later products became FCA regulated on 15 July 2026, and Klarna
  handles the wording.
- **PayPal:** a fixed 30p per commercial payment plus a percentage; check
  PayPal's UK merchant fees page for the current rate and for Pay in 3.

## Connect the forms

GitHub Pages cannot process forms, so use a free form service. At the top of
`assets/js/main.js`:

```js
var FORM_ENDPOINT = '';   // e.g. https://formspree.io/f/xxxx  (preferred)
var CONTACT_EMAIL = '';   // mailto fallback only
```

Formspree (50/month free) or Web3Forms (250/month free) both work as-is.

Every enquiry includes **How did you find us?** (Google, Instagram, Facebook,
recommended, other), so you can see which channel brings in work. Enquiries from
the installations page and the 3D designer also include every choice and the
guide price, plus a link that reopens the exact same choice.

## Placeholders

Unknowns are shown with a gold dashed underline: search the HTML for `class="ph"`
(phone, email, areas, reply time, build time, company number, and the gaps in
`privacy.html`).

## Checks run before release

- W3C Nu HTML checker: 0 errors on every page, including the HTML the scripts build
- axe accessibility audit (WCAG 2.1 AA): 0 violations
- Chromium at 1440px and 390px: no console errors, no broken links or images,
  no sideways scrolling, every in-page link lands on its section

---

## Hosting: GitHub Pages + Cloudflare, two domains

Both domains are registered at Namecheap. **unicks.co.uk** is the real site.
**unicksbathrooms.co.uk** permanently redirects to it. GitHub Pages only serves
one custom domain per repo, and one main address is better for Google anyway.
The `CNAME` file in this repo already says `unicks.co.uk`.

### 1. GitHub Pages
Repo **Settings → Pages** → Source: *Deploy from a branch* → pick the branch
that holds the finished site (this one, or `main` once it's merged there),
folder `/ (root)`. Pages on a private repo needs a paid GitHub plan; public is free.

### 2. Move both domains to Cloudflare (free plan)
1. In Cloudflare: **Add a site** → `unicks.co.uk` → Free. Cloudflare shows two
   nameservers (something like `ada.ns.cloudflare.com`, `bob.ns.cloudflare.com`).
2. In Namecheap: **Domain List → Manage** (unicks.co.uk) → **Nameservers** →
   *Custom DNS* → paste Cloudflare's two nameservers → save (green tick).
3. Repeat both steps for `unicksbathrooms.co.uk`.
4. Wait until Cloudflare marks each domain **Active** (usually under an hour,
   can take up to a day).

### 3. unicks.co.uk records in Cloudflare
DNS, all **DNS only (grey cloud)** to start:

| Type | Name | Content |
|---|---|---|
| A | `@` | 185.199.108.153 |
| A | `@` | 185.199.109.153 |
| A | `@` | 185.199.110.153 |
| A | `@` | 185.199.111.153 |
| CNAME | `www` | `nifogr.github.io` |

Delete any other A, AAAA or CNAME records Cloudflare copied over from
Namecheap's parking page.

Then in GitHub **Settings → Pages → Custom domain**: `unicks.co.uk`. Wait for
the DNS check to pass, then tick **Enforce HTTPS** once the certificate is
issued (it can take a few minutes after the check passes). Optional,
afterwards: turn the orange cloud on and set Cloudflare **SSL/TLS → Full**.
Never use "Flexible": it causes a redirect loop.

### 4. unicksbathrooms.co.uk → unicks.co.uk
1. DNS: `A @ 192.0.2.1` and `CNAME www unicksbathrooms.co.uk`, both
   **proxied (orange)**. The IP is a placeholder; Cloudflare answers before it
   is ever reached.
2. **Rules → Redirect Rules → Create rule** → *All incoming requests* →
   URL redirect, *Dynamic*, expression
   `concat("https://unicks.co.uk", http.request.uri.path)`, status **301**,
   tick *Preserve query string*.

### 5. Check it
- `https://unicks.co.uk` and `https://www.unicks.co.uk` open the site with a padlock.
- `https://unicksbathrooms.co.uk/design.html` lands on `https://unicks.co.uk/design.html`.
- `https://unicks.co.uk/anything` shows the UNICKS 404 page.

### 6. Google
Add `unicks.co.uk` in Google Search Console (submit `sitemap.xml`) and in
Google Business Profile. The canonical tags already point there.

## Photos

The newest rooms (`project-star-*.jpg`, `project-cloakroom.jpg`) are full
resolution. The older ones are Instagram screenshots; swap in originals when
available, same filenames. After replacing a photo, regenerate its `-640.webp`
and `-1080.webp` copies (any image tool, quality around 80).
