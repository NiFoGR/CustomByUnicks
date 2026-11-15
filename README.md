# UNICKS: Luxury Bathrooms

Static site for **UNICKS** (`@custombyunicks`). Plain HTML/CSS/JS, no build step.

```
index.html                 home: hero, three ways in, why us, work, how it works, packages, survey form
packages.html              price builder: 1 package, 2 extras, 3 book a survey
privacy.html               privacy notice (needed because the forms collect personal details)
404.html                   page-not-found (uses root links, works on the real domain)
assets/js/packages-data.js packages, extras and prices (the only file to edit for pricing)
assets/js/main.js          header, menu, slides, work rail, price builder, forms
assets/css/style.css       all styles, colours and fonts set in :root at the top
assets/fonts/              Cormorant Garamond and Jost, served from the site (no Google requests)
assets/img/                photos (.jpg plus smaller .webp copies), logo mark, icons, share image
robots.txt, sitemap.xml    for search engines
```

Run locally: `python3 -m http.server 8000`, open http://localhost:8000.

---

## Packages and prices

Everything on the packages page is generated from `assets/js/packages-data.js`.
The comment at the top of that file explains the format. In short:

- `price: 950` costs the same on every package.
- `price: { a: 950, b: 0, c: 0 }` varies per package. `0` shows as **Included**
  (pre-ticked and locked), `null` hides the option on that package.
- `type: 'single'` groups are pick-one (first option is the default);
  `type: 'multi'` groups are tick-any.

**All current prices are placeholders.** Replace them before going live.

A customer's build is kept in the URL (`packages.html?p=b&finish=dark&o=bench,rain`),
so it can be shared, and the full list plus that link are sent with the enquiry.

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
the packages page also include the package, extras and guide price, plus a link
that reopens the exact same choice.

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
