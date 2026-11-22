/* =========================================================
   Sito nuovo: movimento dei pezzi che le pilota non avevano.
   - copertina in apertura: lento avvicinamento (fino a 1,08 in 16 s);
   - Chi siamo: il 1979 che si apre sulla foto di Pedrengo e la linea del tempo (dal MIX, movimento.js).
   Niente fetch e niente moduli. Da fermo non si muove niente e nessun video parte da solo.
   ========================================================= */
(function () {
  'use strict';
  var B = window.B; if (!B) return;
  var $ = B.$, $$ = B.$$;

  // sul telefono la scena del 1979 è verticale (anche da fermo: le cifre restano al centro)
  var svg = $('.storia_svg');
  if (svg && B.telefono.matches) {
    svg.setAttribute('viewBox', '0 0 1000 1600');
    $$('text', svg).forEach(function (t) { t.setAttribute('x', 500); t.setAttribute('y', 640); t.style.fontSize = '250px'; t.style.letterSpacing = '-8px'; });
    $$('.storia_foto, .storia_video, mask rect', svg).concat([$('mask', svg)]).forEach(function (el) { el.setAttribute('width', 1000); el.setAttribute('height', 1600); });
  }

  B.quando(function () {
    if (!B.moto) return;

    // copertina dell'apertura: lento avvicinamento (sull'immagine, non sull'involucro che entra)
    (B.leggero ? [] : $$('[data-spinta] img')).forEach(function (img) { gsap.fromTo(img, { scale: 1 }, { scale: 1.08, duration: 16, ease: 'none', delay: .2 }); });

    // 1979: le cifre crescono finché la foto riempie lo schermo
    var scena = $('.storia_scena');
    if (scena && svg) {
      var cifre = $$('.storia_cifre, .storia_tratto', svg), pieno = $('.storia_pieno', svg);
      var centro = B.telefono.matches ? '500 560' : '1040 500';
      var tl = gsap.timeline({ defaults: { ease: 'none' } });
      tl.to('.storia_testo', { autoAlpha: 0, y: -40, duration: .3, ease: 'power2.in' }, .05)
        .to('.storia_velo', { opacity: 0, duration: .3 }, .1)
        .to(cifre, { scale: 7, svgOrigin: centro, duration: 1, ease: 'power2.in' }, .1)
        .to('.storia_tratto', { opacity: 0, duration: .3 }, .6)
        .to(pieno, { attr: { 'fill-opacity': 1 }, duration: .35 }, .75)
        .fromTo(['.storia_foto', '.storia_video'], { scale: 1.08, svgOrigin: centro }, { scale: 1, duration: 1.1 }, 0)
        .to({}, { duration: .15 }, 1.1);
      ScrollTrigger.create({ trigger: scena, start: 'top top', end: function () { return '+=' + Math.round(window.innerHeight * .9); }, snap: { snapTo: [0, 1], duration: { min: .6, max: 1.3 }, delay: .06, ease: 'power1.inOut', inertia: false }, pin: true, anticipatePin: B.leggero ? 1 : 0, scrub: B.leggero >= 3 ? .5 : true, animation: tl });
      var v = $('.storia_video video'), ciak = document.getElementById('ciak-storia');
      if (v && !B.leggero) {
        new IntersectionObserver(function (e) { if (e[0].isIntersecting) B.carica(v); B.gira(v, e[0].isIntersecting); }, { rootMargin: '300px 0px' }).observe(scena);
        v.addEventListener('playing', function () { if (ciak && ciak.dataset.video) ciak.innerHTML = ciak.dataset.video; }, { once: true });
      }
    }

    // linea del tempo: sul computer resta ferma e scorre di lato, con lo scatto su ogni tessera; sul telefono si sfoglia col dito
    var lista = $('.tempo_lista');
    if (lista) {
      var annoEl = $('.tempo_anno-corrente span'), tappe = $$('.tappa', lista);
      gsap.matchMedia().add('(min-width: 761px)', function () {
        var barra = gsap.quickSetter($('.tempo_avanzamento i'), 'scaleX');
        var distanza = function () { return Math.max(0, lista.scrollWidth - window.innerWidth); };
        var scorri = gsap.to(lista, {
          x: function () { return -distanza(); }, ease: 'none',
          scrollTrigger: {
            trigger: '.tempo_fissa', pin: true, start: 'top top', end: function () { return '+=' + Math.round(distanza() * .25); },
            scrub: true, invalidateOnRefresh: true,
            snap: { snapTo: function (val) { var d = distanza(); if (!d) return val; var px = val * d, best = 0, bd = 1e9; tappe.forEach(function (t) { var x = Math.min(d, Math.max(0, t.offsetLeft + t.offsetWidth / 2 - window.innerWidth / 2)); if (Math.abs(x - px) < bd) { bd = Math.abs(x - px); best = x; } }); return best / d; }, duration: { min: .25, max: .7 }, delay: .12, ease: 'power2.inOut', inertia: false },
            onUpdate: function (s) {
              barra(s.progress);
              var x = -gsap.getProperty(lista, 'x') + window.innerWidth * .5, scelta = tappe[0];
              for (var k = 0; k < tappe.length; k++) { if (tappe[k].offsetLeft <= x) scelta = tappe[k]; else break; }
              var a = scelta.getAttribute('data-anno'); if (annoEl && annoEl.textContent !== a) annoEl.textContent = a;
            }
          }
        });
        gsap.fromTo('.tempo_anno-corrente', { xPercent: 4 }, { xPercent: -12, ease: 'none',
          scrollTrigger: { trigger: '.tempo_fissa', start: 'top top', end: function () { return '+=' + Math.round(distanza() * .25); }, scrub: true } });
        $$('.tappa_col', lista).forEach(function (img) {
          gsap.to(img, { opacity: 1, ease: 'none', scrollTrigger: { trigger: img.parentNode, containerAnimation: scorri, start: 'left 80%', end: 'center 52%', scrub: true } });
        });
      });
    }
  });
})();

/* =========================================================
   Giro 3: «Leggi tutto» per i testi lunghi delle schede (giro3.mjs).
   Senza JavaScript il testo resta tutto aperto.
   ========================================================= */
(function () {
  'use strict';
  var B = window.B; if (!B) return;
  B.$$('.racconto[data-lungo]').forEach(function (r) {
    var testo = B.$('.racconto_testo', r); if (!testo) return;
    r.classList.add('racconto--chiuso');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'bottone racconto_apri'; b.textContent = 'Leggi tutto';
    b.setAttribute('aria-expanded', 'false');
    testo.parentNode.insertBefore(b, testo.nextSibling);
    b.addEventListener('click', function () {
      r.classList.remove('racconto--chiuso'); b.setAttribute('aria-expanded', 'true'); b.hidden = true;
      var primo = B.$('p', testo); if (primo) { primo.setAttribute('tabindex', '-1'); primo.focus({ preventScroll: true }); }
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });
  });
})();
