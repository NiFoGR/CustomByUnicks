# UNICKS: Luxury Bathrooms

Static site for **UNICKS** (`@custombyunicks`). Plain HTML/CSS/JS, no build step.

```
index.html                  home: hero, the three services, why us, work, how it works, packages, survey form
installations.html          service 1, price builder: 1 package, 2 extras, 3 book a survey
design.html                 service 2, 3D designer: build the room, see the price, send the design
shop.html                   service 3, shop (opening soon, no products yet)
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

The customer builds their room: size, layout, stone for walls and floor, metal
finish, vanity, lighting and extras. The room is drawn live in the browser with
three.js, so every change shows instantly, including an evening light mode for
the LED options. They can orbit and zoom, jump to the vanity, shower, bath or a
plan view, copy a link, save a picture, and send the design with the form.

- **Prices and wording:** `assets/js/studio-data.js` (the comment at the top
  explains the formula). All prices are placeholders.
- **What you receive:** the enquiry includes the full list (room size, layout,
  every finish and option, guide price) and a link that reopens the exact room,
  for example `design.html?w=2.4&l=2.6&lay=shower&wall=cream&floor=travertine&metal=brass&van=walnut&li=plinth,mirror,niche&ex=star,rain,rail`.
- **No 3D?** On a device without WebGL the page shows a still image and every
  option, price and the form still work.
- **Real models later:** each fitting is a function in `studio-scene.js`
  (vanity, toilet, bath, shower, towel rail...). A model made in Blender can
  replace one: export it as `.glb` and load it with three.js's GLTFLoader in
  that function.
- **Stone textures:** `assets/tex/<stone>-2k.webp` (desktop), `-1k.webp`
  (phones) and `-sw.webp` (the swatch). To add a stone, add the three files and
  a line in `studio-data.js`.
- **Still images:** `assets/img/studio-poster*.webp` (shown while the 3D loads)
  and `assets/img/studio-door*` (homepage) are renders of the default room.
  Re-shoot them if the default look changes.

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

Plan: **unicks.co.uk** is the real site. **unicksbathroom.co.uk** permanently
redirects to it. GitHub Pages only serves one custom domain per repo, and one
canonical domain is better for Google anyway.

### 1. GitHub Pages
Repo **Settings → Pages** → Deploy from branch → `main`, `/ (root)`.
(Pages on a private repo needs a paid GitHub plan; public is free.)

### 2. unicks.co.uk on Cloudflare
1. Add the domain to Cloudflare, switch the nameservers at the registrar to the two Cloudflare gives you.
2. DNS records, **DNS only (grey cloud)** to start:

   | Type | Name | Content |
   |---|---|---|
   | A | `@` | 185.199.108.153 |
   | A | `@` | 185.199.109.153 |
   | A | `@` | 185.199.110.153 |
   | A | `@` | 185.199.111.153 |
   | CNAME | `www` | `nifogr.github.io` |

3. GitHub **Settings → Pages → Custom domain**: `unicks.co.uk`. Wait for the
   DNS check, then tick **Enforce HTTPS** once the certificate is issued.
4. Optional, afterwards: turn the orange cloud on and set Cloudflare
   **SSL/TLS → Full**. Never use "Flexible": it causes a redirect loop.

### 3. unicksbathroom.co.uk → redirect
1. Add it to Cloudflare too (nameservers as above).
2. DNS: `A @ 192.0.2.1` and `CNAME www unicksbathroom.co.uk`, both **proxied (orange)**.
   The IP is a dummy; Cloudflare answers before it is ever reached.
3. **Rules → Redirect Rules → Create**: all incoming requests →
   dynamic → `concat("https://unicks.co.uk", http.request.uri.path)`, status **301**,
   preserve query string.

### 4. Google
Add `unicks.co.uk` in Google Search Console and Google Business Profile.
The canonical tags already point there.

## Photos

The newest rooms (`project-star-*.jpg`, `project-cloakroom.jpg`) are full
resolution. The older ones are Instagram screenshots; swap in originals when
available, same filenames. After replacing a photo, regenerate its `-640.webp`
and `-1080.webp` copies (any image tool, quality around 80).
