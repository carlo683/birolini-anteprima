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
  // giro 7: anche sul tablet (fino a 1100 px): prima il 1979 era tagliato e il testo ci finiva sopra
  var svg = $('.storia_svg'), stretto = B.telefono.matches || window.matchMedia('(max-width: 1100px) and (orientation: portrait)').matches;
  if (svg && stretto) {
    svg.setAttribute('viewBox', '0 0 1000 1600');
    $$('text', svg).forEach(function (t) { t.setAttribute('x', 500); t.setAttribute('y', 640); t.style.fontSize = '250px'; t.style.letterSpacing = '-8px'; });
    $$('.storia_foto, .storia_video, mask rect', svg).concat([$('mask', svg)]).forEach(function (el) { el.setAttribute('width', 1000); el.setAttribute('height', 1600); });
  } else if (svg && window.matchMedia('(max-width: 1100px)').matches) {
    // giro 7: tablet in orizzontale, composizione del computer ma con il 1979 più piccolo e più al centro (il 9 usciva dallo schermo)
    $$('text', svg).forEach(function (t) { t.setAttribute('x', 1060); t.style.fontSize = '250px'; t.style.letterSpacing = '-11px'; });
  }

  B.quando(function () {
    if (!B.moto) return;

    // copertina dell'apertura: lento avvicinamento (sull'immagine, non sull'involucro che entra)
    (B.leggero ? [] : $$('[data-spinta] img')).forEach(function (img) { gsap.fromTo(img, { scale: 1 }, { scale: 1.08, duration: 16, ease: 'none', delay: .2 }); });

    // sul computer (Lenis) lo scatto lo fa Lenis: lo snap di ScrollTrigger litigava con lui (vedi home, movimento.js).
    // giro 6: un elenco di scene (1979 e linea del tempo); quando la pagina si ferma dentro una scena, va alla tappa dopo nella direzione dello scorrimento
    var conLenis = !!(B.lenis && B.lenis.raf), zone = [];
    if (conLenis) {
      var yRiposo = window.scrollY, attesa = null;
      var controlla = function () {
        if (B.lenis.isScrolling || Math.abs(B.lenis.velocity || 0) > .3) { attesa = setTimeout(controlla, 80); return; }
        var y = window.scrollY, dir = y > yRiposo + 2 ? 1 : y < yRiposo - 2 ? -1 : 0, meta = null;
        if (dir) zone.some(function (z) {
          var p = z();
          if (y < p[0] - 2 || y > p[p.length - 1] + 2) return false;
          if (p.some(function (q) { return Math.abs(q - y) <= 3; })) return true;
          meta = dir > 0 ? p.filter(function (q) { return q > y; })[0] : p.filter(function (q) { return q < y; }).pop();
          return true;
        });
        if (meta == null) { yRiposo = y; return; }
        B.lenis.scrollTo(meta, { duration: Math.min(1.2, Math.max(.5, Math.abs(meta - y) / 650)), easing: function (x) { return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; } });
      };
      B.lenis.on('scroll', function () { clearTimeout(attesa); attesa = setTimeout(controlla, 110); });
    }

    // 1979: le cifre crescono finché la foto riempie lo schermo
    var scena = $('.storia_scena');
    if (scena && svg) {
      var cifre = $$('.storia_cifre, .storia_tratto', svg), pieno = $('.storia_pieno', svg);
      var centro = stretto ? '500 560' : window.matchMedia('(max-width: 1100px)').matches ? '1060 500' : '1040 500';
      var tl = gsap.timeline({ defaults: { ease: 'none' } });
      tl.to('.storia_testo', { autoAlpha: 0, y: -40, duration: .3, ease: 'power2.in' }, .05)
        .to('.storia_velo', { opacity: 0, duration: .3 }, .1)
        .to(cifre, { scale: 7, svgOrigin: centro, duration: 1, ease: 'power2.in' }, .1)
        .to('.storia_tratto', { opacity: 0, duration: .3 }, .6)
        .to(pieno, { attr: { 'fill-opacity': 1 }, duration: .35 }, .75)
        .fromTo(['.storia_foto', '.storia_video'], { scale: 1.08, svgOrigin: centro }, { scale: 1, duration: 1.1 }, 0)
        .to({}, { duration: .15 }, 1.1);
      tl.addLabel('storia-chiusa', 0).addLabel('storia-aperta', tl.duration());   // 22/11: scatto con direzione (con [0, 1] la rotella tornava indietro)
      var stStoria = ScrollTrigger.create({ trigger: scena, start: 'top top', end: function () { return '+=' + Math.round(window.innerHeight * .9); }, snap: conLenis ? null : { snapTo: 'labelsDirectional', duration: { min: .6, max: 1.3 }, delay: .06, ease: 'power1.inOut', inertia: false }, pin: true, anticipatePin: B.leggero ? 1 : 0, scrub: B.leggero >= 3 ? .5 : true, animation: tl });
      zone.push(function () { return [stStoria.start, stStoria.end]; });
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
        function contaAnno(a) {   // giro 7: l'anno scorre come un contachilometri invece di saltare
        var da = parseInt(annoEl.textContent, 10), b = parseInt(a, 10);
        if (annoTw) annoTw.kill();
        if (isNaN(da) || isNaN(b) || Math.abs(b - da) > 40 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { if (annoEl) annoEl.textContent = a; return; }
        var o = { v: da };
        annoTw = gsap.to(o, { v: b, duration: Math.min(.8, .15 + Math.abs(b - da) * .06), ease: 'power2.out', onUpdate: function () { annoEl.textContent = Math.round(o.v); } });
      }
      var annoMeta = null, annoTw = null;

        var distanza = function () { return Math.max(0, lista.scrollWidth - window.innerWidth); };
        var scorri = gsap.to(lista, {
          x: function () { return -distanza(); }, ease: 'none',
          scrollTrigger: {
            trigger: '.tempo_fissa', pin: true, start: 'top top', end: function () { return '+=' + Math.round(distanza() * .25); },
            scrub: true, invalidateOnRefresh: true,
            // giro 6: sul computer lo snap «al punto più vicino» faceva risalire la pagina di ~48 px a ogni gesto: lì lo fa Lenis, con direzione
            snap: conLenis ? null : { snapTo: function (val, self) { var d = distanza(); if (!d) return val; var px = val * d, dir = self && self.direction, best = null, bd = 1e9; tappe.forEach(function (t) { var x = Math.min(d, Math.max(0, t.offsetLeft + t.offsetWidth / 2 - window.innerWidth / 2)); if ((dir > 0 && x < px - 2) || (dir < 0 && x > px + 2)) return; if (Math.abs(x - px) < bd) { bd = Math.abs(x - px); best = x; } }); return best == null ? val : best / d; },   /* giro 7: nel verso del gesto */ duration: { min: .25, max: .7 }, delay: .12, ease: 'power2.inOut', inertia: false },
            onUpdate: function (s) {
              barra(s.progress);
              var x = -gsap.getProperty(lista, 'x') + window.innerWidth * .5, scelta = tappe[0];
              for (var k = 0; k < tappe.length; k++) { if (tappe[k].offsetLeft <= x) scelta = tappe[k]; else break; }
              var a = scelta.getAttribute('data-anno'); if (annoEl && annoMeta !== a) { annoMeta = a; contaAnno(a); }
            }
          }
        });
        gsap.fromTo('.tempo_anno-corrente', { xPercent: 4 }, { xPercent: -12, ease: 'none',
          scrollTrigger: { trigger: '.tempo_fissa', start: 'top top', end: function () { return '+=' + Math.round(distanza() * .25); }, scrub: true } });
        $$('.tappa_col', lista).forEach(function (img) {
          gsap.to(img, { opacity: 1, ease: 'none', scrollTrigger: { trigger: img.parentNode, containerAnimation: scorri, start: 'left 80%', end: 'center 52%', scrub: true } });
        });
        var st = scorri.scrollTrigger;
        var tappeTempo = function () {   // una tappa per tessera, più inizio e fine
          var d = distanza(), out = [st.start, st.end];
          if (d) tappe.forEach(function (t) { var x = Math.min(d, Math.max(0, t.offsetLeft + t.offsetWidth / 2 - window.innerWidth / 2)); out.push(st.start + x / d * (st.end - st.start)); });
          return out.sort(function (a, b) { return a - b; });
        };
        zone.push(tappeTempo);
        return function () { var i = zone.indexOf(tappeTempo); if (i !== -1) zone.splice(i, 1); };
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
