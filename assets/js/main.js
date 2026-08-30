/* ==========================================================================
   UNICK'S — site behaviour + motion engine
   --------------------------------------------------------------------------
   SETUP: fill these two in to make the enquiry form live.

   FORM_ENDPOINT — a form-handling URL (Formspree, Basin, Netlify Forms,
                   Getform…). Enquiries are POSTed here. Leave empty to fall
                   back to opening the visitor's email client instead.
   CONTACT_EMAIL — the inbox enquiries should reach. Used for the mailto
                   fallback when no endpoint is set.
   ========================================================================== */
var FORM_ENDPOINT = '';
var CONTACT_EMAIL = '';

(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp  = function (a, b, t) { return a + (b - a) * t; };

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE    = window.matchMedia('(pointer: fine)').matches;

  /* ======================================================================
     1. DAMPED SCROLL
     Wheel input is captured and eased toward a target, then written back
     with window.scrollTo. Native scrollbar, keyboard, anchors and
     IntersectionObserver all keep working because real scroll still moves.
     Desktop pointers only — touch already has momentum of its own.
     ====================================================================== */
  var scrollY = window.scrollY || 0;
  var LERP_ON = FINE && !REDUCED;

  if (LERP_ON) {
    document.documentElement.classList.add('has-lerp');

    var target  = scrollY;
    var current = scrollY;
    var wheeling = false;
    var settleTimer = null;
    var maxScroll = function () {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    };

    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey) return;                       // let pinch-zoom through
      if (e.target.closest && e.target.closest('.drawer.is-open')) return;
      e.preventDefault();
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 16;              // lines -> px
      else if (e.deltaMode === 2) d *= window.innerHeight;
      target = clamp(target + d, 0, maxScroll());
      wheeling = true;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(function () { wheeling = false; }, 140);
    }, { passive: false });

    // Anything that moves the page without the wheel (scrollbar drag, keys,
    // find-in-page) must not fight the loop — adopt its position instead.
    window.addEventListener('scroll', function () {
      if (!wheeling && Math.abs(window.scrollY - current) > 2) {
        current = target = window.scrollY;
      }
    }, { passive: true });

    window.addEventListener('resize', function () {
      target = clamp(target, 0, maxScroll());
    });

    // Eased anchor navigation
    var glideTo = function (y) {
      target = clamp(y, 0, maxScroll());
      wheeling = true;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(function () { wheeling = false; }, 900);
    };
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id === '#' || id.length < 2) return;
        var el = document.getElementById(id.slice(1));
        if (!el) return;
        e.preventDefault();
        glideTo(el.getBoundingClientRect().top + window.scrollY);
      });
    });

    (function tick() {
      current = lerp(current, target, 0.098);
      if (Math.abs(target - current) < 0.08) current = target;
      if (Math.abs(window.scrollY - current) > 0.05) window.scrollTo(0, current);
      scrollY = current;
      requestAnimationFrame(tick);
    })();
  } else {
    window.addEventListener('scroll', function () { scrollY = window.scrollY; }, { passive: true });
  }

  /* ======================================================================
     2. SPLIT HEADINGS INTO WORDS
     Each word gets a clipping wrapper so it can rise out from behind its
     own baseline. Nested markup (<em>, <span>) is preserved.
     ====================================================================== */
  var splitWords = function (root) {
    var idx = 0;
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var text = n.nodeValue;
          if (!text.trim()) return;
          var frag = document.createDocumentFragment();
          text.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
            var outer = document.createElement('span');
            outer.className = 'w';
            var inner = document.createElement('span');
            inner.className = 'w__i';
            inner.textContent = part;
            inner.style.setProperty('--wi', idx++);
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && !n.classList.contains('w')) {
          walk(n);
        }
      });
    };
    walk(root);
  };

  if (!REDUCED) $$('[data-split]').forEach(splitWords);

  /* ======================================================================
     3. REVEALS — staggered per group, not all at once
     ====================================================================== */
  var revealables = $$('.rv, [data-rv], [data-split], .step').filter(function (el) {
    return !el.closest('.hero');      // the intro sequence drives these
  });

  // give siblings inside a group an increasing --i so they cascade
  $$('.trust__grid, .svc, .steps, .grid, .quotes, .dl, .faq, .contact__list').forEach(function (group) {
    var i = 0;
    Array.prototype.slice.call(group.children).forEach(function (child) {
      if (child.matches('.rv, [data-rv], .step, li')) child.style.setProperty('--i', i++);
    });
  });

  if (REDUCED || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -10% 0px' });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ======================================================================
     4. PARALLAX — layered depth, read once per frame
     ====================================================================== */
  var paraEls = $$('[data-para]');
  var heroImg = $('.hero__bg img');

  if (!REDUCED && (paraEls.length || heroImg)) {
    var vh = window.innerHeight;
    window.addEventListener('resize', function () { vh = window.innerHeight; });

    var enterFrom = null;                       // hero entrance easing
    var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

    (function paraTick(now) {
      if (heroImg && scrollY < vh * 1.4) {
        if (enterFrom === null && document.body.dataset.heroIn) enterFrom = now || 0;
        var e = enterFrom === null ? 0 : easeOut(clamp(((now || 0) - enterFrom) / 2000, 0, 1));
        var scale = (1.12 - 0.12 * e) + Math.min(scrollY / vh, 1) * 0.06;
        heroImg.style.transform =
          'translate3d(0,' + (scrollY * 0.2).toFixed(2) + 'px,0) scale(' + scale.toFixed(4) + ')';
      }
      paraEls.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        var speed = parseFloat(el.dataset.para) || 0.1;
        var delta = ((r.top + r.height / 2) - vh / 2) / vh;   // -1 … 1
        el.style.transform = 'translate3d(0,' + (delta * speed * 100).toFixed(2) + 'px,0)';
      });
      requestAnimationFrame(paraTick);
    })(0);
  }

  /* ======================================================================
     5. SCROLL PROGRESS
     ====================================================================== */
  var prog = $('.prog');
  if (prog && !REDUCED) {
    (function progTick() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.transform = 'scaleX(' + (max > 0 ? clamp(scrollY / max, 0, 1) : 0).toFixed(4) + ')';
      requestAnimationFrame(progTick);
    })();
  }

  /* ======================================================================
     6. CUSTOM CURSOR — trailing ring, swells over interactive targets
     ====================================================================== */
  var dot = $('.cur'), ring = $('.cur-r');
  if (dot && ring && FINE && !REDUCED) {
    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var rx = mx, ry = my, seen = false;

    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (!seen) { seen = true; rx = mx; ry = my; document.body.classList.add('cursor-on'); }
    });
    document.addEventListener('mouseleave', function () { document.body.classList.remove('cursor-on'); });
    document.addEventListener('mouseenter', function () { if (seen) document.body.classList.add('cursor-on'); });

    var hot = 'a, button, input, select, textarea, label, .tile, .dl__panel';
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest(hot)) document.body.classList.add('cur-hot');
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest(hot)) document.body.classList.remove('cur-hot');
    });

    (function curTick() {
      rx = lerp(rx, mx, 0.16); ry = lerp(ry, my, 0.16);
      dot.style.transform  = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      ring.style.transform = 'translate3d(' + rx.toFixed(2) + 'px,' + ry.toFixed(2) + 'px,0)';
      requestAnimationFrame(curTick);
    })();
  }

  /* ======================================================================
     7. INTRO SEQUENCE — once per session, then hand off to the hero
     ====================================================================== */
  var intro = $('.intro');
  var startHero = function () {
    $$('.hero .rv, .hero [data-split]').forEach(function (el) { el.classList.add('is-in'); });
    document.body.dataset.heroIn = '1';
  };
  if (intro) {
    if (REDUCED || sessionStorage.getItem('unicks_seen')) {
      intro.remove();
      startHero();
    } else {
      document.body.style.overflow = 'hidden';
      window.setTimeout(function () {
        intro.classList.add('is-done');
        document.body.style.overflow = '';
        try { sessionStorage.setItem('unicks_seen', '1'); } catch (err) {}
        startHero();
        window.setTimeout(function () { intro.remove(); }, 1000);
      }, 1500);
    }
  } else {
    startHero();
  }

  /* ======================================================================
     8. CHROME — year, header, drawer
     ====================================================================== */
  var yr = $('#yr');
  if (yr) yr.textContent = new Date().getFullYear();

  var hdr = $('#hdr');
  var onScroll = function () { if (hdr) hdr.classList.toggle('is-stuck', window.scrollY > 40); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  var burger = $('#burger'), drawer = $('#drawer');
  var closeDrawer = function () {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    document.body.style.overflow = '';
  };
  if (burger && drawer) {
    burger.addEventListener('click', function () {
      var open = drawer.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    $$('a', drawer).forEach(function (a) { a.addEventListener('click', closeDrawer); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
  }

  /* ---------- Portfolio filter ---------- */
  var filters = $$('.filter'), tiles = $$('#grid .tile');
  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cat = btn.dataset.filter;
      filters.forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      var i = 0;
      tiles.forEach(function (t) {
        var hide = cat !== 'all' && t.dataset.cat !== cat;
        t.classList.toggle('is-hidden', hide);
        if (!hide) t.style.setProperty('--i', i++);
      });
    });
  });

  /* ---------- FAQ accordion ---------- */
  $$('.faq__item').forEach(function (item) {
    var q = $('.faq__q', item), a = $('.faq__a', item);
    if (!q || !a) return;
    q.addEventListener('click', function () {
      var open = item.classList.contains('is-open');
      $$('.faq__item').forEach(function (o) {
        o.classList.remove('is-open');
        var oa = $('.faq__a', o), oq = $('.faq__q', o);
        if (oa) oa.style.maxHeight = null;
        if (oq) oq.setAttribute('aria-expanded', 'false');
      });
      if (!open) {
        item.classList.add('is-open');
        a.style.maxHeight = a.scrollHeight + 'px';
        q.setAttribute('aria-expanded', 'true');
      }
    });
  });
  window.addEventListener('resize', function () {
    var open = $('.faq__item.is-open .faq__a');
    if (open) open.style.maxHeight = open.scrollHeight + 'px';
  });

  /* ======================================================================
     9. ENQUIRY FORM
     ====================================================================== */
  var form = $('#form');
  if (!form) return;
  var msg = $('#formMsg'), btn = $('#submitBtn');

  var setMsg = function (text, ok) {
    if (!msg) return;
    msg.textContent = text;
    msg.className = 'form__msg ' + (ok ? 'is-ok' : 'is-err');
    msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  var fieldOf = function (el) { return el.closest('.field') || el.closest('.consent'); };

  var validate = function () {
    var ok = true, firstBad = null;
    $$('[required]', form).forEach(function (el) {
      var wrap = fieldOf(el);
      var good = el.type === 'checkbox' ? el.checked : el.value.trim() !== '';
      if (good && el.type === 'email') good = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim());
      if (good && el.type === 'tel') good = el.value.replace(/[^0-9]/g, '').length >= 7;
      if (wrap) wrap.classList.toggle('has-error', !good);
      if (!good) { ok = false; if (!firstBad) firstBad = el; }
    });
    if (firstBad) firstBad.focus();
    return ok;
  };

  $$('[required]', form).forEach(function (el) {
    el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', function () {
      var wrap = fieldOf(el);
      if (wrap) wrap.classList.remove('has-error');
    });
  });

  var mailtoFallback = function (d) {
    var lines = [
      'Name: ' + d.name, 'Phone: ' + d.phone, 'Email: ' + d.email,
      'Postcode: ' + d.postcode, 'Project: ' + d.project,
      'Budget: ' + d.budget, 'Start: ' + d.timing, '',
      'About the project:', d.message || '(none given)'
    ].join('\n');
    window.location.href = 'mailto:' + CONTACT_EMAIL +
      '?subject=' + encodeURIComponent('Consultation request — ' + d.name) +
      '&body=' + encodeURIComponent(lines);
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) { setMsg('Please check the highlighted fields and try again.', false); return; }

    var fd = new FormData(form), data = {};
    fd.forEach(function (v, k) { data[k] = v; });

    if (data.company) { setMsg('Thank you — your request has been sent.', true); form.reset(); return; }

    if (!FORM_ENDPOINT) {
      if (CONTACT_EMAIL) {
        mailtoFallback(data);
        setMsg('Opening your email app to send this enquiry…', true);
      } else {
        setMsg('This form is not connected yet — set FORM_ENDPOINT or CONTACT_EMAIL in assets/js/main.js.', false);
      }
      return;
    }

    btn.disabled = true;
    var labelEl = btn.querySelector('.btn__t') || btn;
    var label = labelEl.textContent;
    labelEl.textContent = 'Sending…';

    fetch(FORM_ENDPOINT, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('Bad response');
        form.reset();
        setMsg('Thank you — your request has been sent. We will be in touch shortly.', true);
      })
      .catch(function () {
        setMsg('Something went wrong sending that. Please try again, or reach us on Instagram @custombyunicks.', false);
      })
      .then(function () { btn.disabled = false; labelEl.textContent = label; });
  });
})();
