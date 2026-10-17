"""Build the static site from src/ into the repo root.

  python3 tools/build.py

  src/site.json         business details (NAP, guarantee, areas...)
  src/layout.html       the shell every page sits in (head, header, footer)
  src/pages/*.html      page bodies, each starting with a JSON front-matter comment
  src/services/*.json   one file per service page, rendered by service_page()

Output is plain HTML committed to the repo, so GitHub Pages serves it as-is.
Pure standard library. Run it after any change in src/.

Tokens available in pages, services and layout:
  {{root}}            relative path to the site root ("../" per folder level)
  {{city}} {{phone}} {{email}} {{address}} {{hours}} {{areas}} {{reply}}
  {{guarantee}}       "a 10-year workmanship guarantee"; {{Guarantee}} capitalised
  {{ph:text}}         marks text the client still has to confirm
  {{img:name|sizes|alt|eager}}   responsive <picture> from assets/img/name-{640,1080}
  {{services_cards}} {{services_grid}} {{work_grid}} {{tiers}} {{year}}
"""
import html
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
SITE = json.loads((SRC / "site.json").read_text())
LAYOUT = (SRC / "layout.html").read_text()

def ph(text, mode):
    return text if mode == "plain" else f'<span class="ph">{text}</span>'


# ---------------------------------------------------------------- tokens
def guarantee(mode, cap=False):
    y = SITE["guaranteeYears"]
    word = "A" if cap else "a"
    return f"{word} {y}-year workmanship guarantee" if y else f"{word} {ph('[X]', mode)}-year workmanship guarantee"


def address(mode):
    parts = [SITE["street"], SITE["city"], SITE["postcode"]]
    if not all(parts):
        return ph("[Street, Town, Postcode]", mode)
    return ", ".join(parts)


def phone(mode):
    if not SITE["phone"]:
        return ph("[Phone number]", mode)
    if mode == "plain":
        return SITE["phone"]
    return f'<a href="tel:{SITE["phoneIntl"] or SITE["phone"].replace(" ", "")}">{SITE["phone"]}</a>'


def email(mode):
    if not SITE["email"]:
        return ph("[Email address]", mode)
    return SITE["email"] if mode == "plain" else f'<a href="mailto:{SITE["email"]}">{SITE["email"]}</a>'


def simple(key, fallback):
    return lambda mode: SITE[key] or ph(fallback, mode)


TOKENS = {
    "city": simple("city", "[City]"),
    "hours": simple("hours", "[Mon to Fri, 8am to 6pm]"),
    "reply": simple("replyTime", "[one working day]"),
    "companyNo": simple("companyNo", "[Company no.]"),
    "legalName": lambda m: SITE["legalName"] or SITE["name"],
    "phone": phone,
    "email": email,
    "address": address,
    "areas": lambda m: ", ".join(SITE["areas"]) if SITE["areas"] else ph("[Areas you cover]", m),
    "guarantee": lambda m: guarantee(m),
    "Guarantee": lambda m: guarantee(m, True),
    "year": lambda m: str(date.today().year),
    "instagram": lambda m: SITE["instagram"],
}


def render(text, ctx, mode="html"):
    """Replace {{tokens}}. mode="plain" for attributes, titles and JSON-LD."""
    def sub(m):
        key = m.group(1)
        if key.startswith("ph:"):
            return ph(key[3:], mode)
        if key.startswith("img:"):
            return picture(*key[4:].split("|"), ctx=ctx)
        if key == "root":
            return ctx["root"]
        if key in ctx.get("blocks", {}):
            return ctx["blocks"][key]
        if key in TOKENS:
            return TOKENS[key](mode)
        raise KeyError(f"unknown token {{{{{key}}}}} in {ctx.get('path')}")
    # blocks can contain tokens themselves, so loop until stable
    for _ in range(4):
        new = re.sub(r"\{\{([^{}]+?)\}\}", sub, text)
        if new == text:
            break
        text = new
    return text


def plain(text, ctx):
    """Plain-text render, then escape for use inside an HTML attribute."""
    return html.escape(render(text, ctx, "plain"), quote=True)


