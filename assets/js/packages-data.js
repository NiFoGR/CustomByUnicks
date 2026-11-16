/* ==========================================================================
   UNICKS: package + option data
   --------------------------------------------------------------------------
   This file is the only thing to edit when packages or prices change.
   The cards on the homepage and the price builder on installations.html are
   both built from it.

   PACKAGES
     id       short code used in share links (keep it short, never reuse)
     name     shown on the card
     from     starting price in £, whole pounds
     summary  one line under the name
     includes up to ~5 bullet points shown on the card
     img      picture at the top of the card (assets/img/opt/)

   OPTION GROUPS
     type "single"  pick exactly one (radio). First option is the default.
     type "multi"   tick any number (checkbox).

   Every option also has an img: the picture on its card.

   OPTION PRICE
     price: 950                      same extra cost on every package
     price: { a: 950, b: 0, c: 0 }   per package. 0 = "Included" (pre-ticked,
                                     locked). null = not available on that
                                     package (hidden).

   !! ALL PRICES BELOW ARE PLACEHOLDERS. Replace them with real figures
   !! before the site goes live.
   ========================================================================== */
window.UNICKS_DATA = {
  currency: '£',
  note: 'Guide price for a typical 5m² bathroom. You get a fixed quote in writing after the free survey.',

  packages: [
    {
      id: 'a',
      img: 'assets/img/opt/pkg-a.webp',
      name: 'Essential',
      from: 7950,
      summary: 'Everything a new bathroom needs, done properly.',
      includes: [
        'Full strip-out and disposal',
        'All plumbing and electrical work',
        'Stone-effect porcelain, floor to ceiling',
        'Walk-in shower or bath, wall-hung WC',
        'Vanity unit and LED mirror'
      ]
    },
    {
      id: 'b',
      img: 'assets/img/opt/pkg-b.webp',
      name: 'Signature',
      from: 12950,
      summary: 'Adds built-in lighting, brushed brass and underfloor heating.',
      featured: true,
      includes: [
        'Everything in Essential',
        'Lit shower niche and LED plinth lighting',
        'Floating vanity with stone trough basin',
        'Brushed brass taps and fittings',
        'Electric underfloor heating'
      ]
    },
    {
      id: 'c',
      img: 'assets/img/opt/pkg-c.webp',
      name: 'Prestige',
      from: 18950,
      summary: 'Our top finish, with a stone bench and a star inlay in the floor.',
      includes: [
        'Everything in Signature',
        'Built-in stone shower bench, under-lit',
        'Ceiling rain shower, concealed controls',
        'Inlaid compass-star stone floor',
        '3D design visual before we build'
      ]
    }
  ],

  groups: [
    {
      id: 'finish',
      title: 'Finish',
      type: 'single',
      options: [
        { id: 'light', img: 'assets/img/opt/look-cream.webp', name: 'Light', note: 'Warm cream marble, soft light.', price: 0 },
        { id: 'dark', img: 'assets/img/opt/fin-dark.webp', name: 'Dark',  note: 'Grey and dark stone, warm lighting.', price: 0 },
        { id: 'stone', img: 'assets/img/opt/fin-stone.webp', name: 'Natural marble', note: 'Real stone instead of porcelain.', price: { a: 3500, b: 2900, c: 1900 } }
      ]
    },
    {
      id: 'shower',
      title: 'Shower',
      type: 'multi',
      options: [
        { id: 'screen', img: 'assets/img/opt/scr-framed.webp', name: 'Brass-framed walk-in screen', note: 'Slim brushed brass frame, clear glass.', price: { a: 650, b: 0, c: 0 } },
        { id: 'rain', img: 'assets/img/opt/ex-rain.webp', name: 'Ceiling rain shower',          note: 'Flush ceiling head plus hand shower.', price: { a: 850, b: 750, c: 0 } },
        { id: 'bench', img: 'assets/img/opt/ex-bench.webp', name: 'Stone shower bench',           note: 'Built in, with a light strip underneath.', price: { a: 1450, b: 1250, c: 0 } },
        { id: 'niche', img: 'assets/img/opt/li-niche.webp', name: 'Lit shower niche',             note: 'Recessed shelving with LED edge light.', price: { a: 450, b: 0, c: 0 } }
      ]
    },
    {
      id: 'light',
      title: 'Lighting',
      type: 'multi',
      options: [
        { id: 'plinth', img: 'assets/img/opt/li-plinth.webp', name: 'LED plinth lighting',   note: 'Light strip under the vanity and bench.', price: { a: 380, b: 0, c: 0 } },
        { id: 'mirror', img: 'assets/img/opt/li-mirror.webp', name: 'Backlit feature mirror', note: 'Lit round the edge, demisting, made to size.', price: { a: 0, b: 0, c: 0 } },
        { id: 'sconce', img: 'assets/img/opt/li-sconce.webp', name: 'Onyx wall light',        note: 'Stone wall light next to the mirror.', price: 420 },
        { id: 'cove', img: 'assets/img/opt/li-cove.webp', name: 'Perimeter light lines',  note: 'Hidden light strips along the walls.', price: { a: 790, b: 690, c: 0 } }
      ]
    },
    {
      id: 'floor',
      title: 'Floor & warmth',
      type: 'multi',
      options: [
        { id: 'ufh', img: 'assets/img/opt/ex-ufh.webp', name: 'Underfloor heating',        note: 'Electric mat with smart thermostat.', price: { a: 690, b: 0, c: 0 } },
        { id: 'star', img: 'assets/img/opt/ex-star.webp', name: 'Inlaid compass-star floor', note: 'Star pattern set into the stone floor.', price: { a: 1950, b: 1750, c: 0 } },
        { id: 'border', img: 'assets/img/opt/ex-border.webp', name: 'Stone border inlay',        note: 'Contrast stone band framing the floor.', price: 850 },
        { id: 'rail', img: 'assets/img/opt/ex-rail.webp', name: 'Brushed brass towel rail',  note: 'Tall heated ladder rail.', price: { a: 420, b: 0, c: 0 } }
      ]
    },
    {
      id: 'fit',
      title: 'Vanity & fittings',
      type: 'multi',
      options: [
        { id: 'trough', img: 'assets/img/opt/basin-trough.webp', name: 'Stone trough vanity',  note: 'Floating timber unit, stone basin.', price: { a: 1350, b: 0, c: 0 } },
        { id: 'brass', img: 'assets/img/opt/metal-brass.webp', name: 'Brushed brass fittings', note: 'Taps, valves, flush plate, accessories.', price: { a: 750, b: 0, c: 0 } },
        { id: 'fluted', img: 'assets/img/opt/pkg-fluted.webp', name: 'Fluted feature panel', note: 'Vertical slatted wall panel.', price: 980 },
        { id: 'visual', img: 'assets/img/opt/lay-shower.webp', name: '3D design visual',     note: 'See the room before we build it.', price: { a: 450, b: 350, c: 0 } }
      ]
    }
  ]
};
