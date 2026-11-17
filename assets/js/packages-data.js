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
     img      picture at the top of the card (assets/img/pick/)

   OPTION GROUPS
     type "single"  pick exactly one (radio). First option is the default.
     type "multi"   tick any number (checkbox).

   Every option also has an img: the picture on its card.
   free: true shows "Free" instead of "Included" on a 0 price.

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
  note: 'Guide price for a typical 5m² bathroom. You get a fixed quote after the free survey.',

  packages: [
    {
      id: 'a',
      img: 'assets/img/pick/pkg-a.webp',
      name: 'Essential',
      from: 7950,
      summary: 'A complete new bathroom.',
      includes: [
        'Strip-out and disposal',
        'All plumbing and electrics',
        'Stone-effect porcelain throughout',
        'Shower or bath, wall-hung WC',
        'Vanity and LED mirror'
      ]
    },
    {
      id: 'b',
      img: 'assets/img/pick/pkg-b.webp',
      name: 'Signature',
      from: 12950,
      summary: 'Adds lighting and brass.',
      featured: true,
      includes: [
        'Everything in Essential',
        'Lit shower niche',
        'Stone trough vanity, lit underneath',
        'Brushed brass fittings',
        'Underfloor heating'
      ]
    },
    {
      id: 'c',
      img: 'assets/img/pick/pkg-c.webp',
      name: 'Prestige',
      from: 18950,
      summary: 'Our top finish.',
      includes: [
        'Everything in Signature',
        'Lit stone shower bench',
        'Ceiling rain shower',
        'Star inlay in the floor',
        'Hidden light lines in the walls'
      ]
    }
  ],

  groups: [
    {
      id: 'finish',
      title: 'Finish',
      type: 'single',
      options: [
        { id: 'light', img: 'assets/img/pick/light.webp', name: 'Light', note: 'Cream stone, soft light.', price: 0 },
        { id: 'dark', img: 'assets/img/pick/dark.webp', name: 'Dark', note: 'Grey and black stone.', price: 0 },
        { id: 'stone', img: 'assets/img/pick/stone.webp', name: 'Natural marble', note: 'Real stone, not porcelain.', price: { a: 3500, b: 2900, c: 1900 } }
      ]
    },
    {
      id: 'shower',
      title: 'Shower',
      type: 'multi',
      options: [
        { id: 'screen', img: 'assets/img/pick/screen.webp', name: 'Brass-framed screen', note: 'Slim brass frame, clear glass.', price: { a: 650, b: 0, c: 0 } },
        { id: 'rain', img: 'assets/img/pick/rain.webp', name: 'Ceiling rain shower', note: 'Flush head plus hand shower.', price: { a: 850, b: 750, c: 0 } },
        { id: 'bench', img: 'assets/img/pick/bench.webp', name: 'Stone shower bench', note: 'Built in, lit underneath.', price: { a: 1450, b: 1250, c: 0 } },
        { id: 'niche', img: 'assets/img/pick/niche.webp', name: 'Lit shower niche', note: 'Shelves set into the wall.', price: { a: 450, b: 0, c: 0 } }
      ]
    },
    {
      id: 'light',
      title: 'Lighting',
      type: 'multi',
      options: [
        { id: 'plinth', img: 'assets/img/pick/plinth.webp', name: 'Plinth lighting', note: 'Glow under the vanity and bench.', price: { a: 380, b: 0, c: 0 } },
        { id: 'mirror', img: 'assets/img/pick/mirror.webp', name: 'Backlit mirror', note: 'Demisting, made to size.', price: { a: 0, b: 0, c: 0 } },
        { id: 'sconce', img: 'assets/img/pick/sconce.webp', name: 'Onyx wall light', note: 'Stone light by the mirror.', price: 420 },
        { id: 'cove', img: 'assets/img/pick/cove.webp', name: 'Wall light lines', note: 'Hidden LED strips.', price: { a: 790, b: 690, c: 0 } }
      ]
    },
    {
      id: 'floor',
      title: 'Floor and heat',
      type: 'multi',
      options: [
        { id: 'ufh', img: 'assets/img/pick/ufh.webp', name: 'Underfloor heating', note: 'Electric, smart thermostat.', price: { a: 690, b: 0, c: 0 } },
        { id: 'star', img: 'assets/img/pick/star.webp', name: 'Star inlay', note: 'A stone star in the floor.', price: { a: 1950, b: 1750, c: 0 } },
        { id: 'border', img: 'assets/img/pick/border.webp', name: 'Stone border', note: 'A contrast band round the floor.', price: 850 },
        { id: 'rail', img: 'assets/img/pick/rail.webp', name: 'Brass towel rail', note: 'Tall and heated.', price: { a: 420, b: 0, c: 0 } }
      ]
    },
    {
      id: 'fit',
      title: 'Vanity and fittings',
      type: 'multi',
      options: [
        { id: 'trough', img: 'assets/img/pick/trough.webp', name: 'Stone trough vanity', note: 'Timber unit, stone basin.', price: { a: 1350, b: 0, c: 0 } },
        { id: 'brass', img: 'assets/img/pick/brass.webp', name: 'Brushed brass fittings', note: 'Taps, valves and flush plate.', price: { a: 750, b: 0, c: 0 } },
        { id: 'fluted', img: 'assets/img/pick/fluted.webp', name: 'Fluted wall panel', note: 'Vertical ribbed panel.', price: 980 },
        { id: 'visual', img: 'assets/img/studio-door-640.webp', name: '3D design', note: 'See your room before we start.', price: 0, free: true }
      ]
    }
  ]
};
