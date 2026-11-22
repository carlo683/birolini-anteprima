/* =========================================================
   MIX (giro 2): apertura e capitoli da A, «dal disegno all'edificio» e linea del tempo da C, indice da B
   GSAP + ScrollTrigger + SplitText + Flip + Lenis (tutti locali, in sito/js/vendor). Una sola istanza di Lenis, guidata dal ticker di GSAP.
   Niente fetch, niente moduli: si apre anche con il doppio clic (file://).
   ========================================================= */
(function () {
  'use strict';

  var H = document.documentElement;
  var LEGGERO = +(H.getAttribute('data-leggero') || 0);   // modalità leggera (leggero.mjs)
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var verticale = window.matchMedia('(max-width: 760px) and (orientation: portrait)').matches;
  // il video non ha srcset: si sceglie qui la versione da 1920 per gli schermi larghi (da 1280 px reali in su)
  var schermoGrande = function () { return window.innerWidth * Math.min(window.devicePixelRatio || 1, 2) >= 1280 && !window.matchMedia('(max-width: 760px)').matches; };

  /* ---------- Menu (funziona sempre, anche da fermo) ---------- */
  var bottoneMenu = $('.testata_menu');
  var menu = $('#menu');
  var lenis = null;
  function apriMenu(apri) {
    bottoneMenu.setAttribute('aria-expanded', apri ? 'true' : 'false');
    $('.testata_menu-testo').textContent = apri ? 'Chiudi' : 'Menu';
    menu.hidden = !apri;
    document.body.classList.toggle('menu-aperto', apri);
    if (lenis) { apri ? lenis.stop() : lenis.start(); }
    if (apri) { var primo = $('a', menu); if (primo) primo.focus(); }
    else bottoneMenu.focus();
  }
  bottoneMenu.addEventListener('click', function () { apriMenu(menu.hidden); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) apriMenu(false); });
  $$('[data-chiudi]', menu).forEach(function (a) { a.addEventListener('click', function () { apriMenu(false); }); });

  /* ---------- Video d'apertura: versione verticale sul telefono ---------- */
  var videoApertura = $('[data-video="apertura"]');
  if (verticale && videoApertura.dataset.posterTel) videoApertura.poster = videoApertura.dataset.posterTel;

  /* ---------- Testata: trasparente sul film, con il fondo notte dopo (vale anche da fermo) ---------- */
  var testata = $('.testata'), filmEl = $('.film');
  function fondoTestata() { testata.classList.toggle('testata--piena', filmEl.getBoundingClientRect().bottom < 80); }
  if (!H.classList.contains('moto')) { window.addEventListener('scroll', fondoTestata, { passive: true }); fondoTestata(); }

  /* ---------- Indice: «la finestra sui progetti».
     Una sola immagine grande alla volta e un solo video che cambia sorgente.
     Il progetto attivo cambia quando una riga passa la linea (metà schermo sul computer,
     bordo basso della finestra sul telefono); il mouse comanda solo quando si muove davvero.
     Funziona anche da fermo: allora l'immagine cambia di colpo e il video non parte. ---------- */
  var filtriAnimati = false;   // diventa vero quando GSAP e il movimento sono accesi
  var videoAmmessi = false;    // idem: con «riduci movimento» niente video che parte da solo
  var fp = $('.fp'), fpStrati = $$('.fp_strato'), fpVideo = $('.fp_video');
  var fpNome = $('.fp_nome'), fpMeta = $('.fp_meta'), fpTipo = $('.fp_tipo'), fpN = $('.fp_n'), fpTot = $('.fp_tot');
  var liste = $('.indice_liste'), voci = $$('.voce'), gruppi = $$('.gruppo'), filtri = $$('.filtro');
  var campoCerca = $('.cerca_campo'), nessuno = $('.indice_nessuno'), barraFiltri = $('.filtri');
  var settoreOra = 'tutti', attiva = null, sopra = 0, fpInVista = false, scorriA = null;
  var telefono = window.matchMedia('(max-width: 760px)');
  var senzaAccenti = function (s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var immagine = function (a) { return telefono.matches ? a.getAttribute('data-img-tel') : a.getAttribute('data-img'); };
  var visibili = function () { return voci.filter(function (v) { return v.style.display !== 'none'; }); };
  var due = function (n) { return (n < 10 ? '0' : '') + n; };

  /* La finestra non resta MAI vuota (correzione del 20/11):
     - l'immagine nuova si scarica e si decodifica fuori dallo schermo; finché non è pronta resta quella di prima;
     - si carica solo nello strato nascosto, mai in quello che si vede;
     - una tendina alla volta: se ne arrivano altre mentre scorre, vince l'ultima (le intermedie si saltano);
     - il video parte solo quando può davvero girare, sopra il suo fotogramma poster già in vista;
     - si preparano in anticipo le immagini delle righe vicine. */
  var mostrata = null;          // il progetto la cui immagine è davvero nella finestra
  var tendina = null;           // la tendina in corso (tween di GSAP)
  var richiesta = 0;            // numero dell'ultima richiesta: le risposte vecchie si ignorano
  var inCoda = null, fineUltima = 0, attesaCoda = null;
  var PAUSA = 120;              // ms minimi tra una tendina e la successiva
  var DURATA = .6;              // s della tendina
  var memoria = {};             // url -> promessa dell'immagine già decodificata
  function prendi(url) {
    if (memoria[url]) return memoria[url];
    var i = new Image(); i.decoding = 'async'; i.src = url;
    var p = i.decode ? i.decode() : new Promise(function (ok, no) { i.onload = ok; i.onerror = no; });
    memoria[url] = p = p.then(function () { return i; });
    p.catch(function () { delete memoria[url]; });
    return p;
  }
  function precarica(a) { if (a) prendi(immagine(a)).catch(function () {}); }
  function clipDi(a) { return a && ((schermoGrande() && a.getAttribute('data-clip-grande')) || a.getAttribute('data-clip')); }
  function spegniVideo() {   // lo nasconde di colpo (prima di cambiare sorgente: niente fotogramma nero)
    fpVideo.style.transition = 'none'; fpVideo.classList.remove('in-onda'); void fpVideo.offsetWidth; fpVideo.style.transition = '';
  }
  function videoGiusto() {
    var clip = clipDi(mostrata);
    if (!videoAmmessi || !clip || !fpInVista || mostrata !== attiva) { fpVideo.classList.remove('in-onda'); if (!fpVideo.paused) fpVideo.pause(); return; }
    if (fpVideo.getAttribute('src') !== clip) { spegniVideo(); fpVideo.preload = 'auto'; fpVideo.setAttribute('src', clip); return; }   // parte da «canplay»
    if (fpVideo.readyState >= 3) { var p = fpVideo.play(); if (p && p.catch) p.catch(function () {}); }
  }
  fpVideo.addEventListener('canplay', function () {
    if (clipDi(mostrata) === fpVideo.getAttribute('src') && fpInVista && videoAmmessi && mostrata === attiva) { var p = fpVideo.play(); if (p && p.catch) p.catch(function () {}); }
  });
  fpVideo.addEventListener('playing', function () { if (clipDi(mostrata) === fpVideo.getAttribute('src') && mostrata === attiva) fpVideo.classList.add('in-onda'); });
  function centraTasto(t) { if (!t || !barraFiltri) return; barraFiltri.scrollTo({ left: t.offsetLeft - (barraFiltri.clientWidth - t.offsetWidth) / 2, behavior: filtriAnimati ? 'smooth' : 'auto' }); }

  // da dove entra l'immagine nuova: dal basso se si scende, dall'alto se si sale, da destra col mouse
  var direzione = 'basso';
  function mostraProgetto(a, subito) {
    if (!a || a === attiva) return;
    if (attiva) { attiva.classList.remove('attiva'); attiva.removeAttribute('aria-current'); }
    attiva = a; a.classList.add('attiva'); a.setAttribute('aria-current', 'true');
    // la «ruota»: i vicini sfumano a mano a mano che si allontanano
    var vis = visibili(), k = vis.indexOf(a.parentNode);
    vis.forEach(function (v, i) { var l = $('a', v), d = Math.abs(i - k); l.classList.toggle('d1', d === 1); l.classList.toggle('d2', d === 2); });
    // il contatore segue subito la riga; nome e dati cambiano insieme all'immagine
    var nPrima = fpN.textContent; fpN.textContent = due(k + 1); fpTot.textContent = due(vis.length);
    if (filtriAnimati && !subito && nPrima !== fpN.textContent) gsap.fromTo(fpN, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .5, ease: 'power3.out', overwrite: true });
    // il video del progetto di prima sfuma: sotto c'è già il suo poster
    fpVideo.classList.remove('in-onda');
    chiediImmagine(a, subito);
    // le righe vicine (due nella direzione in cui si va)
    var avanti = direzione === 'alto' ? -1 : 1;
    [k + avanti, k - avanti, k + 2 * avanti].forEach(function (j) { if (vis[j]) precarica($('a', vis[j])); });
  }
  function chiediImmagine(a, subito) {
    var n = ++richiesta, url = immagine(a);
    prendi(url).then(function () {
      if (n !== richiesta) return;                  // nel frattempo si è già andati oltre
      inCoda = { a: a, url: url, subito: subito };
      prova();
    }, function () {
      if (n !== richiesta) return;                  // l'immagine non c'è: resta quella di prima, con i dati giusti
      scriviDati(a); mostrata = null; videoGiusto();
    });
  }
  function prova() {
    if (!inCoda || tendina) return;                 // una tendina alla volta: la prossima parte alla fine di questa
    var resta = fineUltima + PAUSA - performance.now();
    if (resta > 0) { clearTimeout(attesaCoda); attesaCoda = setTimeout(prova, resta); return; }
    var c = inCoda; inCoda = null;
    if (c.a === mostrata) { videoGiusto(); return; }   // si è tornati al progetto già in vista
    entra(c.a, c.url, c.subito);
  }
  function scriviDati(a) {
    fpNome.textContent = a.getAttribute('data-nome'); fpNome.href = a.href;
    fpMeta.textContent = a.getAttribute('data-meta');
    fpTipo.textContent = a.getAttribute('data-tipo') || '';
  }
  function entra(a, url, subito) {
    var vecchio = fpStrati[sopra], nuovo = fpStrati[1 - sopra], img = nuovo.firstElementChild;
    var animata = filtriAnimati && !subito;
    var piccola = a.hasAttribute('data-piccola'), pos = a.getAttribute('data-pos') || '50% 50%';
    if (window.gsap) gsap.killTweensOf([nuovo, img]);
    // lo strato nascosto sale sopra, ma chiuso: si vede ancora tutto il vecchio
    nuovo.style.clipPath = 'inset(100% 0% 0% 0%)';
    nuovo.style.zIndex = 2; vecchio.style.zIndex = 1;
    nuovo.classList.toggle('piccola', piccola);
    img.style.objectPosition = pos; img.style.transformOrigin = pos;
    img.alt = a.getAttribute('data-nome') + (a.getAttribute('data-tipo') ? '. ' + a.getAttribute('data-tipo') : '');
    if (window.gsap) gsap.set(img, { scale: animata && !piccola ? 1.12 : 1, xPercent: 0, yPercent: animata && !piccola ? 3 : 0 });
    tendina = true;   // occupato anche mentre l'elemento decodifica
    img.src = url;
    var apri = function () {
      if (img.getAttribute('src') !== url) return;
      sopra = 1 - sopra; mostrata = a;
      // nome e dati cambiano a metà tendina, quando l'immagine nuova copre già quasi metà finestra
      if (animata) gsap.delayedCall(DURATA * .45, function () { if (mostrata === a) scriviDati(a); }); else scriviDati(a);
      var chiudi = function () { tendina = null; fineUltima = performance.now(); videoGiusto(); prova(); };
      if (!animata) { nuovo.style.clipPath = 'none'; chiudi(); return; }
      var da = 'inset(100% 0% 0% 0%)';   // un solo movimento in tutto il sito: l'immagine nuova entra dal basso (giro 3)
      tendina = gsap.fromTo(nuovo, { clipPath: da }, { clipPath: 'inset(0% 0% 0% 0%)', duration: DURATA, ease: 'power3.inOut', onComplete: chiudi });
      if (!piccola) gsap.to(img, { scale: 1.02, yPercent: 0, duration: 1, ease: 'power3.out',
        onComplete: function () { if (!LEGGERO) gsap.to(img, { scale: 1.09, duration: 14, ease: 'none' }); } });   // lento avvicinamento
    };
    // già decodificata fuori dallo schermo: qui è quasi immediato, ma si aspetta comunque
    if (img.decode) img.decode().then(apri, function () { tendina = null; prova(); }); else apri();
  }

  /* la linea che decide il progetto attivo; si controlla a ogni fotogramma di scorrimento, solo vicino all'elenco */
  var corpoIndice = $('.indice_corpo'), richiesto = false, corpoDa = 0, corpoA = 0, ultimoY = window.scrollY;
  var mouseComanda = false, yAlMouse = 0, mouseMosso = false, ultimoScorrimento = 0;
  function misuraCorpo() { var rc = corpoIndice.getBoundingClientRect(); corpoDa = rc.top + window.scrollY; corpoA = corpoDa + rc.height; }
  function controllaLinea() {
    richiesto = false;
    if (window.scrollY + window.innerHeight < corpoDa || window.scrollY > corpoA) return;
    if (mouseComanda) { if (Math.abs(window.scrollY - yAlMouse) < 120) return; mouseComanda = false; }
    var y = telefono.matches ? fp.getBoundingClientRect().bottom + 1 : window.innerHeight / 2;
    var vis = visibili();
    for (var k = 0; k < vis.length; k++) {
      var r = vis[k].getBoundingClientRect();
      if (r.bottom > y) { mostraProgetto($('a', vis[k])); return; }   // la prima riga che tocca o sta per toccare la linea
    }
  }
  window.addEventListener('scroll', function () {
    var y = window.scrollY; if (y !== ultimoY) direzione = y > ultimoY ? 'basso' : 'alto'; ultimoY = y;
    ultimoScorrimento = performance.now(); mouseMosso = false;
    if (!richiesto) { richiesto = true; requestAnimationFrame(controllaLinea); }
  }, { passive: true });
  window.addEventListener('resize', misuraCorpo); window.addEventListener('load', misuraCorpo); misuraCorpo();
  // il mouse comanda solo quando si muove davvero, non quando le righe gli scorrono sotto
  liste.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') mouseMosso = true; });
  voci.forEach(function (v) {
    var a = $('a', v);
    a.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse' || telefono.matches) return;
      if (!mouseMosso || performance.now() - ultimoScorrimento < 150) return;
      mouseComanda = true; yAlMouse = window.scrollY; direzione = 'destra'; mostraProgetto(a);
    });
    a.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || telefono.matches || attiva === a || performance.now() - ultimoScorrimento < 150) return;
      mouseComanda = true; yAlMouse = window.scrollY; direzione = 'destra'; mostraProgetto(a);
    });
    a.addEventListener('focus', function () { direzione = 'destra'; mostraProgetto(a); });
  });
  // frecce su e giù tra i nomi
  liste.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    var vis = visibili(), k = vis.indexOf(document.activeElement && document.activeElement.parentNode);
    if (k < 0) return;
    var dopo = vis[k + (e.key === 'ArrowDown' ? 1 : -1)];
    if (dopo) { e.preventDefault(); $('a', dopo).focus(); }
  });
  // il video gira solo quando la finestra si vede
  new IntersectionObserver(function (v) { fpInVista = v[0].isIntersecting; videoGiusto(); }, { threshold: 0 }).observe(fp);

  /* clic su un nome o sulla finestra: la finestra si allarga a tutto schermo, poi si apre la scheda */
  // tornando indietro, Safari ripresenta la pagina com era (bfcache): via il velo della foto allargata (21/11/2026)
  window.addEventListener('pageshow', function (e) { if (e.persisted) document.querySelectorAll('.fp_pieno').forEach(function (x) { x.remove(); }); });
  function entraNelProgetto(href, e, voce) {
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0)) return;   // nuova scheda: come sempre
    if (!filtriAnimati) { if (!e || e.currentTarget === fp) window.location.href = href; return; }
    if (e) e.preventDefault();
    var vai = function () { window.location.href = href; };
    setTimeout(vai, 1200);   // in ogni caso la scheda si apre
    // si allarga l'immagine del progetto TOCCATO (correzione del 20/11 sera: prima era quella nella finestra)
    var su = fpStrati[sopra].firstElementChild, src = su.src, pos = su.style.objectPosition;
    if (voce && voce !== mostrata) { src = immagine(voce); pos = voce.getAttribute('data-pos') || '50% 50%'; }
    var parti = function () {
      var r = fp.getBoundingClientRect(), velo = document.createElement('div');
      velo.className = 'fp_pieno';
      velo.innerHTML = '<img alt="">';
      velo.firstChild.src = src;
      velo.firstChild.style.objectPosition = pos;
      gsap.set(velo, { left: r.left, top: r.top, width: r.width, height: r.height });
      document.body.appendChild(velo);
      var pieno = document.createElement('div');
      pieno.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;visibility:hidden;pointer-events:none';
      document.body.appendChild(pieno);
      Flip.fit(velo, pieno, { duration: .55, ease: 'power3.inOut', absolute: true, scale: false, onComplete: vai });
      gsap.to(velo.firstChild, { opacity: .45, duration: .55, ease: 'power2.in' });   // finisce scura come l'apertura della scheda (21/11/2026)
    };
    if (src === su.src) parti(); else prendi(src).then(parti, parti);   // prima si decodifica, così non cresce un riquadro vuoto
  }
  voci.forEach(function (v) { var a = $('a', v); a.addEventListener('click', function (e) { entraNelProgetto(a.href, e, a); }); });
  fp.addEventListener('click', function (e) { var x = mostrata || attiva; if (x) entraNelProgetto(x.href, e); });   // apre il progetto che si vede

  /* filtri per settore e ricerca */
  var testoNessuno = nessuno ? nessuno.textContent : '';
  // nessun risultato: se il testo c'è in altri settori, lo dice e offre di cercare in tutti (21/11/2026, revisione giro 4 n. 12)
  function avvisaNessuno(visti, q) {
    if (!nessuno) return;
    nessuno.hidden = visti > 0;
    if (visti > 0) return;
    var altrove = settoreOra !== 'tutti' && q ? voci.filter(function (v) { return v.getAttribute('data-cerca').indexOf(q) !== -1; }).length : 0;
    if (!altrove) { nessuno.textContent = testoNessuno; return; }
    var tasto = filtri.filter(function (x) { return x.getAttribute('data-filtro') === settoreOra; })[0];
    var nome = tasto ? tasto.firstChild.textContent.trim() : '';
    nessuno.textContent = 'Nessun risultato in «' + nome + '». ';
    var tutti = document.createElement('button');
    tutti.type = 'button'; tutti.className = 'collegamento indice_tutti';
    tutti.textContent = altrove === 1 ? 'Cerca in tutti i progetti: ce n\'è 1' : 'Cerca in tutti i progetti: ce ne sono ' + altrove;
    tutti.addEventListener('click', function () { var b = filtri.filter(function (x) { return x.getAttribute('data-filtro') === 'tutti'; })[0]; centraTasto(b); cambia('tutti'); if (b) b.focus(); });
    nessuno.appendChild(tutti);
  }
  function applica() {
    var q = senzaAccenti((campoCerca && campoCerca.value || '').trim()), visti = 0;
    voci.forEach(function (v) {
      var ok = (settoreOra === 'tutti' || v.getAttribute('data-settore') === settoreOra) && (!q || v.getAttribute('data-cerca').indexOf(q) !== -1);
      v.style.display = ok ? '' : 'none'; if (ok) visti++;
    });
    gruppi.forEach(function (g) { g.style.display = $$('.voce', g).some(function (v) { return v.style.display !== 'none'; }) ? '' : 'none'; });
    avvisaNessuno(visti, q);
    liste.classList.toggle('poche', visti < 8);   // pochi nomi: si centrano accanto alla finestra
    misuraCorpo();
    var prima = visibili()[0];
    if (prima && (!attiva || attiva.parentNode.style.display === 'none')) { attiva && attiva.classList.remove('attiva'); attiva = null; mostraProgetto($('a', prima), true); }
    else if (attiva) { var a = attiva; attiva = null; mostraProgetto(a, true); }   // aggiorna contatore e ruota
  }
  function cambia(f, dopo) {
    settoreOra = f;
    filtri.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filtro') === f)); });
    var stato = filtriAnimati ? Flip.getState(voci.concat(gruppi)) : null;
    applica();
    if (stato) Flip.from(stato, {
      duration: .6, ease: 'power3.inOut', absolute: true, prune: true,
      onEnter: function (el) { return gsap.fromTo(el, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .5, delay: .15, ease: 'power3.out' }); },
      onLeave: function (el) { return gsap.to(el, { opacity: 0, duration: .25 }); },
      onComplete: function () { ScrollTrigger.refresh(); if (dopo) dopo(); }
    });
    else if (dopo) dopo();
  }
  function tornaSu() {
    var top = corpoIndice.getBoundingClientRect().top;
    if (top < 0) { var y = top + window.scrollY - 140; if (scorriA) scorriA(y); else window.scrollTo(0, y); }
  }
  filtri.forEach(function (b) { b.addEventListener('click', function () { centraTasto(b); cambia(b.getAttribute('data-filtro'), tornaSu); }); });
  var attesaCerca = null;
  if (campoCerca) campoCerca.addEventListener('input', function () {
    clearTimeout(attesaCerca);
    attesaCerca = setTimeout(function () { applica(); if (filtriAnimati) ScrollTrigger.refresh(); }, 160);
  });
  // sul telefono la ricerca è una lente che si apre al tocco
  var lente = $('.cerca_lente'), barraIndice = $('.indice_barra');
  if (lente) lente.addEventListener('click', function () {
    var aperta = barraIndice.classList.toggle('cerca-aperta');
    lente.setAttribute('aria-expanded', String(aperta));
    if (aperta) campoCerca.focus();
  });
  // i link dei capitoli («Le case nell'indice») aprono l'indice già filtrato
  $$('[data-filtro-vai]').forEach(function (a) {
    a.addEventListener('click', function () { settoreOra = a.getAttribute('data-filtro-vai'); filtri.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filtro') === settoreOra)); }); applica(); if (filtriAnimati) ScrollTrigger.refresh(); });
  });
  applica();

  /* ---------- Da fermo ("riduci movimento", o librerie mancanti): nessun video, nessuna animazione ---------- */
  function spegni() { H.classList.remove('moto'); H.classList.add('fermo'); }
  if (!H.classList.contains('moto')) return;
  if (!window.gsap || !window.ScrollTrigger || !window.SplitText || !window.Flip || !window.Lenis) { spegni(); return; }

  var pronto = false;
  function parti() {
    if (pronto) return; pronto = true;
    // 22/11 (revisione giro 6, P0): tutto quello che GSAP crea sta in un «contesto»; se qualcosa va storto si annulla
    // (stili messi, testi nascosti, scene fissate) e la pagina torna quella ferma, con tutti i testi visibili
    var ctx = gsap.context(function () {});
    try { ctx.add(avvia); H.classList.add('pronto'); }
    catch (err) {
    console.error(err);
    try { ctx.revert(); } catch (e) {}
    try { ScrollTrigger.getAll().forEach(function (t) { t.kill(true); }); } catch (e) {}
    try { if (lenis && lenis.destroy) lenis.destroy(); } catch (e) {}
    $$('.apertura, .apertura *, .intro, .intro *, .capitolo, .capitolo *, .capindice, .costruzioni *').forEach(function (el) { el.style.visibility = ''; el.style.opacity = ''; el.style.transform = ''; });
    spegni();
    }
  }
  // aspetta i caratteri (righe giuste), ma non più di 1,2 secondi
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(parti);
  setTimeout(parti, 1200);

  function avvia() {
    gsap.registerPlugin(ScrollTrigger, SplitText, Flip);
    ScrollTrigger.config({ ignoreMobileResize: true, autoRefreshEvents: 'visibilitychange,DOMContentLoaded,resize' });   /* «load» lo gestisce rinfresca(), in fondo */
    gsap.defaults({ ease: 'power2.inOut' });

    /* ---- Scorrimento morbido: Lenis guidato dal ticker di GSAP ---- */
    if (LEGGERO) {
      // modalità leggera: scorrimento nativo del telefono, niente Lenis (al suo posto un sostituto per i salti ai capitoli)
      lenis = { scrollTo: function (d) { var y = typeof d === 'number' ? d : d.getBoundingClientRect().top + window.scrollY; window.scrollTo({ top: y, behavior: Math.abs(y - window.scrollY) > 2.5 * window.innerHeight ? 'auto' : 'smooth' }); }, stop: function () {}, start: function () {} };   // giro 6: i salti lunghi (es. «Tutti i 42 progetti») sono immediati: uno scorrimento morbido attraverso il film poteva fermarsi a metà, su un capitolo
      if (LEGGERO === 2) ScrollTrigger.normalizeScroll(true);
    } else {
      lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    }
    gsap.ticker.lagSmoothing(0);

    /* ---- Video: si caricano solo quando servono e girano solo se si vedono ---- */
    function carica(v) {
      if (v.dataset.caricato) return;
      var src = (verticale && v.dataset.srcTel) ? v.dataset.srcTel : (schermoGrande() && v.dataset.srcGrande) ? v.dataset.srcGrande : v.dataset.src;
      if (!src) return;
      v.src = src; v.preload = 'auto'; v.dataset.caricato = '1';
    }
    function gira(v, si) {
      if (si) { carica(v); if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } }
      else if (!v.paused) v.pause();
    }

    /* ---- Sottotitoli del montaggio d'apertura: dicono cosa si vede e se è render o foto ---- */
    var battute = [
      [0, 'Render animato. Redona Centro, Bergamo.', false],
      [3.7, 'Render animato. Residenza Viaduse, Gorle (BG).', false],
      [7.0, "Render animato. Polo logistico a Rivolta d'Adda (CR).", true],
      [10.6, "Foto dal drone animata. Cantiere dell'hotel a Orio al Serio (BG).", false],
      [14.0, "Foto dal drone animata. Campo fotovoltaico vicino all'aeroporto di Bergamo.", false],
      [17.3, 'Render animato. Redona Centro, Bergamo.', false]
    ];
    var testoSotto = $('[data-sottotitoli]');
    var sottotitolo = testoSotto.parentNode;
    var apertura = $('.apertura');
    var battutaOra = 0;
    videoApertura.addEventListener('timeupdate', function () {
      var t = videoApertura.currentTime, i = 0;
      for (var k = 0; k < battute.length; k++) if (t >= battute[k][0]) i = k;
      if (i === battutaOra) return;
      battutaOra = i;
      apertura.classList.toggle('inquadratura-chiara', battute[i][2]);
      gsap.to(testoSotto, { opacity: 0, duration: .25, ease: 'power1.out', onComplete: function () {
        testoSotto.textContent = battute[i][1];
        gsap.to(testoSotto, { opacity: 1, duration: .35, ease: 'power1.out' });
      } });
    });

    /* ---- Righe di testo con la maschera ---- */
    var divisi = [];
    function righe(el, avantiIndietro) {
      if (!el) return [];
      var s = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'riga' });
      if (!avantiIndietro) divisi.push(s);
      return s.lines;
    }
    /* 22/11 sera: le righe si tagliano una volta sola, alla larghezza dell'apertura. Se poi la finestra si allarga
       o si stringe, una frase già comparsa resterebbe a una parola per riga: torna testo normale e si ridispone. */
    var largoRighe = window.innerWidth, attesaRighe = 0;
    window.addEventListener('resize', function () {
      clearTimeout(attesaRighe);
      attesaRighe = setTimeout(function () {
        if (Math.abs(window.innerWidth - largoRighe) < 30) return;
        largoRighe = window.innerWidth;
        divisi = divisi.filter(function (s) {
          var tutteFuori = s.lines.every(function (r) { return Math.abs(gsap.getProperty(r, 'yPercent')) < 1; });
          if (tutteFuori) { s.revert(); return false; }
          return true;
        });
        ScrollTrigger.refresh();
      }, 250);
    });

    /* =====================================================
       Scatto automatico (22/11, Carlo: «se non scorri rimane così… deve aprirsi tutto in maniera automatica»).
       Sul telefono (scorrimento nativo) lo fa ScrollTrigger (snap). Sul computer lo scorrimento è di Lenis e lo snap di
       ScrollTrigger litigava con lui (con la rotella la pagina tornava indietro o restava ferma): lì lo fa Lenis stesso.
       Quando la pagina si ferma dentro una scena, Lenis la porta alla tappa successiva nella direzione dello scorrimento.
       ===================================================== */
    var lenisVero = !!(lenis && lenis.raf);
    var zoneScatto = [];
    function tappeEtichette(st) { if (st._tappe) return st._tappe(); var a = st.animation, d = a.duration(); return Object.keys(a.labels).map(function (k) { return st.start + a.labels[k] / d * (st.end - st.start); }).sort(function (x, y) { return x - y; }); }
    function zonaScatto(st) { if (lenisVero) zoneScatto.push(st); return st; }
    if (lenisVero) {
      var yRiposo = window.scrollY, attesaScatto = null;
      var controllaScatto = function () {
        if (lenis.isScrolling || Math.abs(lenis.velocity || 0) > .3) { attesaScatto = setTimeout(controllaScatto, 80); return; }
        var y = window.scrollY, dir = y > yRiposo + 2 ? 1 : y < yRiposo - 2 ? -1 : 0, meta = null;
        if (dir) zoneScatto.some(function (st) {
          var p = tappeEtichette(st);
          if (y < p[0] - 2 || y > p[p.length - 1] + 2) return false;
          if (p.some(function (q) { return Math.abs(q - y) <= 3; })) return true;   // già su una tappa
          meta = dir > 0 ? p.filter(function (q) { return q > y; })[0] : p.filter(function (q) { return q < y; }).pop();
          return true;
        });
        if (meta == null) { yRiposo = y; return; }
        lenis.scrollTo(meta, { duration: Math.min(1.4, Math.max(.6, Math.abs(meta - y) / 650)), easing: function (x) { return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; } });
      };
      lenis.on('scroll', function () { clearTimeout(attesaScatto); attesaScatto = setTimeout(controllaScatto, 110); });
    }
    // lo snap di ScrollTrigger solo dove non c'è Lenis
    function snapNativo(cfg) { return lenisVero ? null : cfg; }

    /* =====================================================
       Il FILM: apertura -> finestra -> quattro capitoli
       ===================================================== */
    var film = $('.film');
    var quadroA = $('[data-quadro]', apertura);
    var testoA = $('.apertura_testo');
    var nome = $$('.apertura_nome path');
    var intro = $('.intro');
    var capitoli = $$('.capitolo');
    var indice = $('.capindice');
    var lineeIndice = $$('.capindice_linea i');
    var vociIndice = $$('.capindice a');
    var parolaLogo = $('.testata_logo .logo_parola');

    // stato di una "inquadratura": p = 0 a tutto schermo, p = 1 nella finestra; k = zoom del contenuto
    function Inquadratura(quadro) {
      this.q = quadro; this.d = $('.quadro_dentro', quadro);
      this.p = 0; this.k = 1; this.r = null;
    }
    Inquadratura.prototype.applica = function () {
      // misure lette una volta sola (si azzerano in misuraFinestre): leggerle a ogni fotogramma rallenta il telefono
      if (!this.W) { this.W = this.q.parentNode.clientWidth || window.innerWidth; this.Hh = this.q.parentNode.clientHeight || window.innerHeight; }
      var W = this.W, Hh = this.Hh;
      var r = this.r || { x: 0, y: 0, w: W, h: Hh };
      var p = this.p;
      var sx = 1 + (r.w / W - 1) * p, sy = 1 + (r.h / Hh - 1) * p;
      this.q.style.transform = 'translate3d(' + (r.x * p).toFixed(2) + 'px,' + (r.y * p).toFixed(2) + 'px,0) scale(' + sx.toFixed(5) + ',' + sy.toFixed(5) + ')';
      if (this.d) this.d.style.transform = 'scale(' + (this.k / sx).toFixed(5) + ',' + (this.k / sy).toFixed(5) + ')';
    };
    function misura(el, dentro) {
      var a = el.getBoundingClientRect(), b = dentro.getBoundingClientRect();
      return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
    }

    var iA = new Inquadratura(quadroA);
    var iC = capitoli.map(function (c) { return new Inquadratura($('[data-quadro]', c)); });
    var finestra = $('.finestra:not(.finestra--centro)');
    var finestraCentro = $('.finestra--centro');
    function misuraFinestre() {
      var r1 = misura(finestra, film);
      iA.r = r1; iC[0].r = r1; iA.W = 0; iC[0].W = 0;
      iA.applica(); iC[0].applica();
    }

    // elementi da rivelare
    var righeIntroTitolo = righe($('.intro_titolo'), true);
    var entraIntro = $$('[data-entra]', intro);
    var cap = capitoli.map(function (c) {
      return {
        el: c,
        titolo: righe($('.capitolo_titolo', c), true),
        entra: $$('[data-entra]', c),
        sotto: $('.sottotitolo', c),
        ombra: $('.ombra', c),
        testo: $('.capitolo_testo', c),
        progetti: $('.capitolo_progetti', c),
        video: $('video', c)
      };
    });

    // stato iniziale (prima di costruire il film, cosi' il film parte da qui)
    var righeFrase = righe($('.apertura_frase'));
    var azioni = $('.apertura_azioni');
    gsap.set(nome, { y: 27 });
    gsap.set(righeFrase, { yPercent: 105 });
    gsap.set(azioni, { autoAlpha: 0, pointerEvents: 'none' });   // giro 6: toccabili solo quando sono comparsi del tutto
    gsap.set([testoSotto, $('.apertura_scorri span')], { opacity: 0 }); // il film usa il contenitore, l'apertura il contenuto: non si pestano i piedi
    gsap.set(parolaLogo, { opacity: 0 });
    gsap.set(intro, { autoAlpha: 1 });
    gsap.set(righeIntroTitolo, { yPercent: 105 });
    gsap.set(entraIntro, { opacity: 0, y: 24 });
    cap.forEach(function (c) {
      gsap.set(c.el, { autoAlpha: 0 });
      gsap.set(c.titolo, { yPercent: 105 });
      gsap.set(c.entra.concat([c.sotto]), { autoAlpha: 0, y: 22 });
    });
    gsap.set(indice, { autoAlpha: 0 });
    iC[0].p = 1; iC[0].k = .9;

    var ripeti = function (o) { return function () { o.applica(); }; };
    var tl = gsap.timeline({ defaults: { ease: 'none' } });

    /* 0 - 1.1: l'apertura si stringe nella finestra cinemascope */
    tl.to(iA, { p: 1, k: .84, duration: 1.1, ease: 'power2.inOut', onUpdate: ripeti(iA) }, 0)
      .to($('.velo--apertura'), { opacity: 0, duration: .8, ease: 'power1.inOut' }, .2)
      .to(testoA, { y: -70, autoAlpha: 0, duration: .5, ease: 'power2.in' }, 0)
      .to([sottotitolo, $('.apertura_scorri')], { autoAlpha: 0, duration: .25 }, 0)
      .fromTo(parolaLogo, { opacity: 0 }, { opacity: 1, duration: .3 }, .1)
      .to(entraIntro[0], { opacity: 1, y: 0, duration: .45, ease: 'power2.out' }, .55)
      .to(righeIntroTitolo, { yPercent: 0, duration: .5, stagger: .06, ease: 'power3.out' }, .62)
      .to(entraIntro.slice(1), { opacity: 1, y: 0, duration: .45, stagger: .08, ease: 'power2.out' }, .78);

    /* 1.7 - 3.1: capitolo «casa» nasce nella stessa finestra e si allarga a tutto schermo */
    tl.addLabel('bisogni', 1.25);
    function entraTesto(c, t) {
      tl.to(c.titolo, { yPercent: 0, duration: .5, stagger: .07, ease: 'power3.out' }, t)
        .to(c.entra.concat([c.sotto]), { autoAlpha: 1, y: 0, duration: .45, stagger: .07, ease: 'power2.out' }, t + .15);
    }
    function esceTesto(c, t) {
      tl.to([c.testo, c.progetti, c.sotto], { autoAlpha: 0, y: -40, duration: .4, ease: 'power2.in' }, t);
    }
    tl.to(cap[0].el, { autoAlpha: 1, duration: .2 }, 1.7)
      .to(intro, { autoAlpha: 0, y: -30, duration: .4, ease: 'power2.in' }, 1.75)
      .to(iC[0], { p: 0, k: 1, duration: 1.0, ease: 'power3.inOut', onUpdate: ripeti(iC[0]) }, 1.85)
      .to(indice, { autoAlpha: 1, duration: .3 }, 2.5);
    entraTesto(cap[0], 2.55);
    tl.to(iC[0], { k: 1.05, duration: .75, ease: 'none', onUpdate: ripeti(iC[0]) }, 2.85); // casa: la camera si avvicina
    tl.addLabel('c0', 3.25);

    /* 3.6 - 4.6: «attività» sale come un sipario, «casa» si allontana nel buio */
    var q1 = cap[1].el.querySelector('[data-quadro]'), d1 = $('.quadro_dentro', q1);
    tl.set(cap[1].el, { autoAlpha: 1 }, 3.6)
      .fromTo(q1, { yPercent: 100 }, { yPercent: 0, duration: 1, ease: 'power3.inOut' }, 3.6)
      .fromTo(d1, { yPercent: -55, scale: 1.12 }, { yPercent: 0, scale: 1, duration: 1, ease: 'power3.inOut' }, 3.6)
      .to(iC[0], { k: 1.08, duration: 1, ease: 'power2.in', onUpdate: ripeti(iC[0]) }, 3.6)
      .to(cap[0].ombra, { opacity: .7, duration: 1, ease: 'power2.in' }, 3.6);
    esceTesto(cap[0], 3.6);
    entraTesto(cap[1], 4.25);
    tl.to(d1, { xPercent: -2, scale: 1.05, duration: .7, ease: 'none' }, 4.6); // attività: la camera scorre di lato (giro 3: un po' ingrandita, così a destra non resta una striscia scura)
    tl.addLabel('c1', 4.95);

    /* 5.3 - 6.5: «area» si apre da una finestra verticale al centro */
    // giro 3: anche «area» sale dal basso come un sipario (prima si apriva da una finestra verticale al centro)
    var q2 = cap[2].el.querySelector('[data-quadro]'), d2 = $('.quadro_dentro', q2);
    tl.set(cap[2].el, { autoAlpha: 1 }, 5.3)
      .fromTo(q2, { yPercent: 100 }, { yPercent: 0, duration: 1, ease: 'power3.inOut' }, 5.3)
      .fromTo(d2, { yPercent: -55, scale: 1.12 }, { yPercent: 0, scale: 1, duration: 1, ease: 'power3.inOut' }, 5.3)
      .to(cap[1].ombra, { opacity: .82, duration: 1, ease: 'power2.in' }, 5.3)
      .to(d1, { scale: 1.06, duration: 1.2, ease: 'power1.in' }, 5.3);
    esceTesto(cap[1], 5.3);
    entraTesto(cap[2], 6.15);
    tl.addLabel('c2', 6.85);

    /* 7.2 - 8.2: «energia» entra di lato, come un carrello */
    var q3 = cap[3].el.querySelector('[data-quadro]'), d3 = $('.quadro_dentro', q3);
    tl.set(cap[3].el, { autoAlpha: 1 }, 7.2)
      .fromTo(q3, { yPercent: 100 }, { yPercent: 0, duration: 1, ease: 'power3.inOut' }, 7.2)   // giro 3: dal basso, non più di lato
      .fromTo(d3, { yPercent: -55, scale: 1.1 }, { yPercent: 0, scale: 1, duration: 1, ease: 'power3.inOut' }, 7.2)
      .to(cap[2].ombra, { opacity: .7, duration: 1, ease: 'power2.in' }, 7.2)
      .to(d2, { scale: 1.08, duration: 1, ease: 'power2.in' }, 7.2);
    esceTesto(cap[2], 7.2);
    entraTesto(cap[3], 7.85);
    tl.addLabel('c3', 8.55);
    tl.to({}, { duration: .55 }, 8.6); // una pausa prima di lasciare la scena

    // tempi di ogni capitolo (per l'indice e per i video)
    // la tappa «Di cosa hai bisogno?» è più corta di un terzo: tutto quello che viene dopo si anticipa
    var ANTICIPO = .25;
    tl.shiftChildren(-ANTICIPO, true, 1.69);
    // 22/11 (Carlo: «se non scorri rimane così… deve aprirsi tutto in maniera automatica»): tappe del film per lo scatto automatico
    tl.addLabel('inizio', 0); tl.addLabel('fine', tl.duration());
    // giro 6: il capitolo Energia coincide con la fine del film (prima, tra c3 e la fine, un colpo di scorrimento non cambiava niente)
    tl.addLabel('c3', tl.duration());
    var tratti = [[1.45, 3.35], [3.35, 5.05], [5.05, 6.95], [6.95, 8.9]];
    var visibili = [[0, .6], [1.45, 4.45],   // giro 3: il video d'apertura si ferma quando nasce la finestra
      [3.35, 6.35], [5.05, 8.05], [6.95, 99]]; // apertura + 4 capitoli
    var videoFilm = [videoApertura].concat(cap.map(function (c) { return c.video; }));
    var filmInVista = true, attivoOra = -2, introAttiva = null;
    var lineaX = lineeIndice.map(function (l) { return gsap.quickSetter(l, 'scaleX'); });

    function aggiornaFilm() {
      var t = tl.time();
      // video: girano solo gli strati visibili; il prossimo si prepara un po' prima
      var unico = 0;
      if (LEGGERO) visibili.forEach(function (r, i) { if (i && t >= (r[0] + visibili[i - 1][1]) / 2) unico = i; });
      videoFilm.forEach(function (v, i) {
        var dentro = filmInVista && t >= visibili[i][0] && t <= visibili[i][1] && (!LEGGERO || i === unico);
        if (t >= visibili[i][0] - 1.4) carica(v);
        gira(v, dentro);
      });
      // giro 3: nella finestra resta un'immagine sola, ferma sul primo render del montaggio (Redona Centro)
      if (t > visibili[0][1] && videoApertura.paused && videoApertura.readyState >= 1 && Math.abs(videoApertura.currentTime - 1.5) > .05) videoApertura.currentTime = 1.5;
      // indice dei capitoli
      var attivo = -1;
      tratti.forEach(function (tr, i) {
        var f = Math.max(0, Math.min(1, (t - tr[0]) / (tr[1] - tr[0])));
        lineaX[i](f);
        if (t >= tr[0]) attivo = i;
      });
      if (attivo !== attivoOra) {
        attivoOra = attivo;
        vociIndice.forEach(function (a, i) {
          a.classList.toggle('attivo', i === attivo);
          if (i === attivo) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
        });
        // solo i link del capitolo davanti si possono cliccare
        cap.forEach(function (c, i) { c.el.style.pointerEvents = i === attivo ? 'auto' : 'none'; });
      }
      // «Di cosa hai bisogno?» si può toccare solo quando c'è davvero (21/11: prima, invisibile, rubava i tocchi ai pulsanti dell'apertura)
      var introSu = attivo === -1 && t >= .6;
      if (introSu !== introAttiva) { introAttiva = introSu; intro.style.pointerEvents = introSu ? 'auto' : 'none'; intro.inert = !introSu; }
    }

    var stFilm = null;   // 22/11 (revisione giro 6, P0): esiste prima di chi la legge
    // dopo il film la testata si nasconde scendendo e torna salendo
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: function (s) {
      if (!stFilm) return;   // se si scorre mentre la home carica, questa regola parte prima che il film sia pronto
      var dopo = s.scroll() > stFilm.end + window.innerHeight * .5;
      var su = dopo && s.direction === 1 && menu.hidden;
      testata.classList.toggle('testata--nascosta', su);
      H.classList.toggle('testata-su', su); // la barra dei settori e la finestra salgono al posto della testata
      testata.classList.toggle('testata--piena', s.scroll() > stFilm.end + window.innerHeight * .9);
    } });
    stFilm = ScrollTrigger.create({
      trigger: film,
      start: 'top top',
      end: function () { return '+=' + Math.round(tl.duration() * window.innerHeight * .38); },   // giro 3: un quarto più corto
      pin: true,
      anticipatePin: LEGGERO ? 1 : 0,
      scrub: LEGGERO >= 3 ? .5 : true,
      animation: tl,
      invalidateOnRefresh: true,
      // 22/11: basta un tocco di scorrimento e il capitolo si completa da solo fino alla tappa successiva (o precedente)
      snap: snapNativo({ snapTo: 'labelsDirectional', duration: { min: .7, max: 1.6 }, delay: .06, ease: 'power1.inOut', inertia: false }),
      onUpdate: aggiornaFilm,
      onRefreshInit: function () { /* torna alla misura vera prima di rimisurare */ },
      onRefresh: function () { misuraFinestre(); aggiornaFilm(); }
    });
    zonaScatto(stFilm);
    new IntersectionObserver(function (v) { filmInVista = v[0].isIntersecting; aggiornaFilm(); }, { threshold: 0 }).observe(film);

    // «Di cosa hai bisogno?»: passando sopra una scelta, nella finestra compare il suo capitolo
    var anteprima = $('.intro_anteprima'), imgAnteprima = $('img', anteprima);
    $$('.intro_scelte a').forEach(function (a) {
      a.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'mouse') return; imgAnteprima.src = a.getAttribute('data-anteprima'); anteprima.classList.add('su'); });
      a.addEventListener('pointerleave', function () { anteprima.classList.remove('su'); });
    });

    // i link ai capitoli portano al punto giusto del film
    function vaiA(label) {
      var t = tl.labels[label];
      var y = stFilm.start + (t / tl.duration()) * (stFilm.end - stFilm.start);
      lenis.scrollTo(y, { duration: 1.8, easing: function (x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; } });
    }
    $$('[data-capitolo]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault(); vaiA('c' + a.dataset.capitolo);
        // 22/11: con la tastiera (Invio, e.detail 0) il fuoco passa al capitolo, invece di restare su un link che sparisce
        if (e.detail === 0) fuocoDopo(primoLink(cap[+a.dataset.capitolo].el, 1), posizioneTappa(stFilm, 'c' + a.dataset.capitolo));
      });
    });
    $$('a[href^="#"]:not([data-capitolo])').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id === '#bisogni') { e.preventDefault(); vaiA('bisogni'); if (e.detail === 0) fuocoDopo(primoLink(intro, 1), posizioneTappa(stFilm, 'bisogni')); return; }
        if (id === '#inizio') { e.preventDefault(); lenis.scrollTo(0, { duration: 1.6 }); return; }
        var el = id.length > 1 && document.querySelector(id);
        if (el && id !== '#contenuto') { e.preventDefault(); lenis.scrollTo(el, { duration: 1.6 }); }
      });
    });

    /* ---- Apertura: il nome Birolini sale dalla maschera ---- */
    carica(videoApertura); gira(videoApertura, true);

    var avvio = gsap.timeline({ delay: .15, defaults: { ease: 'expo.out' } });
    /* 22/11 sera (Carlo: «il primo render di Redona fa qualche scattino»): tolto lo zoom all'indietro sul video
       (1.14 → 1): il filmato si avvicina già da solo e i due movimenti opposti davano uno strappo quando lo zoom si fermava */
    avvio.to(nome, { y: 0, duration: 1.5, stagger: .07 }, .25)
      .to(righeFrase, { yPercent: 0, duration: 1.2, stagger: .09 }, .95)
      .to(azioni, { autoAlpha: 1, duration: .8, ease: 'power2.out', onUpdate: function () { if (this.progress() > .45 && azioni.style.pointerEvents) azioni.style.pointerEvents = ''; } }, 1.35)
      .to([testoSotto, $('.apertura_scorri span')], { opacity: 1, duration: .8, ease: 'power2.out' }, 1.6);

    /* =====================================================
       Dal disegno all'edificio (da C): tre tavole, una sola scena fissata.
       Il disegno si traccia da sinistra, poi il colore sale dal basso come un cantiere.
       Si muovono solo trasformazioni: il contenitore scorre e il contenuto fa il movimento opposto.
       ===================================================== */
    var scenaC = $('.costruzioni_scena');
    var tavole = $$('.tavola', scenaC).map(function (t) {
      var fig = $('.tavola_figura', t);
      var traccia = document.createElement('span'); traccia.className = 'tavola_traccia'; traccia.setAttribute('aria-hidden', 'true'); fig.appendChild(traccia);
      return {
        el: t, fig: fig, traccia: traccia,
        dis: $('.tavola_disegno', t), disImg: $('.tavola_disegno img', t),
        col: $('.tavola_colore', t), colDentro: $('.tavola_colore-dentro', t), colImg: $('.tavola_colore img', t),
        quota: $('.tavola_quota', t), cart: $('.cartiglio', t)
      };
    });
    var capoC = $('.costruzioni_capo'), numeroC = $('.costruzioni_n');
    var righeCapoC = righe($('.costruzioni_titolo'));
    // (giro 3) un solo movimento: il disegno entra dal basso con il suo fondo (niente schermo vuoto tra le tavole),
    // poi il colore sale alla stessa misura del disegno (combaciano sulla linea); l'avvicinamento solo a colore finito
    tavole.forEach(function (t, i) {
      gsap.set(t.el, { autoAlpha: i === 0 ? 1 : 0 });
      gsap.set(t.dis, { yPercent: i === 0 ? 0 : 100 }); gsap.set(t.disImg, { yPercent: i === 0 ? 0 : -100 });
      gsap.set(t.col, { yPercent: 100 }); gsap.set(t.colDentro, { yPercent: -100 });
      gsap.set(t.quota, { yPercent: 100, autoAlpha: 0 }); gsap.set(t.traccia, { y: 0, autoAlpha: 0 });
      gsap.set(t.cart, { autoAlpha: 0, y: 24 });
    });
    gsap.set(righeCapoC, { yPercent: 105 });
    var tlC = gsap.timeline({ defaults: { ease: 'none' } });
    var PASSO = 1.55;
    tavole.forEach(function (t, i) {
      var k = i * PASSO;
      if (i > 0) {
        var prima = tavole[i - 1];
        tlC.to(prima.cart, { autoAlpha: 0, y: -20, duration: .25, ease: 'power2.in' }, k - .05)
          .set(t.el, { autoAlpha: 1 }, k)
          .to(t.dis, { yPercent: 0, duration: .6, ease: 'power2.inOut' }, k)
          .to(t.disImg, { yPercent: 0, duration: .6, ease: 'power2.inOut' }, k)
          .fromTo(t.traccia, { y: 0, autoAlpha: 1 }, { y: function () { return -t.fig.clientHeight; }, duration: .6, ease: 'power2.inOut' }, k)
          .set(t.traccia, { autoAlpha: 0 }, k + .6)
          .set(prima.el, { autoAlpha: 0 }, k + .6);
      }
      // il nome del progetto si vede già sul disegno
      tlC.to(t.cart, { autoAlpha: 1, y: 0, duration: .3, ease: 'power2.out' }, k + (i ? .3 : .15))
        .set(t.quota, { autoAlpha: 1 }, k + .6)
        .to(t.col, { yPercent: 0, duration: .8, ease: 'power3.inOut' }, k + .6)
        .to(t.colDentro, { yPercent: 0, duration: .8, ease: 'power3.inOut' }, k + .6)
        .to(t.quota, { yPercent: 0, duration: .8, ease: 'power3.inOut' }, k + .6)
        .set(t.quota, { autoAlpha: 0 }, k + 1.4)
        .fromTo(t.colImg, { scale: 1 }, { scale: 1.04, duration: .5, ease: 'none' }, k + 1.4);
    });
    gsap.to(righeCapoC, { yPercent: 0, duration: 1.1, stagger: .08, ease: 'expo.out', scrollTrigger: { trigger: scenaC, start: 'top 70%', once: true } });
    tlC.to(capoC, { autoAlpha: 0, y: -24, duration: .25, ease: 'power2.in' }, .45)
      .to({}, { duration: .35 }, tavole.length * PASSO - .1);
    var contaOra = 1;
    tlC.addLabel('tavole-inizio', 0);
    tavole.forEach(function (t, i) { tlC.addLabel('tavola-' + i, i === tavole.length - 1 ? tlC.duration() : Math.min(tlC.duration(), i * PASSO + 1.45)); });   // giro 6: l'ultima tavola coincide con la fine (niente colpo a vuoto)
    tlC.addLabel('tavole-fine', tlC.duration());
    var stC = zonaScatto(ScrollTrigger.create({
      trigger: scenaC, start: 'top top',
      end: function () { return '+=' + Math.round(tlC.duration() * window.innerHeight * .37); },
      pin: true, anticipatePin: LEGGERO ? 1 : 0, scrub: LEGGERO >= 3 ? .5 : true, animation: tlC, invalidateOnRefresh: true,
      // 22/11: ogni tavola, iniziata, si completa da sola (disegno -> colore). Tappe con direzione: con un elenco di punti
      // la rotella del computer (Lenis) tornava al punto più vicino, cioè indietro, e la pagina restava bloccata
      snap: snapNativo({ snapTo: 'labelsDirectional', duration: { min: .6, max: 1.4 }, delay: .06, ease: 'power1.inOut', inertia: false }),
      onUpdate: function () {
        var n = Math.min(tavole.length, Math.floor((tlC.time() + .05) / PASSO) + 1);
        if (n !== contaOra) { contaOra = n; numeroC.textContent = n; }
      }
    }));

    /* =====================================================
       22/11: tastiera (revisione giro 4, n. 9). I capitoli del film e le tavole restano nascosti finché non si scorre
       fino a loro, quindi il tasto Tab li saltava. Se il prossimo link (o il precedente, con Maiusc+Tab) sta in una scena
       ancora nascosta, la pagina scorre fino alla sua tappa e, quando il link si vede, il fuoco ci va sopra.
       In tutti gli altri casi il Tab resta quello normale del browser.
       ===================================================== */
    var stTempoOra = null;   // giro 7: la linea del tempo fissata (solo schermi larghi), vista anche fuori dal suo blocco
    var sceneTastiera = [
      { el: azioni, st: stFilm, tappa: 'inizio' },
      { el: intro, st: stFilm, tappa: 'bisogni' }
    ].concat(cap.map(function (c, i) { return { el: c.el, st: stFilm, tappa: 'c' + i }; }))
      .concat([{ el: indice, st: stFilm, tappa: 'c3' }])
      .concat(tavole.map(function (t, i) { return { el: t.el, st: stC, tappa: 'tavola-' + i }; }))
      .concat([{ el: $('.tempo_lista'), pos: function (el) {   // giro 7: la tappa della tessera, con la formula dello scatto
        var st = stTempoOra, lt = $('.tempo_lista'), t = el.closest('.tappa');
        if (!st || !t) return null;
        var d = Math.max(0, lt.scrollWidth - window.innerWidth);
        if (!d) return st.start;
        var x = Math.min(d, Math.max(0, t.offsetLeft + t.offsetWidth / 2 - window.innerWidth / 2));
        return st.start + x / d * (st.end - st.start);
      } }]);
    var SEL_FUOCO = 'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
    function posizioneTappa(st, tappa) {   // stessa formula di vaiA e delle tappe dello scatto: si arriva proprio sulla tappa
      var a = st.animation; return st.start + (a.labels[tappa] / a.duration()) * (st.end - st.start);
    }
    function nascosto(el) { return getComputedStyle(el).visibility === 'hidden' || !!el.closest('[inert]'); }
    function inGiro(el) { return el.tabIndex !== -1 && el.getClientRects().length > 0; }   // niente elementi spenti (display: none)
    function primoLink(dove, verso) { var l = $$(SEL_FUOCO, dove).filter(inGiro); return verso > 0 ? l[0] : l[l.length - 1]; }
    var fuocoInViaggio = false;
    function fuocoDopo(el, y) {
      if (!el) return;
      fuocoInViaggio = true;
      var t0 = performance.now();
      (function guarda() {
        var arrivato = Math.abs(window.scrollY - y) < 4;
        if (arrivato && !nascosto(el)) {
          el.focus({ preventScroll: true });
          fuocoInViaggio = false; return;
        }
        if (performance.now() - t0 > 3000) { fuocoInViaggio = false; return; }   // non arriva: si lascia stare (niente giri infiniti)
        requestAnimationFrame(guarda);
      })();
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
      if (fuocoInViaggio) { e.preventDefault(); return; }   // la pagina sta ancora scorrendo verso il link: un Tab alla volta
      if (!menu.hidden) return;
      var ora = document.activeElement;
      if (!ora || ora === document.body) return;
      var tutti = $$(SEL_FUOCO).filter(function (x) { return x === ora || inGiro(x); });
      var k = tutti.indexOf(ora); if (k === -1) return;
      var verso = e.shiftKey ? -1 : 1;
      // il prossimo link nel giro del Tab, saltando quelli nascosti fuori dalle scene (come fa il browser)
      for (var j = k + verso; j >= 0 && j < tutti.length; j += verso) {
        var dopo = tutti[j];
        var scena = sceneTastiera.filter(function (s) { return s.el && s.el.contains(dopo); })[0];
        if (!nascosto(dopo)) {
          // si vede già: ci pensa il browser. Ma se è in una scena e fuori dallo schermo (tornando indietro con Maiusc+Tab)
          // il browser scorrerebbe a caso dentro la scena fissata: si va alla sua tappa
          var rc = dopo.getBoundingClientRect();
          if (!scena || (rc.bottom > 0 && rc.top < window.innerHeight && rc.right > 0 && rc.left < window.innerWidth)) return;   // giro 7: anche fuori di lato
        } else if (!scena) continue;   // nascosto e fuori dalle scene: il browser lo salta, lo saltiamo anche noi
        e.preventDefault();
        var y = scena.pos ? scena.pos(dopo) : posizioneTappa(scena.st, scena.tappa);
        if (y == null) return;
        lenis.scrollTo(y, { duration: Math.min(1.4, Math.max(.5, Math.abs(y - window.scrollY) / 900)) });
        fuocoDopo(dopo, y);
        return;
      }
    }, true);

    /* ---- Indice: la finestra sui progetti cambia con la tendina e il video parte ---- */
    var mm = gsap.matchMedia();
    videoAmmessi = true; scorriA = function (y) { lenis.scrollTo(y, { duration: 1.2 }); };
    ScrollTrigger.addEventListener('refresh', misuraCorpo);
    videoGiusto();
    filtriAnimati = true;
    // (giro 3) tolta la finestra che nasceva da una riga sottile: un effetto in meno
    // i pulsanti dei settori si accendono da soli mentre si scorre (solo l'aspetto, non il filtro)
    gruppi.forEach(function (g) {
      var tasto = $('.filtro[data-filtro="' + g.getAttribute('data-settore') + '"]');
      ScrollTrigger.create({ trigger: g, start: 'top 55%', end: 'bottom 55%', onToggle: function (s) {
        tasto.classList.toggle('in-vista', s.isActive);
        if (s.isActive && telefono.matches) centraTasto(tasto);
      } });
    });

    /* =====================================================
       Dal 1979: le cifre sono una finestra su una foto vera (Pedrengo, progetto del 1980);
       scorrendo crescono finché la foto riempie lo schermo, e da lì parte la linea del tempo
       ===================================================== */
    var scenaStoria = $('.storia_scena'), svgStoria = $('.storia_svg');
    if (telefono.matches) {   // sul telefono la scena è verticale
      svgStoria.setAttribute('viewBox', '0 0 1000 1600');
      $$('text', svgStoria).forEach(function (t) { t.setAttribute('x', 500); t.setAttribute('y', 640); t.style.fontSize = '250px'; t.style.letterSpacing = '-8px'; });
      $('.storia_foto', svgStoria).setAttribute('width', 1000); $('.storia_foto', svgStoria).setAttribute('height', 1600);
      $$('mask rect', svgStoria).forEach(function (r) { r.setAttribute('width', 1000); r.setAttribute('height', 1600); });
      $('mask', svgStoria).setAttribute('width', 1000); $('mask', svgStoria).setAttribute('height', 1600);
      $('.storia_video', svgStoria).setAttribute('width', 1000); $('.storia_video', svgStoria).setAttribute('height', 1600);
    }
    var cifre = $$('.storia_cifre, .storia_tratto', svgStoria), pieno = $('.storia_pieno', svgStoria);
    var centro = telefono.matches ? '500 560' : '1040 500';
    var tlStoria = gsap.timeline({ defaults: { ease: 'none' } });
    var storiaLeggera = function (tlS) {
      var NS = 'http://www.w3.org/2000/svg', vb = svgStoria.getAttribute('viewBox').split(' ');
      var vw = +vb[2], vh = +vb[3];
      var img = document.createElement('img');
      img.className = 'storia_foto-l'; img.alt = ''; img.decoding = 'async'; img.setAttribute('aria-hidden', 'true');
      img.src = $('.storia_foto', svgStoria).getAttribute('href');
      var cop = document.createElementNS(NS, 'svg');
      cop.setAttribute('class', 'storia_svg storia_coperchio'); cop.setAttribute('viewBox', vb.join(' '));
      cop.setAttribute('preserveAspectRatio', 'xMidYMid slice'); cop.setAttribute('aria-hidden', 'true'); cop.setAttribute('focusable', 'false');
      var testo = $('.storia_cifre text', svgStoria);
      var buco = testo.cloneNode(true); buco.style.fill = '#000';
      var mask = document.createElementNS(NS, 'mask'); mask.setAttribute('id', 'buco-1979'); mask.setAttribute('maskUnits', 'userSpaceOnUse');
      mask.setAttribute('x', 0); mask.setAttribute('y', 0); mask.setAttribute('width', vw); mask.setAttribute('height', vh);
      var bianco = document.createElementNS(NS, 'rect'); bianco.setAttribute('width', vw); bianco.setAttribute('height', vh); bianco.setAttribute('fill', '#fff');
      mask.appendChild(bianco); mask.appendChild(buco);
      var defs = document.createElementNS(NS, 'defs'); defs.appendChild(mask); cop.appendChild(defs);
      var notte = document.createElementNS(NS, 'rect'); notte.setAttribute('width', vw); notte.setAttribute('height', vh); notte.setAttribute('mask', 'url(#buco-1979)'); notte.style.fill = 'var(--notte)';
      cop.appendChild(notte);
      var tratto = document.createElementNS(NS, 'g'); tratto.setAttribute('class', 'storia_tratto'); tratto.appendChild(testo.cloneNode(true)); cop.appendChild(tratto);
      scenaStoria.insertBefore(img, svgStoria); scenaStoria.insertBefore(cop, svgStoria);
      svgStoria.style.display = 'none';
      // il centro dell'ingrandimento è il centro delle cifre (in pixel dello schermo)
      function centra() {
        var bb = tratto.getBBox(), W = scenaStoria.clientWidth, Hs = scenaStoria.clientHeight;
        var sc = Math.max(W / vw, Hs / vh), ox = (W - vw * sc) / 2, oy = (Hs - vh * sc) / 2;
        gsap.set(cop, { transformOrigin: (ox + (bb.x + bb.width / 2) * sc).toFixed(1) + 'px ' + (oy + (bb.y + bb.height / 2) * sc).toFixed(1) + 'px' });
      }
      centra(); ScrollTrigger.addEventListener('refreshInit', centra);
      tlS.to('.storia_testo', { autoAlpha: 0, y: -40, duration: .3, ease: 'power2.in' }, .05)
        .to('.storia_velo', { opacity: 0, duration: .3 }, .1)
        .to(cop, { scale: 7, duration: 1, ease: 'power2.in' }, .1)
        .to(tratto, { opacity: 0, duration: .3 }, .6)
        .to(cop, { autoAlpha: 0, duration: .35 }, .75)
        .fromTo(img, { scale: 1.08 }, { scale: 1, duration: 1.1 }, 0)
        .to({}, { duration: .15 }, 1.1);
    };
    if (LEGGERO >= 3) storiaLeggera(tlStoria); else tlStoria.to('.storia_testo', { autoAlpha: 0, y: -40, duration: .3, ease: 'power2.in' }, .05)
      .to('.storia_velo', { opacity: 0, duration: .3 }, .1)
      .to(cifre, { scale: 7, svgOrigin: centro, duration: 1, ease: 'power2.in' }, .1)
      .to('.storia_tratto', { opacity: 0, duration: .3 }, .6)
      .to(pieno, { attr: { 'fill-opacity': 1 }, duration: .35 }, .75)
      .fromTo(['.storia_foto', '.storia_video'], { scale: 1.08, svgOrigin: centro }, { scale: 1, duration: 1.1 }, 0)
      .to({}, { duration: .15 }, 1.1);
    tlStoria.addLabel('storia-chiusa', 0).addLabel('storia-aperta', tlStoria.duration());
    zonaScatto(ScrollTrigger.create({
      trigger: scenaStoria, start: 'top top', end: function () { return '+=' + Math.round(window.innerHeight * .9); },
      pin: true, anticipatePin: LEGGERO ? 1 : 0, scrub: LEGGERO >= 3 ? .5 : true, animation: tlStoria, snap: snapNativo({ snapTo: 'labelsDirectional', duration: { min: .6, max: 1.3 }, delay: .06, ease: 'power1.inOut', inertia: false }) // 22/11: il 1979 si apre da solo
    }));
    var videoStoria = $('.storia_video video');
    if (videoStoria && videoStoria.dataset.src && !LEGGERO) {
      var didascaliaStoria = $('.storia_didascalia');
      new IntersectionObserver(function (v) { if (v[0].isIntersecting) carica(videoStoria); gira(videoStoria, v[0].isIntersecting); }, { rootMargin: '300px 0px' }).observe(scenaStoria);
      videoStoria.addEventListener('playing', function () { didascaliaStoria.textContent = didascaliaStoria.getAttribute('data-dicitura-video'); }, { once: true });
    }

    /* =====================================================
       Linea del tempo (da C), solo sul computer: fissata, scorre di lato;
       ogni tessera passa dal bianco e nero al colore, l'anno gigante dietro scorre più lento.
       Sul telefono si sfoglia col dito (niente pin).
       ===================================================== */
    var lista = $('.tempo_lista'), annoEl = $('.tempo_anno-corrente span');
    var tappe = $$('.tappa', lista);
    mm.add('(min-width: 761px)', function () {
      var barraTempo = gsap.quickSetter($('.tempo_avanzamento i'), 'scaleX');
      function contaAnno(a) {   // giro 7: l'anno scorre come un contachilometri invece di saltare
        var da = parseInt(annoEl.textContent, 10), b = parseInt(a, 10);
        if (annoTw) annoTw.kill();
        if (isNaN(da) || isNaN(b) || Math.abs(b - da) > 40 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { annoEl.textContent = a; return; }
        var o = { v: da };
        annoTw = gsap.to(o, { v: b, duration: Math.min(.8, .15 + Math.abs(b - da) * .06), ease: 'power2.out', onUpdate: function () { annoEl.textContent = Math.round(o.v); } });
      }
      var annoMeta = null, annoTw = null;

      var distanza = function () { return Math.max(0, lista.scrollWidth - window.innerWidth); };
      var scorriTempo = gsap.to(lista, {
        x: function () { return -distanza(); }, ease: 'none',
        scrollTrigger: {
          trigger: '.tempo_fissa', pin: true, start: 'top top', end: function () { return '+=' + Math.round(distanza() * .25); },
          scrub: true, invalidateOnRefresh: true,
          // giro 6: sul computer (Lenis) lo snap «al punto più vicino» faceva risalire la pagina di ~48 px a ogni gesto: lì lo scatto lo fa Lenis, con direzione
          snap: snapNativo({ snapTo: function (v, self) { var d = distanza(); if (!d) return v; var px = v * d, dir = self && self.direction, best = null, bd = 1e9; tappe.forEach(function (t) { var x = Math.min(d, Math.max(0, t.offsetLeft + t.offsetWidth / 2 - window.innerWidth / 2)); if ((dir > 0 && x < px - 2) || (dir < 0 && x > px + 2)) return; if (Math.abs(x - px) < bd) { bd = Math.abs(x - px); best = x; } }); return best == null ? v : best / d; },   /* giro 7: nel verso del gesto */ duration: { min: .25, max: .7 }, delay: .12, ease: 'power2.inOut', inertia: false }),
          onUpdate: function (s) {
            barraTempo(s.progress);
            var x = -gsap.getProperty(lista, 'x') + window.innerWidth * .5, scelta = tappe[0];
            for (var k = 0; k < tappe.length; k++) { if (tappe[k].offsetLeft <= x) scelta = tappe[k]; else break; }
            var a = scelta.dataset.anno; if (annoMeta !== a) { annoMeta = a; contaAnno(a); }
          }
        }
      });
      var stTempo = scorriTempo.scrollTrigger;
      stTempoOra = stTempo;
      stTempo._tappe = function () {   // una tappa per tessera (al centro dello schermo), più inizio e fine
        var d = distanza(), out = [stTempo.start, stTempo.end];
        if (d) tappe.forEach(function (t) { var x = Math.min(d, Math.max(0, t.offsetLeft + t.offsetWidth / 2 - window.innerWidth / 2)); out.push(stTempo.start + x / d * (stTempo.end - stTempo.start)); });
        return out.sort(function (a, b) { return a - b; });
      };
      zonaScatto(stTempo);
      gsap.fromTo('.tempo_anno-corrente', { xPercent: 4 }, { xPercent: -12, ease: 'none',
        scrollTrigger: { trigger: '.tempo_fissa', start: 'top top', end: function () { return '+=' + Math.round(distanza() * .25); }, scrub: true } });
      $$('.tappa_col', lista).forEach(function (img) {
        gsap.to(img, { opacity: 1, ease: 'none',
          scrollTrigger: { trigger: img.parentNode, containerAnimation: scorriTempo, start: 'left 80%', end: 'center 52%', scrub: true } });
      });
      return function () { stTempoOra = null; var i = zoneScatto.indexOf(stTempo); if (i !== -1) zoneScatto.splice(i, 1); };   // finestra stretta: la scena sparisce
    });

    /* ---- Passaggi «a foglio»: la sezione nuova sale sopra la vecchia e il suo angolo si raddrizza ---- */
    (LEGGERO ? [] : $$('.costruzioni, .indice, .storia, .contatto')).forEach(function (s) {
      gsap.fromTo(s, { borderTopLeftRadius: 28, borderTopRightRadius: 28 }, { borderTopLeftRadius: 0, borderTopRightRadius: 0, ease: 'none',
        scrollTrigger: { trigger: s, start: 'top bottom', end: 'top top', scrub: true } });
    });

    /* ---- 22/11: anche il passaggio da una sezione all'altra si completa da solo (Carlo: «se non scorri rimane così»):
       mentre la sezione nuova sale sopra la vecchia, un tocco di scorrimento la porta fino in cima (o la rimanda giù tornando indietro).
       Separato dagli angoli qui sopra, che sul telefono non ci sono (leggero.mjs). ---- */
    ['.costruzioni', '.indice', '.storia', '.contatto'].forEach(function (sel) {
      var sezione = $(sel); if (!sezione) return;
      // una linea del tempo vuota con due tappe, solo per avere lo scatto «con direzione» (vedi le tavole)
      var tappe = gsap.timeline({ paused: true }).addLabel('sotto', 0).to({}, { duration: 1 }).addLabel('sopra', 1);
      // giro 6: dopo una scena fissata il passaggio comincia proprio dove la scena finisce (prima si sovrapponevano di 28 px e la pagina si fermava a metà)
      var primaScena = sel === '.costruzioni' ? stFilm : sel === '.indice' ? stC : null;
      var dopoTempo = sel === '.contatto';
      zonaScatto(ScrollTrigger.create({ trigger: sezione, start: primaScena ? function () { return primaScena.end; } : dopoTempo ? function () { return stTempoOra ? stTempoOra.end : 'top bottom'; } : 'top bottom', end: 'top top', animation: tappe, scrub: true,
        snap: snapNativo({ snapTo: 'labelsDirectional', duration: { min: .5, max: 1.1 }, delay: .06, ease: 'power1.inOut', inertia: false }) }));
    });

    /* ---- Titoli: entrate diverse (righe che salgono, oppure niente) ---- */
    $$('.indice [data-righe]').forEach(function (el) {
      var r = righe(el);
      gsap.from(r, { yPercent: 105, duration: 1.1, stagger: .08, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
    });
    gsap.from('.indice_42', { xPercent: -8, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.indice_titolo', start: 'top 86%', once: true } });

    /* ---- Video dei capitoli preparati in anticipo, uno alla volta, mentre gira l'apertura ---- */
    // 21/11: solo il primo capitolo (prima si scaricavano tutti e quattro, circa 15 MB, anche senza scorrere); gli altri li prepara il film poco prima che servano
    var daPreparare = (navigator.connection && navigator.connection.saveData) ? [] : [cap[0].video];
    var preparaVideo = function () {
      var v = daPreparare.shift(); if (!v) return;
      carica(v);
      setTimeout(preparaVideo, 1200);
    };
    if (!LEGGERO) setTimeout(preparaVideo, 2600);   // sul telefono i video si caricano solo poco prima di servire

    /* ---- Finale: la notte di Redona entra da una maschera e gira solo quando si vede ---- */
    var videoFinale = $('.finale video');
    if (!LEGGERO) gsap.fromTo('.finale_media', { clipPath: 'inset(12% 12% 12% 12%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
      scrollTrigger: { trigger: '.finale', start: 'top bottom', end: 'top top', scrub: true } });
    if (!LEGGERO) gsap.fromTo('.finale_media video', { scale: 1.15 }, { scale: 1, ease: 'none',
      scrollTrigger: { trigger: '.finale', start: 'top bottom', end: 'bottom top', scrub: true } });
    new IntersectionObserver(function (v) { if (v[0].isIntersecting) carica(videoFinale); gira(videoFinale, v[0].isIntersecting); }, { rootMargin: '300px 0px' }).observe($('.finale'));

    /* ---- Giro 3: «dove sono». Cinque parti della pagina; il segnaposto sta nella fascia della testata
       (resta anche quando la testata si nasconde) e un filo in cima dice quanto manca ---- */
    var parti = [
      { el: film, nome: 'Cosa facciamo', corto: 'Settori' },   // 22/11: sito istituzionale, niente «bisogni»
      { el: $('.costruzioni'), nome: "Dal disegno all'edificio", corto: 'Dal disegno' },
      { el: $('.indice'), nome: 'I progetti', corto: 'Progetti' },
      { el: $('.storia'), nome: 'Chi siamo, dal 1979', corto: 'Chi siamo' },
      { el: $('.contatto'), nome: 'Contatti', corto: 'Contatti' }
    ].filter(function (p) { return p.el; });
    var segno = document.createElement('div');
    segno.className = 'segnaposto'; segno.setAttribute('aria-hidden', 'true');
    segno.innerHTML = '<span class="segnaposto_n"></span><span class="segnaposto_nome"></span><span class="segnaposto_corto"></span>';
    var filo = document.createElement('div'); filo.className = 'filo-pagina'; filo.setAttribute('aria-hidden', 'true'); filo.innerHTML = '<i></i>';
    document.body.appendChild(segno); document.body.appendChild(filo);
    var filoX = gsap.quickSetter($('i', filo), 'scaleX'), parteOra = -1, inizioParti = [], segnoSu = null, filoSu = null;
    // dove comincia ogni parte: si misura solo quando ScrollTrigger rimisura la pagina, non a ogni fotogramma
    function misuraParti() {
      inizioParti = parti.map(function (p) { var el = p.el.parentNode && p.el.parentNode.classList.contains('pin-spacer') ? p.el.parentNode : p.el; return el.getBoundingClientRect().top + window.scrollY; });
    }
    function aggiornaSegno(prog) {
      filoX(prog);
      var y = window.scrollY, meta = y + window.innerHeight * .5, k = 0;
      for (var j = 0; j < inizioParti.length; j++) { if (inizioParti[j] <= meta) k = j; }
      var su = y > window.innerHeight * .6;   // nella prima schermata no: c'è il nome Birolini
      // nei progetti, quando la testata si nasconde, in alto salgono i filtri: lì basta il contatore «09 / 42»
      var s1 = su && !(parti[k].el.classList.contains('indice') && H.classList.contains('testata-su'));
      if (s1 !== segnoSu) { segnoSu = s1; segno.classList.toggle('su', s1); }
      if (su !== filoSu) { filoSu = su; filo.classList.toggle('su', su); }
      if (k !== parteOra) {
        parteOra = k;
        $('.segnaposto_n', segno).textContent = (k + 1) + ' / ' + parti.length;
        $('.segnaposto_nome', segno).textContent = parti[k].nome;
        $('.segnaposto_corto', segno).textContent = parti[k].corto;
      }
    }
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: function (s) { aggiornaSegno(s.progress); }, onRefresh: function (s) { misuraParti(); aggiornaSegno(s.progress); } });

    /* ---- Misure giuste dopo il caricamento di caratteri e immagini ---- */
    misuraFinestre();
    /* 22/11 sera: il ricalcolo di tutte le scene (caratteri pronti, pagina caricata) bloccava la pagina mentre il nome
       saliva: ora aspetta la fine dell'apertura, oppure il primo gesto (rotella, dito, tasto), se arriva prima */
    var introFinita = false, daRinfrescare = false, altezzaAvvio = document.documentElement.scrollHeight;
    function rinfresca() {
      /* se l'altezza della pagina non è cambiata le misure sono già giuste: niente ricalcolo (costa ~0,4 s) */
      if (Math.abs(document.documentElement.scrollHeight - altezzaAvvio) < 2) return;
      altezzaAvvio = document.documentElement.scrollHeight;
      if (introFinita) ScrollTrigger.refresh(); else daRinfrescare = true;
    }
    function fineIntro() {
      if (introFinita) return;
      introFinita = true;
      ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (e) { window.removeEventListener(e, fineIntro, true); });
      if (daRinfrescare) { daRinfrescare = false; ScrollTrigger.refresh(); }
    }
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (e) { window.addEventListener(e, fineIntro, { capture: true, passive: true }); });
    avvio.eventCallback('onComplete', fineIntro);
    setTimeout(fineIntro, 4000);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rinfresca);
    window.addEventListener('load', rinfresca);
  }
})();
