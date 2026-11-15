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
    { id: 'bench', name: 'Shower bench', note: 'Built-in stone bench', price: 1250 },
    { id: 'rain', name: 'Rain shower', note: 'Large shower head overhead', price: 450 },
    { id: 'rail', name: 'Heated towel rail', note: 'Ladder rail in your metal finish', price: 390 },
    { id: 'ufh', name: 'Underfloor heating', note: 'Not shown in the 3D view', price: 950 }
  ],

  // ready-made starting points, shown at the top of the designer (the first is the default)
  looks: [
    { id: 'cream', name: 'Cream and walnut', wall: 'cream', floor: 'travertine', metal: 'brass', vanity: 'walnut',
      lights: ['plinth', 'mirror', 'niche'], extras: ['star', 'rain', 'rail'] },
    { id: 'gold', name: 'Black and gold', wall: 'black', floor: 'black', metal: 'brass', vanity: 'oak',
      lights: ['plinth', 'mirror', 'niche', 'cove'], extras: ['star', 'bench', 'rain'] },
    { id: 'stone', name: 'Warm stone', wall: 'brown', floor: 'cream', metal: 'brass', vanity: 'walnut',
      lights: ['plinth', 'niche', 'sconce'], extras: ['border', 'bench', 'rail'] }
  ]
};