# ---------------------------------------------------------------- images
_sizes_cache = {}


def img_size(name, w):
    key = (name, w)
    if key not in _sizes_cache:
        # read width/height from the JPEG header (SOF marker), no Pillow needed
        data = (ROOT / "assets" / "img" / f"{name}-{w}.jpg").read_bytes()
        i = 2
        while i < len(data):
            marker, length = data[i + 1], int.from_bytes(data[i + 2:i + 4], "big")
            if marker in (0xC0, 0xC1, 0xC2):
                h, wd = int.from_bytes(data[i + 5:i + 7], "big"), int.from_bytes(data[i + 7:i + 9], "big")
                _sizes_cache[key] = (wd, h)
                break
            i += 2 + length
    return _sizes_cache[key]


def picture(name, sizes="100vw", alt="", eager="", ctx=None):
    r = ctx["root"]
    (w1, h1), (w2, h2) = img_size(name, 640), img_size(name, 1080)
    alt = plain(alt, ctx)
    load = 'fetchpriority="high"' if eager else 'loading="lazy" decoding="async"'
    return (
        f'<picture>'
        f'<source type="image/webp" srcset="{r}assets/img/{name}-640.webp {w1}w, {r}assets/img/{name}-1080.webp {w2}w" sizes="{sizes}">'
        f'<img src="{r}assets/img/{name}-1080.jpg" srcset="{r}assets/img/{name}-640.jpg {w1}w, {r}assets/img/{name}-1080.jpg {w2}w" '
        f'sizes="{sizes}" width="{w2}" height="{h2}" alt="{alt}" {load}>'
        f'</picture>'
    )


# ---------------------------------------------------------------- data
SERVICES = sorted(
    (json.loads(p.read_text()) for p in (SRC / "services").glob("*.json")),
    key=lambda s: s["order"],
)
PKG = json.loads(re.search(r"window\.UNICKS_DATA = (\{.*\});", (ROOT / "assets/js/packages-data.js").read_text(), re.S).group(1))
TICK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3.5"/></svg>'


def money(n):
    return f"&pound;{n:,}"


def tier_inner(p, i, tail):
    e = html.escape
    return (f'<span class="tier__tag">Package {chr(65 + i)}</span>'
            + ('<span class="tier__flag">Recommended</span>' if p.get("featured") else "")
            + f'<h3>{e(p["name"])}</h3><p class="tier__sum">{e(p["summary"])}</p>'
            + f'<div class="tier__price"><small>Guide price from</small>{money(p["from"])}</div>'
            + "<ul>" + "".join(f"<li>{e(x)}</li>" for x in p["includes"]) + "</ul>" + tail)


def package_blocks(r):
    e = html.escape
    teaser = "".join(
        f'<article class="tier{" is-featured" if p.get("featured") else ""}" data-rv>'
        + tier_inner(p, i, f'<a class="btn{" btn--solid" if p.get("featured") else ""}" href="{r}packages/?p={p["id"]}#customise">Price {e(p["name"])} {ARROW}</a>')
        + "</article>" for i, p in enumerate(PKG["packages"]))
    pick = "".join(
        f'<button type="button" class="tier{" is-featured" if p.get("featured") else ""}" data-pkg="{p["id"]}" aria-pressed="false" data-rv>'
        + tier_inner(p, i, f'<span class="tier__pick">Choose {e(p["name"])}</span>') + "</button>"
        for i, p in enumerate(PKG["packages"]))
    groups = "".join(
        f'<fieldset class="ogroup"><legend>{e(g["title"])}</legend><div class="opts">'
        + "".join(
            f'<label class="opt" data-type="{g["type"]}" data-opt="{o["id"]}">'
            f'<input type="{"radio" if g["type"] == "single" else "checkbox"}" name="{g["id"] if g["type"] == "single" else o["id"]}" value="{o["id"]}">'
            f'<span class="opt__box">{TICK}</span>'
            f'<span><span class="opt__name">{e(o["name"])}</span><span class="opt__note">{e(o["note"])}</span></span>'
            f'<span class="opt__price"></span></label>'
            for o in g["options"])
        + "</div></fieldset>" for g in PKG["groups"])
    return {"tiers": f'<div class="tiers">{teaser}</div>', "tiers_pick": pick, "option_groups": groups,
            "price_note": e(PKG["note"])}


