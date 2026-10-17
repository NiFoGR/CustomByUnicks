/* ==========================================================================
   UNICKS site behaviour
   --------------------------------------------------------------------------
   SETUP: fill in one of these to make the enquiry forms live.

   FORM_ENDPOINT  a form service URL (Formspree, Web3Forms, Basin…).
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
  var ARROW = '<svg viewBox="0 0 14 10" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1 5h11M8.5 1.5L12 5 8.5 8.5"/></svg>';
  var TICK = '<svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3.5"/></svg>';

  var money = function (n) { return DATA.currency + n.toLocaleString('en-GB'); };
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  };

  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Mobile menu ---------- */
  var burger = $('.burger'), drawer = $('#drawer');
  if (burger && drawer) {
    var setMenu = function (open) {
      burger.setAttribute('aria-expanded', open);
      drawer.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
    $$('a', drawer).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  }

  /* ---------- Reveal on scroll ---------- */
  var rv = $$('.rv');
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

  /* ---------- Hero slides ---------- */
  var slides = $('[data-slides]');
  if (slides) {
    var imgs = $$('img', slides), dots = $$('.hero__dots button', slides), cur = 0, timer;
    var show = function (i) {
      imgs[cur].classList.remove('is-on'); dots[cur].removeAttribute('aria-current');
      cur = (i + imgs.length) % imgs.length;
      imgs[cur].classList.add('is-on'); dots[cur].setAttribute('aria-current', 'true');
    };
    var play = function () { if (!REDUCED) { clearInterval(timer); timer = setInterval(function () { show(cur + 1); }, 6000); } };
    dots.forEach(function (d, i) { d.addEventListener('click', function () { show(i); play(); }); });
    play();
  }

  /* ---------- Project rail ---------- */
  var rail = $('#rail');
  if (rail) {
    $$('[data-rail]').forEach(function (b) {
      b.addEventListener('click', function () {
        var step = rail.firstElementChild.getBoundingClientRect().width + 20;
        rail.scrollBy({ left: step * Number(b.dataset.rail), behavior: REDUCED ? 'auto' : 'smooth' });
      });
    });
  }

  /* ---------- Package cards ---------- */
  var tierHTML = function (p, i, inner) {
    return '<span class="tier__tag">Package ' + String.fromCharCode(65 + i) + '</span>' +
      (p.featured ? '<span class="tier__flag">Most popular</span>' : '') +
      '<h3>' + esc(p.name) + '</h3>' +
      '<p class="tier__sum">' + esc(p.summary) + '</p>' +
      '<div class="tier__price"><small>From</small>' + money(p.from) + '</div>' +
      '<ul>' + p.includes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' + inner;
  };

  var teaser = $('#teaser');
  if (teaser && DATA) {
    teaser.innerHTML = DATA.packages.map(function (p, i) {
      return '<article class="tier rv' + (p.featured ? ' is-featured' : '') + '">' +
        tierHTML(p, i, '<a class="btn' + (p.featured ? ' btn--solid' : '') + '" href="packages.html?p=' + p.id + '#customise">Customise ' + ARROW + '</a>') +
        '</article>';
    }).join('');
    $$('.rv', teaser).forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ======================================================================
     CONFIGURATOR
     State lives in the URL (?p=b&f=dark&o=bench,rain) so a build can be
     shared, bookmarked and sent with the enquiry.
     ====================================================================== */
  var tiersEl = $('#tiers');
  var buildText = '';
  if (tiersEl && DATA) {
    var state = { pkg: null, single: {}, multi: {} };
    var pkgById = function (id) { return DATA.packages.filter(function (p) { return p.id === id; })[0] || null; };
    var priceOf = function (opt) {
      if (!state.pkg) return typeof opt.price === 'number' ? opt.price : null;
      if (typeof opt.price === 'number') return opt.price;
      var v = opt.price[state.pkg.id];
      return v === undefined ? null : v;
    };

    // defaults for single-choice groups
    DATA.groups.forEach(function (g) { if (g.type === 'single') state.single[g.id] = g.options[0].id; });

    // restore from URL
    var q = new URLSearchParams(location.search);
    state.pkg = pkgById(q.get('p'));
    DATA.groups.forEach(function (g) {
      if (g.type === 'single') {
        var want = q.get(g.id);
        if (g.options.some(function (o) { return o.id === want; })) state.single[g.id] = want;
      }
    });
    (q.get('o') || '').split(',').forEach(function (id) { if (id) state.multi[id] = true; });

    // build package buttons
    tiersEl.innerHTML = DATA.packages.map(function (p, i) {
      return '<button type="button" class="tier' + (p.featured ? ' is-featured' : '') + '" data-pkg="' + p.id + '" aria-pressed="false">' +
        tierHTML(p, i, '<span class="tier__pick">Choose ' + esc(p.name) + '</span>') + '</button>';
    }).join('');

    // build option groups
    $('#groups').innerHTML = DATA.groups.map(function (g) {
      return '<fieldset class="ogroup"><legend><h3>' + esc(g.title) + '</h3></legend><div class="opts">' +
        g.options.map(function (o) {
          var type = g.type === 'single' ? 'radio' : 'checkbox';
          return '<label class="opt" data-type="' + g.type + '" data-opt="' + o.id + '">' +
            '<input type="' + type + '" name="' + (g.type === 'single' ? g.id : o.id) + '" value="' + o.id + '">' +
            '<span class="opt__box">' + TICK + '</span>' +
            '<span class="opt__txt"><span class="opt__name">' + esc(o.name) + '</span><span class="opt__note">' + esc(o.note) + '</span></span>' +
            '<span class="opt__price"></span></label>';
        }).join('') + '</div></fieldset>';
    }).join('');

    var optEls = {};
    $$('.opt').forEach(function (el) { optEls[el.dataset.opt] = el; });
    $$('[data-sum-note]').forEach(function (el) { el.textContent = DATA.note; });

    var syncURL = function () {
      if (!state.pkg) return;
      var p = new URLSearchParams();
      p.set('p', state.pkg.id);
      DATA.groups.forEach(function (g) {
        if (g.type === 'single' && state.single[g.id] !== g.options[0].id) p.set(g.id, state.single[g.id]);
      });
      var picked = Object.keys(state.multi).filter(function (k) { return state.multi[k]; });
      if (picked.length) p.set('o', picked.join(','));
      history.replaceState(null, '', location.pathname + '?' + p.toString().replace(/%2C/g, ',') + location.hash);
    };

    var render = function () {
      var has = !!state.pkg;
      $('#cfg').classList.toggle('is-locked', !has);
      $('#cfg-hint').textContent = has
        ? 'Included items are already ticked. Add anything else you want.'
        : 'Choose a package above first.';
      $$('[data-pkg]').forEach(function (b) { b.setAttribute('aria-pressed', has && b.dataset.pkg === state.pkg.id); });

      var total = has ? state.pkg.from : 0;
      var lines = [], text = [];
      if (has) {
        lines.push([state.pkg.name + ' package', money(state.pkg.from)]);
        text.push('Package: ' + state.pkg.name + ' (from ' + money(state.pkg.from) + ')');
      }

      DATA.groups.forEach(function (g) {
        g.options.forEach(function (o) {
          var el = optEls[o.id], input = $('input', el), p = priceOf(o);
          el.hidden = p === null;
          if (p === null) { input.checked = false; return; }
          var incl = p === 0;
          var on;
          if (g.type === 'single') {
            on = state.single[g.id] === o.id;
            input.checked = on;
            el.classList.remove('is-incl');
            $('.opt__price', el).textContent = incl ? 'Included' : '+' + money(p);
            if (on) {
              lines.push([g.title + ': ' + o.name, incl ? 'Included' : '+' + money(p)]);
              text.push(g.title + ': ' + o.name + (incl ? '' : ' (+' + money(p) + ')'));
            }
          } else {
            on = incl || !!state.multi[o.id];
            input.checked = on;
            input.disabled = incl;
            el.classList.toggle('is-incl', incl);
            $('.opt__price', el).textContent = incl ? 'Included' : '+' + money(p);
            if (on && !incl) {
              lines.push([o.name, '+' + money(p)]);
              text.push('+ ' + o.name + ' (' + money(p) + ')');
            }
          }
          if (on && has) total += p;
        });
      });

      $$('[data-sum-name]').forEach(function (el) { el.textContent = has ? state.pkg.name : 'No package yet'; });
      $$('[data-sum-total]').forEach(function (el) { el.textContent = money(total); });
      var ul = $('[data-sum-lines]');
      ul.innerHTML = lines.length
        ? lines.map(function (l) { return '<li><span>' + esc(l[0]) + '</span><span>' + esc(l[1]) + '</span></li>'; }).join('')
        : '<li class="is-empty">Choose a package to start.</li>';

      $$('.steps a').forEach(function (a) {
        var n = Number(a.dataset.step);
        a.classList.toggle('is-done', (n === 1 && has) || (n === 2 && has && lines.length > 2));
      });
      $('.pbar').classList.toggle('has-pkg', has);
      updateBar();

      buildText = has ? text.concat(['Guide price: ' + money(total)]).join('\n') : 'No package selected';
      syncURL();
    };

    tiersEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pkg]');
      if (!b) return;
      var first = !state.pkg;
      state.pkg = pkgById(b.dataset.pkg);
      render();
      if (first || window.innerWidth < 1080) {
        $('#customise').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
      }
    });

    $('#groups').addEventListener('change', function (e) {
      var input = e.target, el = input.closest('.opt');
      if (!el) return;
      if (input.type === 'radio') state.single[input.name] = input.value;
      else state.multi[input.value] = input.checked;
      render();
    });

    // share
    var share = $('[data-share]');
    share.addEventListener('click', function () {
      var url = location.href.split('#')[0];
      var done = function () { share.textContent = 'Link copied'; setTimeout(function () { share.textContent = 'Copy link to this build'; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copy this link', url); });
      else window.prompt('Copy this link', url);
    });

    // mobile price bar: visible once a package is chosen, hidden over the form
    var bar = $('.pbar'), sendVisible = false, topVisible = true;
    var updateBar = function () { bar.classList.toggle('is-on', bar.classList.contains('has-pkg') && !sendVisible && !topVisible); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { sendVisible = es[0].isIntersecting; updateBar(); }).observe($('#send'));
      new IntersectionObserver(function (es) { topVisible = es[0].isIntersecting; updateBar(); }).observe($('.cfg-hero'));
    }

    render();
  }

  /* ---------- Forms ---------- */
  $$('[data-form]').forEach(function (form) {
    var msg = $('.form__msg', form), btn = $('[type="submit"]', form);

    var setMsg = function (text) {
      msg.textContent = text;
      msg.classList.add('is-on');
      msg.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
    };

    var validate = function () {
      var firstBad = null;
      $$('[required]', form).forEach(function (el) {
        var v = el.value.trim(), good = v !== '';
        if (good && el.type === 'email') good = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
        if (good && el.type === 'tel') good = v.replace(/\D/g, '').length >= 7;
        el.closest('.field').classList.toggle('is-bad', !good);
        if (!good && !firstBad) firstBad = el;
      });
      if (firstBad) firstBad.focus();
      return !firstBad;
    };
    $$('[required]', form).forEach(function (el) {
      el.addEventListener('input', function () { el.closest('.field').classList.remove('is-bad'); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.hasAttribute('data-build')) {
        form.elements.build.value = buildText;
        form.elements.build_link.value = location.href.split('#')[0];
      }
      if (!validate()) return;

      var fd = new FormData(form);
      if (fd.get('company')) { form.reset(); setMsg('Thank you. We will be in touch shortly.'); return; }

      if (!FORM_ENDPOINT) {
        if (!CONTACT_EMAIL) { setMsg('This form is not connected yet. Set FORM_ENDPOINT or CONTACT_EMAIL in assets/js/main.js.'); return; }
        var body = ['Name: ' + fd.get('name'), 'Phone: ' + fd.get('phone'), 'Email: ' + fd.get('email'),
          'Postcode: ' + fd.get('postcode'), '', fd.get('message') || ''];
        if (fd.get('build')) body.push('', '--- Build ---', fd.get('build'), fd.get('build_link'));
        location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent('Enquiry from ' + fd.get('name')) +
          '&body=' + encodeURIComponent(body.join('\n'));
        setMsg('Opening your email app to send this…');
        return;
      }

      var label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending…';
      fetch(FORM_ENDPOINT, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          form.reset();
          setMsg('Thank you. Your enquiry has been sent. We will be in touch shortly.');
        })
        .catch(function () { setMsg('Something went wrong. Please try again, or message us on Instagram @custombyunicks.'); })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });
  });
})();
