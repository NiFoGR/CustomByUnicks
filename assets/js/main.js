/* ==========================================================================
   UNICKS site behaviour
   --------------------------------------------------------------------------
   SETUP: fill in one of these to make the enquiry forms live.

   FORM_ENDPOINT  a form service URL (Formspree, Web3Forms, Basin...).
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

  var money = function (n) { return '£' + Math.round(n).toLocaleString('en-GB'); };
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  };

  /* ---------- Entrance: hero copy and image settle in once fonts are ready ---------- */
  var loaded = function () { document.body.classList.add('is-loaded'); };
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 600); })]).then(loaded);
  } else { loaded(); }

  /* ---------- Header: solid after the fold starts, hides on scroll down ---------- */
  var hdr = $('[data-hdr]'), lastY = window.scrollY, ticking = false;
  var onScroll = function () {
    var y = window.scrollY;
    hdr.classList.toggle('is-solid', y > 24);
    var menuOpen = document.body.classList.contains('menu-open');
    hdr.classList.toggle('is-hidden', !menuOpen && y > 480 && y > lastY + 4);
    if (y < lastY - 4 || y < 480) hdr.classList.remove('is-hidden');
    lastY = y; ticking = false;
  };
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var burger = $('.burger'), drawer = $('#drawer');
  var setMenu = function (open) {
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    hdr.classList.add('is-solid');
    if (open) {
      drawer.hidden = false;
      requestAnimationFrame(function () { drawer.classList.add('is-open'); });
    } else {
      drawer.classList.remove('is-open');
      setTimeout(function () { if (!drawer.classList.contains('is-open')) drawer.hidden = true; }, 400);
      onScroll();
    }
  };
  burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
  $$('a', drawer).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { setMenu(false); burger.focus(); }
  });

  /* ---------- Reveal on scroll, staggered within each group ---------- */
  var reveal = function (els) {
    var groups = new Map();
    els.forEach(function (el) {
      var p = el.parentElement, n = groups.get(p) || 0;
      el.style.setProperty('--i', Math.min(n, 5));
      groups.set(p, n + 1);
    });
    if (!('IntersectionObserver' in window) || REDUCED) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    els.forEach(function (el) { io.observe(el); });
  };

  /* ---------- Lightbox ---------- */
  var dlg = $('[data-lightbox-dialog]');
  if (dlg && dlg.showModal) {
    var dimg = $('img', dlg);
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lightbox]');
      if (!b) return;
      var img = $('img', b);
      dimg.src = b.dataset.lightbox;
      dimg.alt = img ? img.alt : '';
      dlg.showModal();
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('.lightbox__close')) dlg.close(); });
  }

  /* ======================================================================
     CONFIGURATOR
     State lives in the URL (?p=b&finish=dark&o=bench,rain) so a build can be
     shared, bookmarked and sent with the enquiry.
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

    // tier buttons and option rows are rendered into the HTML by tools/build.py
    var optEls = {};
    $$('.opt').forEach(function (el) { optEls[el.dataset.opt] = el; });

    // the total counts to its new value rather than jumping
    var shown = 0, tween = null;
    var showTotal = function (to) {
      var els = $$('[data-sum-total]');
      if (REDUCED || !shown) { shown = to; els.forEach(function (el) { el.textContent = money(to); }); return; }
      var from = shown, t0 = performance.now(), dur = 520;
      cancelAnimationFrame(tween);
      (function step(t) {
        var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
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
      var picked = Object.keys(state.multi).filter(function (k) { return state.multi[k] && optEls[k] && !optEls[k].hidden && !optEls[k].classList.contains('is-incl'); });
      if (picked.length) p.set('o', picked.join(','));
      history.replaceState(null, '', location.pathname + '?' + p.toString().replace(/%2C/g, ',') + location.hash);
    };

    var bar = $('.pbar');
    var render = function () {
      var has = !!state.pkg;
      $('#cfg').classList.toggle('is-locked', !has);
      $('#cfg').toggleAttribute('inert', !has);
      $('#cfg-hint').textContent = has
        ? 'Anything already in your package is ticked. Add whatever else you want.'
        : 'Choose a package above first.';
      $$('[data-pkg]').forEach(function (b) { b.setAttribute('aria-pressed', has && b.dataset.pkg === state.pkg.id); });

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
          var incl = p === 0, on;
          $('.opt__price', el).textContent = incl ? 'Included' : '+' + money(p);
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
      var b = e.target.closest('[data-pkg]');
      if (!b) return;
      var first = !state.pkg;
      state.pkg = pkgById(b.dataset.pkg);
      render();
      if (first || window.innerWidth < 1180) {
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

    // mobile price bar: shown once a package is chosen, hidden over the hero and the form
    var sendVisible = false, topVisible = true;
    var updateBar = function () { bar.classList.toggle('is-on', bar.classList.contains('has-pkg') && !sendVisible && !topVisible); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { sendVisible = es[0].isIntersecting; updateBar(); }).observe($('#send'));
      new IntersectionObserver(function (es) { topVisible = es[0].isIntersecting; updateBar(); }).observe($('.pagehead'));
    }

    render();
  }

  reveal($$('[data-rv]'));

  /* ---------- Forms ---------- */
  var utm = (function () {
    var q = new URLSearchParams(location.search), out = [];
    ['utm_source', 'utm_medium', 'utm_campaign', 'gclid'].forEach(function (k) { if (q.get(k)) out.push(k + '=' + q.get(k)); });
    try {
      if (out.length) sessionStorage.setItem('unicks_utm', out.join('&'));
      return out.join('&') || sessionStorage.getItem('unicks_utm') || '';
    } catch (e) { return out.join('&'); }
  })();

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
        var v = el.type === 'checkbox' ? el.checked : el.value.trim(), good = !!v;
        if (good && el.type === 'email') good = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
        if (good && el.type === 'tel') good = v.replace(/\D/g, '').length >= 10;
        (el.closest('.field') || el.closest('.consent')).classList.toggle('is-bad', !good);
        el.setAttribute('aria-invalid', !good);
        if (!good && !firstBad) firstBad = el;
      });
      if (firstBad) firstBad.focus();
      return !firstBad;
    };
    $$('[required]', form).forEach(function (el) {
      el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', function () {
        (el.closest('.field') || el.closest('.consent')).classList.remove('is-bad');
        el.removeAttribute('aria-invalid');
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) return;
      form.elements.build.value = buildText;
      form.elements.build_link.value = buildText ? location.href.split('#')[0] : '';
      form.elements.page.value = location.pathname;
      form.elements.utm.value = utm;

      var fd = new FormData(form);
      if (fd.get('company')) { form.reset(); setMsg('Thank you. We will be in touch shortly.', true); return; }

      if (!FORM_ENDPOINT) {
        if (!CONTACT_EMAIL) {
          console.warn('Enquiry form not connected: set FORM_ENDPOINT or CONTACT_EMAIL in assets/js/main.js');
          setMsg('Sorry, online enquiries are not switched on yet. Please message us on Instagram @custombyunicks and we will reply.');
          return;
        }
        var body = ['Name: ' + fd.get('name'), 'Phone: ' + fd.get('phone'), 'Email: ' + fd.get('email'),
          'Postcode: ' + fd.get('postcode'), 'Room: ' + fd.get('room'), 'Found us via: ' + fd.get('source'), '', fd.get('message') || ''];
        if (buildText) body.push('', '--- Package ---', buildText, fd.get('build_link'));
        location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent('Enquiry from ' + fd.get('name')) +
          '&body=' + encodeURIComponent(body.join('\n'));
        setMsg('Opening your email app to send this.', true);
        return;
      }

      var label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending';
      fetch(FORM_ENDPOINT, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          form.reset();
          setMsg('Thank you, ' + (fd.get('name') || '').split(' ')[0] + '. Your enquiry has reached us and we will reply shortly to arrange your survey.', true);
        })
        .catch(function () { setMsg('That did not send. Please try again, or message us on Instagram @custombyunicks.'); })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });
  });
})();