WORK = [  # name, title, caption, alt
    ("project-star-dark", "Grey marble shower room", "Walk-in shower, under-lit stone bench, compass-star floor",
     "Grey marble shower room with brass-framed walk-in screen, under-lit stone bench and inlaid compass-star floor"),
    ("project-brass-suite", "Marble family bathroom", "Freestanding bath, lit display niches, brushed brass",
     "Marble bathroom with freestanding bath, tall brushed brass towel radiator and lit display niches"),
    ("project-onyx-wetroom", "Black marble wet room", "Terrazzo floor, floating bench, frameless glass",
     "Black marble walk-in wet room with terrazzo floor, under-lit floating bench and lit niche"),
    ("project-star-light", "Cream marble shower room", "Compass-star inlay, floating vanity, lit niches",
     "Cream marble shower room with compass-star stone inlay, floating timber vanity and lit niches"),
    ("project-stone-ensuite", "Stone en-suite", "Halo mirror, stone trough basin, lit shelving",
     "Stone-effect en-suite with halo-lit mirror, stone trough basin on a timber vanity and lit shelving"),
    ("project-cloakroom", "Cream marble cloakroom", "Wall-hung WC, lit niche, brass towel rail",
     "Narrow cream marble cloakroom with wall-hung WC, lit glass-shelf niche and brushed brass towel radiator"),
]

ARROW = '<svg class="ico-arrow" viewBox="0 0 16 10" aria-hidden="true"><path d="M1 5h13M10 1l4 4-4 4"/></svg>'


def blocks(ctx):
    r = ctx["root"]
    services_grid = "".join(
        f'<a class="svc" href="{r}services/{s["slug"]}/" data-rv>'
        f'<span class="svc__n">{i:02d}</span><h3>{html.escape(s["nav"])}</h3>'
        f'<p>{render(s["summary"], ctx)}</p><span class="svc__go">{ARROW}</span></a>'
        for i, s in enumerate(SERVICES, 1)
    )
    services_cards = "".join(
        f'<a class="card" href="{r}services/{s["slug"]}/" data-rv>'
        f'<div class="card__img">{picture(s["image"], "(max-width: 900px) 100vw, 33vw", s["imageAlt"], ctx=ctx)}</div>'
        f'<h3>{html.escape(s["nav"])}</h3><p>{render(s["summary"], ctx)}</p>'
        f'<span class="link">Read more {ARROW}</span></a>'
        for s in SERVICES
    )
    work_grid = "".join(
        f'<figure class="work" data-rv>'
        f'<button class="work__img" type="button" data-lightbox="{r}assets/img/{n}-1080.webp" aria-label="Enlarge: {html.escape(t)}">'
        f'{picture(n, "(max-width: 620px) 100vw, (max-width: 1080px) 50vw, 33vw", a, ctx=ctx)}</button>'
        f'<figcaption><strong>{t}</strong><span>{c}</span></figcaption></figure>'
        for n, t, c, a in WORK
    )
    footer_services = "".join(f'<li><a href="{r}services/{s["slug"]}/">{html.escape(s["nav"])}</a></li>' for s in SERVICES)
    return {
        "services_grid": services_grid,
        "services_cards": services_cards,
        "work_grid": work_grid,
        "work_grid_home": "".join(re.findall(r'<figure class="work".*?</figure>', work_grid, re.S)[:4]),
        "footer_services": footer_services,
        "arrow": ARROW,
        **package_blocks(r),
    }


