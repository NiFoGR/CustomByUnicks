/* ==========================================================================
   UNICKS: package + option data
   --------------------------------------------------------------------------
   This file is the only thing to edit when packages or prices change.
   tools/build.py renders it into the HTML; the configurator script reads it too.

   PACKAGES
     id       short code used in share links (keep it short, never reuse)
     name     shown on the card
     from     starting price in £, whole pounds
     summary  one line under the name
     includes up to ~5 bullet points shown on the card

   OPTION GROUPS
     type "single"  pick exactly one (radio). First option is the default.
     type "multi"   tick any number (checkbox).

   OPTION PRICE
     "price": 950                           same extra cost on every package
     "price": { "a": 950, "b": 0, "c": 0 }  per package. 0 = Included (pre-ticked,
                                            locked). null = not available there.

   FORMAT: the object below must stay valid JSON (double quotes, no trailing
   commas, no comments inside it). Run `python3 tools/build.py` after editing.

   !! ALL PRICES BELOW ARE PLACEHOLDERS. Replace them with real figures
   !! before the site goes live.
   ========================================================================== */
window.UNICKS_DATA = {
  "currency": "£",
  "note": "Guide prices for a standard bathroom up to around 5m². Your fixed, itemised quote follows a free survey.",
  "packages": [
    {
      "id": "a",
      "name": "Essential",
      "from": 7950,
      "summary": "A complete, beautifully finished bathroom.",
      "includes": [
        "Full strip-out and disposal",
        "Plumbing and electrical first and second fix",
        "Stone-effect porcelain, floor to ceiling",
        "Walk-in shower or bath, wall-hung WC",
        "Vanity unit and LED mirror"
      ]
    },
    {
      "id": "b",
      "name": "Signature",
      "from": 12950,
      "summary": "Light built into the room. The balance most bathrooms need.",
      "featured": true,
      "includes": [
        "Everything in Essential",
        "Lit shower niche and LED plinth lighting",
        "Floating vanity with stone trough basin",
        "Brushed brass brassware throughout",
        "Electric underfloor heating"
      ]
    },
    {
      "id": "c",
      "name": "Prestige",
      "from": 18950,
      "summary": "Fully bespoke. Stone, light and detail with no compromise.",
      "includes": [
        "Everything in Signature",
        "Built-in stone shower bench, under-lit",
        "Ceiling rain shower, concealed controls",
        "Inlaid compass-star stone floor",
        "3D design visual before we build"
      ]
    }
  ],
  "groups": [
    {
      "id": "finish",
      "title": "Finish",
      "type": "single",
      "options": [
        {
          "id": "light",
          "name": "Light",
          "note": "Warm cream marble, soft light.",
          "price": 0
        },
        {
          "id": "dark",
          "name": "Dark",
          "note": "Grey and onyx stone, gold glow.",
          "price": 0
        },
        {
          "id": "stone",
          "name": "Natural marble",
          "note": "Real stone instead of porcelain.",
          "price": {
            "a": 3500,
            "b": 2900,
            "c": 1900
          }
        }
      ]
    },
    {
      "id": "shower",
      "title": "Shower",
      "type": "multi",
      "options": [
        {
          "id": "screen",
          "name": "Brass-framed walk-in screen",
          "note": "Slim brushed brass frame, clear glass.",
          "price": {
            "a": 650,
            "b": 0,
            "c": 0
          }
        },
        {
          "id": "rain",
          "name": "Ceiling rain shower",
          "note": "Flush ceiling head plus hand shower.",
          "price": {
            "a": 850,
            "b": 750,
            "c": 0
          }
        },
        {
          "id": "bench",
          "name": "Stone shower bench",
          "note": "Built in, with LED glow beneath.",
          "price": {
            "a": 1450,
            "b": 1250,
            "c": 0
          }
        },
        {
          "id": "niche",
          "name": "Lit shower niche",
          "note": "Recessed shelving with LED edge light.",
          "price": {
            "a": 450,
            "b": 0,
            "c": 0
          }
        }
      ]
    },
    {
      "id": "light",
      "title": "Lighting",
      "type": "multi",
      "options": [
        {
          "id": "plinth",
          "name": "LED plinth lighting",
          "note": "Floating glow under vanity and bench.",
          "price": {
            "a": 380,
            "b": 0,
            "c": 0
          }
        },
        {
          "id": "mirror",
          "name": "Backlit feature mirror",
          "note": "Halo-lit, demisting, made to size.",
          "price": {
            "a": 0,
            "b": 0,
            "c": 0
          }
        },
        {
          "id": "sconce",
          "name": "Onyx wall light",
          "note": "Glowing stone sconce beside the mirror.",
          "price": 420
        },
        {
          "id": "cove",
          "name": "Perimeter light lines",
          "note": "Concealed LED tracing the walls.",
          "price": {
            "a": 790,
            "b": 690,
            "c": 0
          }
        }
      ]
    },
    {
      "id": "floor",
      "title": "Floor & warmth",
      "type": "multi",
      "options": [
        {
          "id": "ufh",
          "name": "Underfloor heating",
          "note": "Electric mat with smart thermostat.",
          "price": {
            "a": 690,
            "b": 0,
            "c": 0
          }
        },
        {
          "id": "star",
          "name": "Inlaid compass-star floor",
          "note": "Our signature stone inlay.",
          "price": {
            "a": 1950,
            "b": 1750,
            "c": 0
          }
        },
        {
          "id": "border",
          "name": "Stone border inlay",
          "note": "Contrast stone band framing the floor.",
          "price": 850
        },
        {
          "id": "rail",
          "name": "Brushed brass towel rail",
          "note": "Tall heated ladder rail.",
          "price": {
            "a": 420,
            "b": 0,
            "c": 0
          }
        }
      ]
    },
    {
      "id": "fit",
      "title": "Vanity & fittings",
      "type": "multi",
      "options": [
        {
          "id": "trough",
          "name": "Stone trough vanity",
          "note": "Floating timber unit, stone basin.",
          "price": {
            "a": 1350,
            "b": 0,
            "c": 0
          }
        },
        {
          "id": "brass",
          "name": "Brushed brass fittings",
          "note": "Taps, valves, flush plate, accessories.",
          "price": {
            "a": 750,
            "b": 0,
            "c": 0
          }
        },
        {
          "id": "fluted",
          "name": "Fluted feature panel",
          "note": "Vertical slatted wall panel.",
          "price": 980
        },
        {
          "id": "visual",
          "name": "3D design visual",
          "note": "See the room before we build it.",
          "price": {
            "a": 450,
            "b": 350,
            "c": 0
          }
        }
      ]
    }
  ]
};
