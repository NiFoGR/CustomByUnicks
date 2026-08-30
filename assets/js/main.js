/* ==========================================================================
   UNICK'S — site behaviour
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

  /* ---------- Current year ---------- */
  var yr = $('#yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- Sticky header ---------- */
  var hdr = $('#hdr');
  var onScroll = function () {
    if (hdr) hdr.classList.toggle('is-stuck', window.scrollY > 40);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile drawer ---------- */
  var burger = $('#burger');
  var drawer = $('#drawer');
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
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });
  }

  /* ---------- Scroll reveal ---------- */
  var reveal = $$('.rv').concat($$('.step'));
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveal.forEach(function (el) { io.observe(el); });
  } else {
    reveal.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Portfolio filter ---------- */
  var filters = $$('.filter');
  var tiles = $$('#grid .tile');
  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cat = btn.dataset.filter;
      filters.forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      tiles.forEach(function (t) {
        t.classList.toggle('is-hidden', cat !== 'all' && t.dataset.cat !== cat);
      });
    });
  });

  /* ---------- FAQ accordion ---------- */
  $$('.faq__item').forEach(function (item) {
    var q = $('.faq__q', item);
    var a = $('.faq__a', item);
    if (!q || !a) return;
    q.addEventListener('click', function () {
      var open = item.classList.contains('is-open');
      // close all
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

  /* ---------- Enquiry form ---------- */
  var form = $('#form');
  if (!form) return;
  var msg = $('#formMsg');
  var btn = $('#submitBtn');

  var setMsg = function (text, ok) {
    if (!msg) return;
    msg.textContent = text;
    msg.className = 'form__msg ' + (ok ? 'is-ok' : 'is-err');
    msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  var fieldOf = function (el) { return el.closest('.field') || el.closest('.consent'); };

  var validate = function () {
    var ok = true;
    var firstBad = null;

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

  // clear the error state as soon as the visitor fixes a field
  $$('[required]', form).forEach(function (el) {
    var ev = el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(ev, function () {
      var wrap = fieldOf(el);
      if (wrap) wrap.classList.remove('has-error');
    });
  });

  var mailtoFallback = function (data) {
    var lines = [
      'Name: '     + data.name,
      'Phone: '    + data.phone,
      'Email: '    + data.email,
      'Postcode: ' + data.postcode,
      'Project: '  + data.project,
      'Budget: '   + data.budget,
      'Start: '    + data.timing,
      '',
      'About the project:',
      data.message || '(none given)'
    ].join('\n');

    window.location.href = 'mailto:' + CONTACT_EMAIL +
      '?subject=' + encodeURIComponent('Consultation request — ' + data.name) +
      '&body=' + encodeURIComponent(lines);
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) {
      setMsg('Please check the highlighted fields and try again.', false);
      return;
    }

    var fd = new FormData(form);
    var data = {};
    fd.forEach(function (v, k) { data[k] = v; });

    // Honeypot — bots fill this, people never see it.
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
    var label = btn.textContent;
    btn.textContent = 'Sending…';

    fetch(FORM_ENDPOINT, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('Bad response');
        form.reset();
        setMsg('Thank you — your request has been sent. We will be in touch shortly.', true);
      })
      .catch(function () {
        setMsg('Something went wrong sending that. Please try again, or reach us on Instagram @custombyunicks.', false);
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = label;
      });
  });
})();