# ---------------------------------------------------------------- schema
def business_schema(ctx):
    d = SITE["domain"]
    b = {
        "@type": "HomeAndConstructionBusiness",
        "@id": f"{d}/#business",
        "name": SITE["name"],
        "url": f"{d}/",
        "logo": f"{d}/assets/img/icon-512.png",
        "image": f"{d}/assets/img/og-image.jpg",
        "description": render("Luxury bathroom design and installation in {{city}}: full renovations, wet rooms, en-suites, walk-in showers and cloakrooms.", ctx, "plain"),
        "sameAs": [SITE["instagram"]],
        "priceRange": "££££",
    }
    if SITE["phone"]:
        b["telephone"] = SITE["phoneIntl"] or SITE["phone"]
    if SITE["email"]:
        b["email"] = SITE["email"]
    if SITE["street"] and SITE["city"]:
        b["address"] = {"@type": "PostalAddress", "streetAddress": SITE["street"], "addressLocality": SITE["city"],
                        "addressRegion": SITE["county"], "postalCode": SITE["postcode"], "addressCountry": "GB"}
    if SITE["areas"] or SITE["city"]:
        b["areaServed"] = [{"@type": "City", "name": a} for a in ([SITE["city"]] if SITE["city"] else []) + SITE["areas"]]
    if SITE["mapsUrl"]:
        b["hasMap"] = SITE["mapsUrl"]
    return b


def faq_schema(pairs):
    return {"@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in pairs]}


def crumbs_schema(trail):
    d = SITE["domain"]
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i, "name": n, "item": f"{d}/{p}"} for i, (n, p) in enumerate(trail, 1)]}


def strip_tags(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


# ---------------------------------------------------------------- pages
def page(path, meta, body, schema_extra=()):
    depth = 0 if path in ("", "404.html") else path.strip("/").count("/") + 1
    ctx = {"root": "/" if path == "404.html" else "../" * depth, "path": path}
    ctx["blocks"] = blocks(ctx)
    body = render(body, ctx)

    faqs = [(strip_tags(q), strip_tags(a)) for q, a in
            re.findall(r'<summary>(.*?)</summary>\s*<div class="faq__a">(.*?)</div>\s*</details>', body, re.S)]
    graph = [business_schema(ctx)]
    if faqs:
        graph.append(faq_schema(faqs))
    graph.extend(schema_extra)
    schema = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=1)

    nav = meta.get("nav", "")
    out = LAYOUT
    out = out.replace("{{content}}", body)
    out = out.replace("{{schema}}", schema)
    out = out.replace("{{page_title}}", plain(meta["title"], ctx))
    out = out.replace("{{page_description}}", plain(meta["description"], ctx))
    out = out.replace("{{canonical}}", f'{SITE["domain"]}/{"" if path == "404.html" else path}')
    out = out.replace("{{robots}}", "noindex" if path == "404.html" else "index,follow")
    out = out.replace("{{body_class}}", meta.get("bodyClass", ""))
    out = out.replace("{{scripts}}", "".join(f'<script src="{ctx["root"]}assets/js/{s}" defer></script>' for s in meta.get("scripts", [])))
    for key in ("home", "services", "work", "process", "packages", "contact"):
        out = out.replace(f"{{{{nav_{key}}}}}", ' aria-current="page"' if nav == key else "")
    out = render(out, ctx)

    dest = ROOT / (path if path.endswith(".html") else path + "index.html")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out)
    return path


def read_page(p):
    raw = p.read_text()
    m = re.match(r"\s*<!--(.*?)-->\s*", raw, re.S)
    return json.loads(m.group(1)), raw[m.end():]


