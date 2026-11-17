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
     img      picture at the top of the card, rendered from the 3D designer
     flag     optional label on the card (one package only)
     design   how the package looks in the 3D designer ("Open in 3D")

   OPTION GROUPS
     type "single"  pick exactly one (radio). First option is the default.
     type "multi"   tick any number (checkbox).

   Every option also has an img: the picture on its card.
   free: true shows "Free" instead of "Included" on a 0 price.

   The comparison table, the "8 of 17 extras" line and the saving on each
   card are all worked out from these prices. The saving is what the
   included extras would cost on top of the first package, minus the
   difference in price.

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

  // rows at the top of the comparison table: in every package
  base: ['Strip-out and full refit', 'All plumbing and electrics', 'Walk-in shower or bath', 'Wall-hung WC and vanity'],

  packages: [
    {
      id: 'a',
      img: 'assets/img/opt/pkg-a.webp',
      name: 'Essential',
      from: 7950,
      summary: 'A complete new bathroom.',
      includes: ['Full strip-out and refit', 'Porcelain walls and floor', 'Backlit mirror', 'Free 3D design'],
      design: { wall: 'cream', feat: 'same', floor: 'travertine', pat: 'large', metal: 'black', van: 'walnut', front: 'flat', basin: 'vessel', mir: 'rect', scr: 'framed', led: 'warm', li: 'mirror', ex: '' }
    },
    {
      id: 'b',
      img: 'assets/img/opt/pkg-b.webp',
      name: 'Signature',
      from: 11950,
      summary: 'Adds lighting and brass.',
      includes: ['Everything in Essential', 'Lit niche and plinth', 'Stone trough vanity', 'Brass fittings and rail', 'Underfloor heating'],
      design: { wall: 'cream', feat: 'same', floor: 'travertine', pat: 'large', metal: 'brass', van: 'walnut', front: 'flat', basin: 'trough', mir: 'rect', scr: 'framed', led: 'warm', li: 'plinth,mirror,niche', ex: 'rail,ufh' }
    },
    {
      id: 'c',
      img: 'assets/img/opt/pkg-c.webp',
      name: 'Prestige',
      from: 18950,
      summary: 'Every extra we offer.',
      flag: 'Best value',
      featured: true,
      includes: ['Everything in Signature', 'Real marble, no extra cost', 'Lit bench and rain shower', 'Star inlay and stone border', 'Onyx lights and light lines'],
      design: { wall: 'brown', feat: 'black', floor: 'black', pat: 'square', metal: 'brass', van: 'oak', front: 'fluted', basin: 'trough', mir: 'arch', scr: 'framed', led: 'warm', li: 'plinth,mirror,niche,cove,sconce', ex: 'star,border,bench,rain,rail,ufh' }
    }
  ],

  groups: [
    {
      id: 'finish',
      title: 'Finish',
      type: 'single',
      options: [
        { id: 'light', img: 'assets/img/opt/stone-cream.webp', name: 'Light', note: 'Cream stone, soft light.', price: 0, design: { wall: 'cream', feat: 'same', floor: 'travertine' } },
        { id: 'dark', img: 'assets/img/opt/stone-black.webp', name: 'Dark', note: 'Grey and black stone.', price: 0, design: { wall: 'black', feat: 'same', floor: 'black' } },
        { id: 'stone', img: 'assets/img/opt/stone-brown.webp', name: 'Natural marble', note: 'Real stone, not porcelain.', price: { a: 3500, b: 2900, c: 0 }, design: { wall: 'brown', feat: 'black', floor: 'black' } }
      ]
    },
    {
      id: 'shower',
      title: 'Shower',
      type: 'multi',
      options: [
        { id: 'screen', img: 'assets/img/opt/scr-framed.webp', name: 'Brass-framed screen', note: 'Slim brass frame, clear glass.', price: { a: 650, b: 0, c: 0 } },
        { id: 'rain', img: 'assets/img/opt/ex-rain.webp', name: 'Ceiling rain shower', note: 'Flush head plus hand shower.', price: { a: 850, b: 750, c: 0 }, ex: 'rain' },
        { id: 'bench', img: 'assets/img/opt/ex-bench.webp', name: 'Stone shower bench', note: 'Built in, lit underneath.', price: { a: 1450, b: 1250, c: 0 }, ex: 'bench' },
        { id: 'niche', img: 'assets/img/opt/li-niche.webp', name: 'Lit shower niche', note: 'Shelves set into the wall.', price: { a: 450, b: 0, c: 0 }, li: 'niche' }
      ]
    },
    {
      id: 'light',
      title: 'Lighting',
      type: 'multi',
      options: [
        { id: 'plinth', img: 'assets/img/opt/li-plinth.webp', name: 'Plinth lighting', note: 'Glow under the vanity and bench.', price: { a: 380, b: 0, c: 0 }, li: 'plinth' },
        { id: 'mirror', img: 'assets/img/opt/li-mirror.webp', name: 'Backlit mirror', note: 'Demisting, made to size.', price: { a: 0, b: 0, c: 0 }, li: 'mirror' },
        { id: 'sconce', img: 'assets/img/opt/li-sconce.webp', name: 'Onyx wall lights', note: 'Either side of the mirror.', price: { a: 420, b: 420, c: 0 }, li: 'sconce' },
        { id: 'cove', img: 'assets/img/opt/li-cove.webp', name: 'Ceiling light line', note: 'Hidden LED round the ceiling.', price: { a: 790, b: 690, c: 0 }, li: 'cove' }
      ]
    },
    {
      id: 'floor',
      title: 'Floor and heat',
      type: 'multi',
      options: [
        { id: 'ufh', img: 'assets/img/opt/ex-ufh.webp', name: 'Underfloor heating', note: 'Electric, smart thermostat.', price: { a: 690, b: 0, c: 0 }, ex: 'ufh' },
        { id: 'star', img: 'assets/img/opt/ex-star.webp', name: 'Star inlay', note: 'A stone star in the floor.', price: { a: 1950, b: 1750, c: 0 }, ex: 'star' },
        { id: 'border', img: 'assets/img/opt/ex-border.webp', name: 'Stone border', note: 'A contrast band round the floor.', price: { a: 850, b: 850, c: 0 }, ex: 'border' },
        { id: 'rail', img: 'assets/img/opt/ex-rail.webp', name: 'Heated towel rail', note: 'Tall ladder rail.', price: { a: 420, b: 0, c: 0 }, ex: 'rail' }
      ]
    },
    {
      id: 'fit',
      title: 'Vanity and fittings',
      type: 'multi',
      options: [
        { id: 'trough', img: 'assets/img/opt/basin-trough.webp', name: 'Stone trough vanity', note: 'Timber unit, stone basin.', price: { a: 1350, b: 0, c: 0 }, design: { basin: 'trough' }, off: { basin: 'vessel' } },
        { id: 'brass', img: 'assets/img/opt/metal-brass.webp', name: 'Brushed brass fittings', note: 'Taps, valves and flush plate.', price: { a: 750, b: 0, c: 0 }, design: { metal: 'brass' }, off: { metal: 'black' } },
        { id: 'fluted', img: 'assets/img/opt/front-fluted.webp', name: 'Fluted panel', note: 'Ribbed vanity front.', price: { a: 980, b: 980, c: 0 }, design: { front: 'fluted' }, off: { front: 'flat' } },
        { id: 'visual', img: 'assets/img/opt/visual.webp', name: '3D design', note: 'See your room before we start.', price: 0, free: true }
      ]
    }
  ]
};
