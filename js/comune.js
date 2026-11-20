/* =========================================================
   Birolini, sito nuovo: la parte comune a tutte le pagine.
   Menu, testata, scorrimento morbido (Lenis guidato dal ticker di GSAP), passaggi «a foglio»,
   video che si caricano solo quando servono. Niente fetch e niente moduli: funziona anche con il doppio clic.
   Le pagine aggiungono il loro movimento con B.quando(function () { ... }), che parte dopo i caratteri.
   ========================================================= */
(function () {
  'use strict';
  var H = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var telefono = window.matchMedia('(max-width: 760px)');
  var verticale = window.matchMedia('(max-width: 760px) and (orientation: portrait)').matches;
  var B = window.B = {
    $: $, $$: $$, telefono: telefono, moto: H.classList.contains('moto'), leggero: +(H.getAttribute('data-leggero') || 0), lenis: null, coda: [],
    // il video non ha srcset: la versione da 1920 solo sugli schermi larghi (da 1280 px reali in su)
    schermoGrande: function () { return window.innerWidth * Math.min(window.devicePixelRatio || 1, 2) >= 1280 && !telefono.matches; },
    quando: function (f) { if (B.avviato) f(); else B.coda.push(f); },
    scorriA: function (dove, durata) {
      if (B.lenis) B.lenis.scrollTo(dove, { duration: durata || 1.4 });
      else if (typeof dove === 'number') window.scrollTo(0, dove);
      else if (dove && dove.scrollIntoView) dove.scrollIntoView();
    }
  };

  /* ---------- Video: si caricano vicino allo schermo e girano solo se si vedono. Da fermo resta il poster. ---------- */
  B.carica = function (v) {
    if (v.dataset.caricato) return;
    var src = (verticale && v.dataset.srcTel) ? v.dataset.srcTel : (B.schermoGrande() && v.dataset.srcGrande) ? v.dataset.srcGrande : v.dataset.src;
    if (!src) return;
    v.src = src; v.preload = 'auto'; v.dataset.caricato = '1';
  };
  B.gira = function (v, si) {
    if (si) { B.carica(v); if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } }
    else if (!v.paused) v.pause();
  };
  function videoAutomatici() {
    if (!B.moto) return;   // da fermo: nessun video parte da solo, resta il poster
    var vid = $$('video[data-auto]');
    if (!vid.length || !('IntersectionObserver' in window)) return;
    var vicino = new IntersectionObserver(function (v) { v.forEach(function (e) { if (e.isIntersecting) B.carica(e.target); }); }, { rootMargin: '400px 0px' });
    var visto = new IntersectionObserver(function (v) { v.forEach(function (e) { B.gira(e.target, e.isIntersecting); }); }, { threshold: .08 });
    vid.forEach(function (v) {
      vicino.observe(v); visto.observe(v);
      // l'etichetta da ciak dice «animato» solo quando il video gira davvero
      var ciak = v.dataset.ciak && document.getElementById(v.dataset.ciak);
      if (ciak) v.addEventListener('playing', function () { if (ciak.dataset.video) ciak.innerHTML = ciak.dataset.video; }, { once: true });
    });
  }

  /* ---------- Menu (funziona sempre, anche da fermo) ---------- */
  var bottoneMenu = $('.testata_menu'), menu = $('#menu');
  function apriMenu(apri) {
    bottoneMenu.setAttribute('aria-expanded', apri ? 'true' : 'false');
    $('.testata_menu-testo').textContent = apri ? 'Chiudi' : 'Menu';
    menu.hidden = !apri;
    document.body.classList.toggle('menu-aperto', apri);
    if (B.lenis) { apri ? B.lenis.stop() : B.lenis.start(); }
    if (apri) { var primo = $('a', menu); if (primo) primo.focus(); } else bottoneMenu.focus();
  }
  if (bottoneMenu && menu) {
    bottoneMenu.addEventListener('click', function () { apriMenu(menu.hidden); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) apriMenu(false); });
    $$('[data-chiudi]', menu).forEach(function (a) { a.addEventListener('click', function () { apriMenu(false); }); });
  }

  /* ---------- Testata: trasparente sull'immagine d'apertura, poi con il fondo notte.
     Scendendo si nasconde (dopo la prima schermata), salendo torna. ---------- */
  var testata = $('.testata'), apertura = $('[data-apertura]'), ultimo = window.scrollY, giu = false;
  function aggiornaTestata() {
    var y = window.scrollY;
    if (Math.abs(y - ultimo) > 4) { giu = y > ultimo; ultimo = y; }
    var piena = apertura ? apertura.getBoundingClientRect().bottom < 80 : y > 8;
    var nascosta = giu && y > window.innerHeight * .9 && (!menu || menu.hidden);
    testata.classList.toggle('testata--piena', piena);
    testata.classList.toggle('testata--nascosta', nascosta);
    H.classList.toggle('testata-su', nascosta);   // la barra dei settori e la finestra salgono al posto della testata
  }
  window.addEventListener('scroll', aggiornaTestata, { passive: true }); aggiornaTestata();

  /* ---------- Collegamenti interni: scorrimento morbido quando c'è Lenis ---------- */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href'); if (id.length < 2 || id === '#contenuto' || !B.lenis) return;
      var el = document.querySelector(id); if (!el) return;
      e.preventDefault(); B.scorriA(el, 1.6);
    });
  });

  videoAutomatici();

  /* ---------- Da fermo («riduci movimento», o librerie mancanti): niente Lenis e niente animazioni ---------- */
  function spegni() { H.classList.remove('moto'); H.classList.add('fermo'); B.moto = false; }
  function avvia() {
    if (B.avviato) return; B.avviato = true;
    if (B.moto) {
      try {
        gsap.registerPlugin(ScrollTrigger);
        if (window.Flip) gsap.registerPlugin(Flip);
        if (window.SplitText) gsap.registerPlugin(SplitText);
        ScrollTrigger.config({ ignoreMobileResize: true });
        if (!B.leggero) {
          B.lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 });
          B.lenis.on('scroll', ScrollTrigger.update);
          gsap.ticker.add(function (t) { B.lenis.raf(t * 1000); });
        } else if (B.leggero > 1) ScrollTrigger.normalizeScroll(true);   // modalità leggera: scorrimento nativo
        gsap.ticker.lagSmoothing(0);
        // passaggi «a foglio»: l'angolo da 28 px a 0 mentre la sezione arriva in cima
        (B.leggero ? [] : $$('.foglio')).forEach(function (s) {
          gsap.fromTo(s, { borderTopLeftRadius: 28, borderTopRightRadius: 28 }, { borderTopLeftRadius: 0, borderTopRightRadius: 0, ease: 'none',
            scrollTrigger: { trigger: s, start: 'top bottom', end: 'top top', scrub: true } });
        });
      } catch (err) { console.error(err); spegni(); }
    }
    var c = B.coda; B.coda = [];
    c.forEach(function (f) { try { f(); } catch (err) { console.error(err); } });
    H.classList.add('pronto');
    if (B.moto) {
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
      window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    }
  }
  if (B.moto && !(window.gsap && window.ScrollTrigger && window.Lenis)) spegni();
  // aspetta i caratteri (righe giuste), ma non più di 1,2 secondi
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(avvia);
  setTimeout(avvia, 1200);
})();