def service_page(s):
    path = f"services/{s['slug']}/"
    sections = "".join(
        f'<section class="prose__sec" data-rv><h2>{render(sec["h2"], {"root": "", "path": path}, "plain")}</h2>{sec["html"]}</section>'
        for sec in s["sections"]
    )
    included = "".join(f"<li>{x}</li>" for x in s["included"])
    faqs = "".join(
        f'<details class="faq__item"><summary>{f["q"]}</summary>\n<div class="faq__a"><p>{f["a"]}</p></div>\n</details>'
        for f in s["faqs"]
    )
    rel = [x for x in SERVICES if x["slug"] in s["related"]]
    related = "".join(
        f'<a class="card" href="{{{{root}}}}services/{x["slug"]}/" data-rv>'
        f'<div class="card__img">{{{{img:{x["image"]}|(max-width: 900px) 100vw, 33vw|{x["imageAlt"]}}}}}</div>'
        f'<h3>{html.escape(x["nav"])}</h3><p>{x["summary"]}</p><span class="link">Read more {{{{arrow}}}}</span></a>'
        for x in rel
    )
    body = f"""
<header class="phero">
  <div class="phero__media">{{{{img:{s['image']}|(max-width: 900px) 100vw, 50vw|{s['imageAlt']}|eager}}}}</div>
  <div class="phero__txt">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="{{{{root}}}}">Home</a><span>/</span><a href="{{{{root}}}}services/">Services</a><span>/</span><span aria-current="page">{html.escape(s['nav'])}</span></nav>
    <h1 data-hero>{s['h1']}</h1>
    <p class="lede" data-hero>{s['lede']}</p>
    <div class="cta-row" data-hero>
      <a class="btn btn--solid" href="{{{{root}}}}packages/">Price my bathroom {{{{arrow}}}}</a>
      <a class="link" href="{{{{root}}}}contact/">Book a free survey {{{{arrow}}}}</a>
    </div>
  </div>
</header>

<div class="wrap article">
  <article class="prose">{sections}</article>
  <aside class="article__side">
    <div class="side-card" data-rv>
      <p class="eyebrow">What's included</p>
      <ul class="ticks">{included}</ul>
      <a class="btn btn--solid btn--block" href="{{{{root}}}}packages/">Price my bathroom</a>
      <p class="side-card__note">Free survey. Fixed, itemised quote. {{{{Guarantee}}}}.</p>
    </div>
  </aside>
</div>

<section class="section section--alt">
  <div class="wrap narrow">
    <div class="head head--center" data-rv><p class="eyebrow">Questions</p><h2>{html.escape(s['nav'])}: common questions</h2></div>
    <div class="faq">{faqs}</div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="head" data-rv><div><p class="eyebrow">Related</p><h2>Other services</h2></div>
      <a class="link" href="{{{{root}}}}services/">All services {{{{arrow}}}}</a></div>
    <div class="cards">{related}</div>
  </div>
</section>
{{{{include_cta}}}}
"""
    body = body.replace("{{include_cta}}", CTA)
    word_count = len(strip_tags(sections).split())
    extra = [
        {"@type": "Service", "name": render(s["nav"], {"root": "", "path": path}, "plain"),
         "serviceType": render(s["h1"], {"root": "", "path": path}, "plain"),
         "provider": {"@id": f'{SITE["domain"]}/#business'},
         "areaServed": SITE["city"] or None, "url": f'{SITE["domain"]}/{path}'},
        crumbs_schema([("Home", ""), ("Services", "services/"), (s["nav"], path)]),
    ]
    page(path, {"title": s["title"], "description": s["description"], "nav": "services"}, body, extra)
    return path, word_count


CTA = (SRC / "partials" / "cta.html").read_text()
FORM = (SRC / "partials" / "form.html").read_text()


def sitemap(paths):
    today = date.today().isoformat()
    urls = "".join(f"<url><loc>{SITE['domain']}/{p}</loc><lastmod>{today}</lastmod></url>" for p in paths)
    (ROOT / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n')
    (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE['domain']}/sitemap.xml\n")


if __name__ == "__main__":
    built = []
    for p in sorted((SRC / "pages").glob("*.html")):
        meta, body = read_page(p)
        body = body.replace("{{include_cta}}", CTA).replace("{{include_form}}", FORM)
        crumbs = [crumbs_schema(meta["crumbs"])] if meta.get("crumbs") else []
        built.append(page(meta["path"], meta, body, crumbs))
    for s in SERVICES:
        path, words = service_page(s)
        built.append(path)
        print(f"  {path:<34} {words} words")
    sitemap(sorted(p for p in built if p != "404.html"))
    print(f"built {len(built)} pages")
