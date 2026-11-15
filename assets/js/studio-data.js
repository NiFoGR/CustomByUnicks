/* ==========================================================================
   UNICKS custom design studio: options and prices
   --------------------------------------------------------------------------
   This is the only file to edit for the 3D designer's prices and wording.

   Guide price = base
               + (room area - baseArea) x perM2      (bigger rooms cost more)
               + the price of every option picked
   It's rounded to the nearest £50.

   ALL PRICES BELOW ARE PLACEHOLDERS. Replace them before going live.
   ========================================================================== */
window.UNICKS_STUDIO = {
  currency: '£',
  base: 13950,          // design and full fit of a walk-in shower room of baseArea m²
  baseArea: 5,
  perM2: 950,
  note: 'Guide price. You get a fixed quote in writing after the free survey.',

  // room size in metres; customers set it roughly, it gets measured at the survey
  size: {
    w: { min: 1.8, max: 4.0, step: 0.1, value: 2.4 },
    l: { min: 2.0, max: 4.5, step: 0.1, value: 2.6 }
  },

  layouts: [
    { id: 'shower', name: 'Walk-in shower', price: 0 },
    { id: 'bath', name: 'Shower and bath', price: 2600, minL: 2.9, minW: 2.0 }
  ],

  // stone for the walls and the floor (textures live in assets/tex/)
  stones: [
    { id: 'black', name: 'Black marble', wall: 0, floor: 0 },
    { id: 'brown', name: 'Brown marble', wall: 600, floor: 300 },
    { id: 'cream', name: 'Cream marble', wall: 900, floor: 450 },
    { id: 'travertine', name: 'Travertine', wall: 400, floor: 200 }
  ],

  // the walls inside the shower can use a different stone
  feature: { same: 'Same as the walls', price: 600 },   // price applies when a different stone is picked

  floorPatterns: [
    { id: 'large', name: 'Large tiles', note: '120 x 60 cm, lined up', price: 0 },
    { id: 'brick', name: 'Staggered', note: '120 x 60 cm, offset rows', price: 150 },
    { id: 'square', name: 'Square slabs', note: '90 x 90 cm', price: 300 }
  ],

  metals: [
    { id: 'brass', name: 'Brushed brass', price: 0 },
    { id: 'black', name: 'Matt black', price: 0 },
    { id: 'gun', name: 'Gunmetal', price: 350 },
    { id: 'nickel', name: 'Brushed nickel', price: 250 }
  ],

  vanities: [
    { id: 'walnut', name: 'Walnut', price: 0 },
    { id: 'oak', name: 'Smoked oak', price: 0 },
    { id: 'stone', name: 'Stone to match', price: 950 }
  ],

  vanityFronts: [
    { id: 'flat', name: 'Flat drawers', price: 0 },
    { id: 'fluted', name: 'Fluted front', price: 650 }
  ],

  basins: [
    { id: 'trough', name: 'Stone trough', note: 'Carved into the top', price: 0 },
    { id: 'vessel', name: 'Round bowl', note: 'Ceramic bowl on a stone top', price: 0 },
    { id: 'double', name: 'Double trough', note: 'Two basins side by side', price: 1100, minW: 2.4 }
  ],

  mirrors: [
    { id: 'rect', name: 'Rectangle', price: 0 },
    { id: 'arch', name: 'Arch', price: 200 },
    { id: 'round', name: 'Round', price: 100 }
  ],

  screens: [
    { id: 'framed', name: 'Slim frame', note: 'Glass with a fine metal frame', price: 0 },
    { id: 'frameless', name: 'Frameless', note: 'Clear glass, one support bar', price: 250 },
    { id: 'fluted', name: 'Fluted glass', note: 'Ribbed glass for privacy', price: 550 }
  ],

  ledTemps: [
    { id: 'warm', name: 'Warm white', note: 'Soft and golden, 2700K', price: 0 },
    { id: 'neutral', name: 'Neutral white', note: 'Brighter and cleaner, 4000K', price: 0 }
  ],

  lights: [
    { id: 'plinth', name: 'Under-glow', note: 'LED strip under the vanity and the shower bench', price: 380 },
    { id: 'mirror', name: 'Backlit mirror', note: 'Soft light around the mirror', price: 420 },
    { id: 'niche', name: 'Lit niches', note: 'One in the shower and a tall one above the toilet', price: 950 },
    { id: 'cove', name: 'Ceiling cove', note: 'A hidden LED line around the ceiling', price: 1100 },
    { id: 'sconce', name: 'Wall lights', note: 'A pair either side of the mirror', price: 480 }
  ],

  extras: [
    { id: 'star', name: 'Star inlay', note: 'A compass star set into the floor', price: 1450 },
    { id: 'border', name: 'Floor border', note: 'A contrasting line around the floor', price: 850 },
    { id: 'bench', name: 'Shower bench', note: 'Built-in stone bench', price: 1250, tab: 'shower' },
    { id: 'rain', name: 'Rain shower', note: 'Large shower head overhead', price: 450, tab: 'shower' },
    { id: 'rail', name: 'Heated towel rail', note: 'Ladder rail in your metal finish', price: 390 },
    { id: 'ufh', name: 'Underfloor heating', note: 'Not shown in the 3D view', price: 950 }
  ],

  // ready-made starting points, shown at the top of the designer (the first is the default)
  looks: [
    { id: 'cream', name: 'Cream and walnut', wall: 'cream', feature: 'same', floor: 'travertine', pattern: 'large',
      metal: 'brass', vanity: 'walnut', front: 'flat', basin: 'trough', mirror: 'rect', screen: 'framed', led: 'warm',
      lights: ['plinth', 'mirror', 'niche'], extras: ['star', 'rain', 'rail'] },
    { id: 'gold', name: 'Black and gold', wall: 'black', feature: 'same', floor: 'black', pattern: 'square',
      metal: 'brass', vanity: 'oak', front: 'fluted', basin: 'trough', mirror: 'arch', screen: 'framed', led: 'warm',
      lights: ['plinth', 'mirror', 'niche', 'cove'], extras: ['star', 'bench', 'rain'] },
    { id: 'stone', name: 'Warm stone', wall: 'cream', feature: 'brown', floor: 'cream', pattern: 'brick',
      metal: 'brass', vanity: 'walnut', front: 'flat', basin: 'vessel', mirror: 'round', screen: 'fluted', led: 'warm',
      lights: ['plinth', 'niche', 'sconce'], extras: ['border', 'bench', 'rail'] }
  ]
};
