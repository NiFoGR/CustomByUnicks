/* ==========================================================================
   UNICKS site behaviour
   --------------------------------------------------------------------------
   SETUP: fill in one of these to make the enquiry forms live.

   FORM_ENDPOINT  a form service URL (Formspree, Web3Forms, Basin).
                  Enquiries are POSTed there. Preferred.
   CONTACT_EMAIL  fallback only: opens the visitor's own email app.
   ========================================================================== */
var FORM_ENDPOINT = '';
var CONTACT_EMAIL = '';

(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DATA = window.UNICKS_DATA;
  var ARROW = '<svg viewBox="0 0 15 10" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M1 5h12M9.5 1.5L13 5 9.5 8.5"/></svg>';
  var TICK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3.5"/></svg>';

  var money = function (n) { return DATA.currency + Math.round(n).toLocaleString('en-GB'); };
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  };

  clearTimeout(window.__uFallback);
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Opening: logo, gold line, curtain up (first page of a visit only) ---------- */
  // Text and header are revealed by the small script in <head> as soon as the fonts arrive
  // (html.is-loaded). The main photo only wipes in once it has actually downloaded (html.is-photo).
  var root = document.documentElement, intro = $('.intro');
  var photo = $('.hero__media img.is-on, .pagehead__bg img');
  var photoReady = !photo ? Promise.resolve() : photo.complete ? (photo.decode ? photo.decode().catch(function () {}) : Promise.resolve())
    : new Promise(function (r) { photo.addEventListener('load', r, { once: true }); photo.addEventListener('error', r, { once: true }); });
  if (intro && !root.classList.contains('no-intro')) {
    try { sessionStorage.setItem('unicks-intro', '1'); } catch (e) {}
    document.body.style.overflow = 'hidden';
    // keep the opening up for at least 1.5s, and until the photo is in (but never past 2.6s)
    Promise.all([new Promise(function (r) { setTimeout(r, 1500); }), Promise.race([photoReady, new Promise(function (r) { setTimeout(r, 2600); })])]).then(function () {
      intro.classList.add('is-out');
      setTimeout(function () { document.body.style.overflow = ''; root.classList.add('is-loaded'); }, 150);
      setTimeout(function () { intro.remove(); }, 1400);
      photoReady.then(function () { setTimeout(function () { root.classList.add('is-photo'); }, 150); });
    });
  } else {
    root.classList.add('is-loaded');
    photoReady.then(function () { requestAnimationFrame(function () { root.classList.add('is-photo'); }); });
  }

  /* ---------- Header: clear over the hero, solid once you scroll ---------- */
  var hdr = $('[data-hdr]'), ticking = false;
  var onScroll = function () { hdr.classList.toggle('is-solid', window.scrollY > 24); ticking = false; };
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var burger = $('.burger'), drawer = $('#drawer');
  if (burger && drawer) {
    var setMenu = function (open) {
      burger.setAttribute('aria-expanded', open);
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      drawer.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
    $$('a', drawer).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { setMenu(false); burger.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 940) setMenu(false); });
  }

  /* ---------- Hero slides ---------- */
  var slides = $('[data-slides]');
  if (slides) {
    var imgs = $$('img', slides), dots = $$('.hero__dots button', slides), cur = 0, timer;
    var show = function (i) {
      imgs[cur].classList.remove('is-on'); dots[cur].removeAttribute('aria-current');
      cur = (i + imgs.length) % imgs.length;
      imgs[cur].classList.add('is-on'); dots[cur].setAttribute('aria-current', 'true');
    };
    var play = function () {
      clearInterval(timer);
      if (!REDUCED) timer = setInterval(function () { show(cur + 1); }, 6500);
    };
    dots.forEach(function (d, i) { d.addEventListener('click', function () { show(i); play(); }); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) clearInterval(timer); else play(); });
    play();
  }

  /* ---------- Project rail ---------- */
  var rail = $('#rail');
  if (rail) {
    var prev = $('[data-rail="-1"]'), next = $('[data-rail="1"]');
    var edges = function () {
      prev.disabled = rail.scrollLeft < 8;
      next.disabled = rail.scrollLeft + rail.clientWidth > rail.scrollWidth - 8;
    };
    [prev, next].forEach(function (b) {
      b.addEventListener('click', function () {
        var step = rail.firstElementChild.getBoundingClientRect().width + 24;
        rail.scrollBy({ left: step * Number(b.dataset.rail), behavior: REDUCED ? 'auto' : 'smooth' });
      });
    });
    rail.addEventListener('scroll', edges, { passive: true });
    window.addEventListener('resize', edges);
    edges();
  }

  /* ---------- Package cards ---------- */
  var tierHTML = function (p, i, action) {
    return '<span class="tier__tag">Package ' + String.fromCharCode(65 + i) + '</span>' +
      (p.featured ? '<span class="tier__flag">Recommended</span>' : '') +
      '<h3>' + esc(p.name) + '</h3>' +
      '<p class="tier__sum">' + esc(p.summary) + '</p>' +
      '<div class="tier__price"><small>From</small>' + money(p.from) + '</div>' +
      '<ul>' + p.includes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' + action;
  };

  var teaser = $('#teaser');
  if (teaser && DATA) {
    teaser.innerHTML = DATA.packages.map(function (p, i) {
      return '<article class="tier rv' + (p.featured ? ' is-featured' : '') + '">' +
        tierHTML(p, i, '<a class="btn' + (p.featured ? ' btn--solid' : '') + '" href="packages.html?p=' + p.id + '#customise">Price ' + esc(p.name) + ' ' + ARROW + '</a>') +
        '</article>';
    }).join('');
  }

  /* ======================================================================
     CONFIGURATOR
     State lives in the URL (?p=b&finish=dark&o=bench,rain) so a choice can
     be shared, bookmarked and sent with the enquiry.
     ====================================================================== */
  var tiersEl = $('#tiers');
  var buildText = '';
  if (tiersEl && DATA) {
    var state = { pkg: null, single: {}, multi: {} };
    var pkgById = function (id) { return DATA.packages.filter(function (p) { return p.id === id; })[0] || null; };
    var priceOf = function (opt) {
      if (typeof opt.price === 'number') return opt.price;
      if (!state.pkg) return null;
      var v = opt.price[state.pkg.id];
      return v === undefined ? null : v;
    };

    DATA.groups.forEach(function (g) { if (g.type === 'single') state.single[g.id] = g.options[0].id; });

    var q = new URLSearchParams(location.search);
    state.pkg = pkgById(q.get('p'));
    DATA.groups.forEach(function (g) {
      var want = q.get(g.id);
      if (g.type === 'single' && g.options.some(function (o) { return o.id === want; })) state.single[g.id] = want;
    });
    (q.get('o') || '').split(',').forEach(function (id) { if (id) state.multi[id] = true; });

    tiersEl.innerHTML = DATA.packages.map(function (p, i) {
      return '<article class="tier rv' + (p.featured ? ' is-featured' : '') + '" data-pkg="' + p.id + '">' +
        tierHTML(p, i, '<button type="button" class="btn" aria-pressed="false">Choose ' + esc(p.name) + '</button>') + '</article>';
    }).join('');

    $('#groups').innerHTML = DATA.groups.map(function (g) {
      return '<fieldset class="ogroup"><legend>' + esc(g.title) + '</legend><div class="opts">' +
        g.options.map(function (o) {
          var type = g.type === 'single' ? 'radio' : 'checkbox';
          return '<label class="opt" data-type="' + g.type + '" data-opt="' + o.id + '">' +
            '<input type="' + type + '" name="' + (g.type === 'single' ? g.id : o.id) + '" value="' + o.id + '">' +
            '<span class="opt__box">' + TICK + '</span>' +
            '<span><span class="opt__name">' + esc(o.name) + '</span><span class="opt__note">' + esc(o.note) + '</span></span>' +
            '<span class="opt__price"></span></label>';
        }).join('') + '</div></fieldset>';
    }).join('');

    var optEls = {};
    $$('.opt').forEach(function (el) { optEls[el.dataset.opt] = el; });
    $$('[data-sum-note]').forEach(function (el) { el.textContent = DATA.note; });

    // the total counts up or down to its new value instead of jumping
    var shown = 0, tween;
    var showTotal = function (to) {
      var els = $$('[data-sum-total]');
      if (REDUCED || !shown) { shown = to; els.forEach(function (el) { el.textContent = money(to); }); return; }
      var from = shown, t0 = performance.now();
      cancelAnimationFrame(tween);
      (function step(t) {
        var k = Math.min(1, (t - t0) / 500), e = 1 - Math.pow(1 - k, 4);
        shown = from + (to - from) * e;
        els.forEach(function (el) { el.textContent = money(shown); });
        if (k < 1) tween = requestAnimationFrame(step);
      })(t0);
    };

    var syncURL = function () {
      if (!state.pkg) return;
      var p = new URLSearchParams();
      p.set('p', state.pkg.id);
      DATA.groups.forEach(function (g) {
        if (g.type === 'single' && state.single[g.id] !== g.options[0].id) p.set(g.id, state.single[g.id]);
      });
      var picked = Object.keys(state.multi).filter(function (k) {
        return state.multi[k] && optEls[k] && !optEls[k].hidden && !optEls[k].classList.contains('is-incl');
      });
      if (picked.length) p.set('o', picked.join(','));
      history.replaceState(null, '', location.pathname + '?' + p.toString().replace(/%2C/g, ',') + location.hash);
    };

    var bar = $('.pbar'), updateBar = function () {};
    var render = function () {
      var has = !!state.pkg;
      $('#cfg').classList.toggle('is-locked', !has);
      $('#cfg-hint').textContent = has
        ? 'Anything already in your package is ticked. Add whatever else you want.'
        : 'Choose a package above to see the extras.';
      $$('[data-pkg]').forEach(function (card) {
        var on = has && card.dataset.pkg === state.pkg.id;
        card.classList.toggle('is-picked', on);
        $('button', card).setAttribute('aria-pressed', on);
      });

      var total = has ? state.pkg.from : 0, lines = [], text = [];
      if (has) {
        lines.push([state.pkg.name + ' package', money(state.pkg.from)]);
        text.push('Package: ' + state.pkg.name + ' (from ' + money(state.pkg.from) + ')');
      }

      DATA.groups.forEach(function (g) {
        g.options.forEach(function (o) {
          var el = optEls[o.id], input = $('input', el), p = priceOf(o);
          el.hidden = p === null;
          if (p === null) { input.checked = false; return; }
          var incl = p === 0, on, price = $('.opt__price', el);
          price.textContent = incl ? 'Included' : '+' + money(p);
          price.classList.toggle('is-zero', incl);
          if (g.type === 'single') {
            on = state.single[g.id] === o.id;
            input.checked = on;
            if (on) {
              lines.push([g.title + ': ' + o.name, incl ? 'Included' : '+' + money(p)]);
              text.push(g.title + ': ' + o.name + (incl ? '' : ' (+' + money(p) + ')'));
            }
          } else {
            on = incl || !!state.multi[o.id];
            input.checked = on;
            input.disabled = incl;
            el.classList.toggle('is-incl', incl);
            if (on && !incl) {
              lines.push([o.name, '+' + money(p)]);
              text.push('+ ' + o.name + ' (' + money(p) + ')');
            }
          }
          if (on && has) total += p;
        });
      });

      $$('[data-sum-name]').forEach(function (el) { el.textContent = has ? state.pkg.name : 'No package yet'; });
      showTotal(total);
      $('[data-sum-lines]').innerHTML = lines.length
        ? lines.map(function (l) { return '<li><span>' + esc(l[0]) + '</span><span>' + esc(l[1]) + '</span></li>'; }).join('')
        : '<li class="is-empty">Choose a package to start.</li>';

      $$('.stepper a').forEach(function (a) {
        var n = Number(a.dataset.step);
        a.classList.toggle('is-done', (n === 1 && has) || (n === 2 && has && lines.length > 2));
      });
      bar.classList.toggle('has-pkg', has);
      updateBar();

      buildText = has ? text.concat(['Guide price: ' + money(total)]).join('\n') : '';
      syncURL();
    };

    tiersEl.addEventListener('click', function (e) {
      var card = e.target.closest('[data-pkg]');
      if (!card) return;
      var first = !state.pkg;
      state.pkg = pkgById(card.dataset.pkg);
      render();
      if (first || window.innerWidth < 1120) {
        $('#customise').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
      }
    });

    $('#groups').addEventListener('change', function (e) {
      var input = e.target;
      if (input.type === 'radio') state.single[input.name] = input.value;
      else state.multi[input.value] = input.checked;
      render();
    });

    var share = $('[data-share]');
    share.addEventListener('click', function () {
      var url = location.href.split('#')[0];
      var done = function () { share.textContent = 'Link copied'; setTimeout(function () { share.textContent = 'Copy a link to this'; }, 2200); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copy this link', url); });
      else window.prompt('Copy this link', url);
    });

    // mobile price bar: shows once a package is chosen, hides over the top of the page and the form
    var sendVisible = false, topVisible = true;
    updateBar = function () { bar.classList.toggle('is-on', bar.classList.contains('has-pkg') && !sendVisible && !topVisible); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { sendVisible = es[0].isIntersecting; updateBar(); }).observe($('#send'));
      new IntersectionObserver(function (es) { topVisible = es[0].isIntersecting; updateBar(); }).observe($('.pagehead'));
    }

    render();
  }

  /* ---------- Reveal on scroll, staggered within each group ---------- */
  // section headings rise out of a mask: wrap their text once
  $$('h2.rv').forEach(function (h) { h.innerHTML = '<span class="mask"><span>' + h.innerHTML + '</span></span>'; });
  var rv = $$('.rv, [data-reveal]').filter(function (el) { return !el.closest('#rail'); }), groups = new Map();
  rv.forEach(function (el) {
    var n = groups.get(el.parentElement) || 0;
    el.style.setProperty('--i', Math.min(n, 5));
    groups.set(el.parentElement, n + 1);
  });
  if ('IntersectionObserver' in window && !REDUCED) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    rv.forEach(function (el) { io.observe(el); });
  } else {
    rv.forEach(function (el) { el.classList.add('is-in'); });
  }
  if (rail) {
    var cards = $$('.work', rail);
    cards.forEach(function (c, i) { c.style.setProperty('--i', Math.min(i, 2)); });
    var showRail = function () { cards.forEach(function (c) { c.classList.add('is-in'); }); };
    if ('IntersectionObserver' in window && !REDUCED) {
      var rio = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { showRail(); rio.disconnect(); } }, { rootMargin: '0px 0px -10% 0px' });
      rio.observe(rail);
    } else { showRail(); }
  }

  /* ---------- Depth: things move at different speeds as you scroll ---------- */
  if (!REDUCED) {
    var hero = $('.hero__media');
    var layers = $$('[data-parallax]');                 // move the element itself
    var inner = $$('.door, .work__img');                 // move the photo inside its frame
    var star = $('[data-spin]');
    var vh = window.innerHeight, queued = false;
    var offset = function (el) { var r = el.getBoundingClientRect(); return r.bottom < -200 || r.top > vh + 200 ? null : r.top + r.height / 2 - vh / 2; };
    // photos are drawn at 110% of their frame, so each has 5% spare on every side; stay inside 90% of it
    var clamp = function (v, el) { var m = el.offsetHeight * 0.045; return Math.max(-m, Math.min(m, v)); };
    var wide = window.matchMedia('(min-width: 941px)');
    var frame = function () {
      queued = false;
      if (hero) { var hy = window.scrollY; if (hy < vh * 1.2) hero.style.setProperty('--dy', clamp(hy * 0.12, hero).toFixed(1) + 'px'); }
      layers.forEach(function (el) {
        var o = wide.matches ? offset(el) : 0;
        if (o !== null) el.style.setProperty('--py', (o * parseFloat(el.dataset.parallax)).toFixed(1) + 'px');
      });
      inner.forEach(function (el) { var o = offset(el); if (o !== null) el.style.setProperty('--dy', clamp(o * -0.06, el).toFixed(1) + 'px'); });
      if (star) { var o = offset(star.parentElement); if (o !== null) star.style.setProperty('--rot', (o * -0.04).toFixed(2) + 'deg'); }
    };
    var queue = function () { if (!queued) { queued = true; requestAnimationFrame(frame); } };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', function () { vh = window.innerHeight; queue(); });
    if (rail) rail.addEventListener('scroll', queue, { passive: true });
    frame();
  }

  /* ---------- Forms ---------- */
  $$('[data-form]').forEach(function (form) {
    var msg = $('.form__msg', form), btn = $('[type="submit"]', form);

    var setMsg = function (text, ok) {
      msg.textContent = text;
      msg.className = 'form__msg is-on' + (ok ? ' is-ok' : '');
      msg.focus({ preventScroll: true });
      msg.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
    };

    var validate = function () {
      var firstBad = null;
      $$('[required]', form).forEach(function (el) {
        var v = el.value.trim(), good = v !== '';
        if (good && el.type === 'email') good = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
        if (good && el.type === 'tel') good = v.replace(/\D/g, '').length >= 10;
        el.closest('.field').classList.toggle('is-bad', !good);
        el.setAttribute('aria-invalid', !good);
        if (!good && !firstBad) firstBad = el;
      });
      if (firstBad) firstBad.focus();
      return !firstBad;
    };
    $$('[required]', form).forEach(function (el) {
      el.addEventListener('input', function () {
        el.closest('.field').classList.remove('is-bad');
        el.removeAttribute('aria-invalid');
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) return;
      if (form.hasAttribute('data-build')) {
        form.elements.build.value = buildText;
        form.elements.build_link.value = buildText ? location.href.split('#')[0] : '';
      }

      var fd = new FormData(form);
      if (fd.get('company')) { form.reset(); setMsg('Thanks. We\'ll be in touch soon.', true); return; }

      if (!FORM_ENDPOINT) {
        if (!CONTACT_EMAIL) {
          console.warn('Form not connected: set FORM_ENDPOINT or CONTACT_EMAIL in assets/js/main.js');
          setMsg('Online booking isn\'t switched on yet. Please message us on Instagram @custombyunicks.');
          return;
        }
        var body = ['Name: ' + fd.get('name'), 'Phone: ' + fd.get('phone'), 'Email: ' + fd.get('email'),
          'Postcode: ' + fd.get('postcode'), 'Found us via: ' + (fd.get('source') || 'not given'), '', fd.get('message') || ''];
        if (fd.get('build')) body.push('', 'Package and extras:', fd.get('build'), fd.get('build_link'));
        location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent('Survey request from ' + fd.get('name')) +
          '&body=' + encodeURIComponent(body.join('\n'));
        setMsg('Opening your email app to send this.', true);
        return;
      }

      var label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending';
      fetch(FORM_ENDPOINT, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          var first = String(fd.get('name') || '').trim().split(' ')[0];
          form.reset();
          setMsg('Thanks' + (first ? ', ' + first : '') + '. We\'ve got your request and we\'ll be in touch to book your survey.', true);
        })
        .catch(function () { setMsg('That didn\'t send. Please try again, or message us on Instagram @custombyunicks.'); })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });
  });
})();
