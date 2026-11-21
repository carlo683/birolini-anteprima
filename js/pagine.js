/* =========================================================
   Movimento e comandi delle pagine interne.
   - Apertura di pagina: l'UNICO momento orchestrato (la clip si assesta, il titolo sale dalla maschera).
   - Galleria a tavole: dentro ogni cornice l'immagine scorre appena (parallasse), niente dissolvenze.
   - Visore a tutto schermo: frecce, tastiera, dito; l'immagine nuova entra solo quando è pronta.
   - Residenze in pila: il foglio sotto si scurisce mentre arriva il prossimo.
   ========================================================= */
(function () {
  'use strict';
  var B = window.B, $ = B.$, $$ = B.$$;

  /* ---------- Visore (funziona anche da fermo) ---------- */
  var visore = $('#visore'), datiVisore = $('#visore-dati');
  if (visore && datiVisore) (function () {
    var lista = JSON.parse(datiVisore.textContent), N = lista.length, ora = 0, aperto = false, daDove = null;
    var imgs = $$('.visore_img', visore), sopra = 0, numero = $('.visore_n', visore), ciak = $('.visore_ciak', visore);
    var prima = $('.visore_freccia--prima', visore), dopo = $('.visore_freccia--dopo', visore), chiudi = $('.visore_chiudi', visore);
    var due = function (n) { return (n < 10 ? '0' : '') + n; };
    var richiesta = 0;
    function precarica(i) { var x = lista[(i + N) % N]; var im = new Image(); im.src = x.src; }
    function mostra(i, verso) {
      i = (i + N) % N; ora = i;
      var x = lista[i], n = ++richiesta, nuova = imgs[1 - sopra], vecchia = imgs[sopra];
      numero.textContent = due(i + 1);
      var entra = function () {
        if (n !== richiesta) return;
        sopra = 1 - sopra;
        ciak.textContent = x.tipo ? x.tipo + '. ' + (i + 1) + ' di ' + N : (i + 1) + ' di ' + N;
        ciak.style.visibility = 'visible';
        if (B.moto && aperto && verso) {
          gsap.killTweensOf([nuova, vecchia]);
          gsap.set(nuova, { zIndex: 2, opacity: 1 }); gsap.set(vecchia, { zIndex: 1 });
          gsap.fromTo(nuova, { clipPath: verso > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: .55, ease: 'power3.inOut',
            onComplete: function () { gsap.set(vecchia, { opacity: 0 }); } });
          gsap.fromTo(nuova, { xPercent: verso * 4 }, { xPercent: 0, duration: .8, ease: 'power3.out' });
        } else { nuova.style.zIndex = 2; nuova.style.opacity = 1; nuova.style.clipPath = 'none'; vecchia.style.zIndex = 1; vecchia.style.opacity = 0; }
      };
      nuova.style.opacity = 0; nuova.alt = x.alt; nuova.src = x.src;
      if (nuova.decode) nuova.decode().then(entra, entra); else entra();
      precarica(i + 1); precarica(i - 1);
    }
    function apri(i, bottone) {
      daDove = bottone; aperto = false;
      visore.hidden = false; document.body.classList.add('menu-aperto');
      if (B.lenis) B.lenis.stop();
      mostra(i, 0);
      // la foto cliccata vola fino al centro dello schermo (Flip), poi resta il visore
      var foto = bottone && $('img', bottone);
      if (B.moto && window.Flip && foto) {
        var r = foto.getBoundingClientRect(), volo = document.createElement('div');
        volo.className = 'visore_volo'; volo.innerHTML = '<img alt="">'; volo.firstChild.src = foto.currentSrc || foto.src;
        gsap.set(volo, { left: r.left, top: r.top, width: r.width, height: r.height });
        document.body.appendChild(volo);
        var scena = $('.visore_scena', visore).getBoundingClientRect(), x = lista[i];
        var s = Math.min(scena.width / x.w, scena.height / x.h, 1), w = x.w * s, h = x.h * s;
        gsap.fromTo(visore, { opacity: 0 }, { opacity: 1, duration: .35, ease: 'power1.out' });
        gsap.to(volo, { left: scena.left + (scena.width - w) / 2, top: scena.top + (scena.height - h) / 2, width: w, height: h, duration: .55, ease: 'power3.inOut',
          onComplete: function () { volo.remove(); aperto = true; } });
      } else aperto = true;
      chiudi.focus();
    }
    function chiudiVisore() {
      visore.hidden = true; aperto = false; document.body.classList.remove('menu-aperto');
      if (B.lenis) B.lenis.start();
      if (daDove) daDove.focus();
    }
    $$('[data-visore]').forEach(function (b) { b.addEventListener('click', function () { apri(+b.getAttribute('data-visore'), b); }); });
    prima.addEventListener('click', function () { mostra(ora - 1, -1); });
    dopo.addEventListener('click', function () { mostra(ora + 1, 1); });
    chiudi.addEventListener('click', chiudiVisore);
    visore.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') chiudiVisore();
      else if (e.key === 'ArrowRight') mostra(ora + 1, 1);
      else if (e.key === 'ArrowLeft') mostra(ora - 1, -1);
      else if (e.key === 'Tab') {   // il fuoco resta dentro il visore
        var f = [chiudi, prima, dopo].filter(function (x) { return !x.hidden; }), k = f.indexOf(document.activeElement);
        e.preventDefault(); f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
    // col dito: un trascinamento orizzontale cambia immagine
    var x0 = null, y0 = null;
    visore.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; });
    visore.addEventListener('pointerup', function (e) {
      if (x0 === null) return; var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) mostra(ora + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    });
    // un clic sul fondo (fuori dall'immagine e dai comandi) chiude
    $('.visore_scena', visore).addEventListener('click', function (e) { if (e.target === e.currentTarget) chiudiVisore(); });
  })();

  /* ---------- Con il movimento acceso ---------- */
  B.quando(function () {
    if (!B.moto) return;

    // apertura di pagina: la clip si assesta e il titolo sale riga per riga (una volta sola, al caricamento)
    var ap = $('.apertura-pagina');
    if (ap) {
      var titolo = $('[data-righe]', ap), entra = $$('[data-entra]', ap), media = $('.apertura-pagina_media > *', ap), ciak = $('.ciak', ap);
      var righe = window.SplitText ? SplitText.create(titolo, { type: 'lines', mask: 'lines' }).lines : [titolo];
      var tl = gsap.timeline({ delay: .1, defaults: { ease: 'expo.out' } });
      var cornice = ap.classList.contains('apertura-pagina--cornice');
      var inColonna = ap.classList.contains('apertura-pagina--progetto') && B.telefono.matches;   // giro 3: titolo sotto l'immagine
      if (cornice) tl.fromTo(media, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'power3.inOut' }, 0);
      else tl.fromTo(media, { scale: 1.14 }, { scale: 1, duration: 2.8, ease: 'power2.out' }, 0);
      tl.fromTo(righe, { yPercent: 105 }, { yPercent: 0, duration: 1.3, stagger: .08 }, .2);
      if (entra.length) tl.fromTo(entra, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .9, stagger: .1, ease: 'power2.out' }, .75);
      if (ciak) tl.fromTo(ciak, { autoAlpha: 0 }, { autoAlpha: 1, duration: .8 }, 1.2);
      // scorrendo, la clip scende piano e il testo sale: il foglio dopo la copre
      if (!cornice && !inColonna) gsap.to(media, { yPercent: 14, ease: 'none', scrollTrigger: { trigger: ap, start: 'top top', end: 'bottom top', scrub: B.leggero >= 3 ? .5 : true } });
      if (!inColonna) gsap.to($('.apertura-pagina_testo', ap), { y: -80, autoAlpha: 0, ease: 'none', scrollTrigger: { trigger: ap, start: '30% top', end: '85% top', scrub: B.leggero >= 3 ? .5 : true } });
    }

    // galleria: dentro la cornice l'immagine scorre appena, in senso opposto alla pagina
    (B.leggero ? [] : $$('.tavola-foto_quadro img')).forEach(function (img) {
      gsap.fromTo(img, { yPercent: -3 }, { yPercent: 3, ease: 'none', scrollTrigger: { trigger: img.parentNode, start: 'top bottom', end: 'bottom top', scrub: B.leggero >= 3 ? .5 : true } });
    });

    // residenze in pila: il foglio sotto si scurisce mentre arriva il prossimo
    var pila = $$('.residenza');
    pila.forEach(function (r, i) {
      var prossimo = pila[i + 1]; if (!prossimo) return;
      gsap.to($('.residenza_ombra', r), { opacity: .7, ease: 'none', scrollTrigger: { trigger: prossimo, start: 'top bottom', end: 'top top', scrub: B.leggero >= 3 ? .5 : true } });
      if (!B.leggero) gsap.fromTo(prossimo, { borderTopLeftRadius: 28, borderTopRightRadius: 28 }, { borderTopLeftRadius: 0, borderTopRightRadius: 0, ease: 'none', scrollTrigger: { trigger: prossimo, start: 'top bottom', end: 'top top', scrub: B.leggero >= 3 ? .5 : true } });
    });
  });
})();
