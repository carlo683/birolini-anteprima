/* =========================================================
   «La finestra sui progetti» come componente: funziona su ogni elemento .indice della pagina.
   Una sola immagine grande alla volta e un solo video che cambia sorgente.
   Il progetto attivo cambia quando una riga passa la linea (metà schermo sul computer, bordo basso
   della finestra sul telefono), col mouse quando si muove davvero, col tasto Tab e con le frecce.
   La finestra non resta MAI vuota (correzione del 20/11, la stessa del MIX):
   - l'immagine nuova si scarica e si decodifica fuori dallo schermo; finché non è pronta resta quella di prima;
   - si carica solo nello strato nascosto; una tendina alla volta, e vince l'ultima richiesta;
   - il video parte solo quando può davvero girare, sopra il suo fotogramma poster già in vista;
   - si preparano le immagini delle righe vicine.
   Da fermo («riduci movimento»): l'immagine cambia di colpo e il video non parte.
   Evento: l'elemento .indice manda «finestra:filtro» con { settore, testo } quando cambia il filtro.
   ========================================================= */
(function () {
  'use strict';
  var B = window.B, $ = B.$, $$ = B.$$;
  var senzaAccenti = function (s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var due = function (n) { return (n < 10 ? '0' : '') + n; };
  var memoria = {};   // url -> promessa dell'immagine già decodificata (comune a tutte le finestre)
  function prendi(url) {
    if (memoria[url]) return memoria[url];
    var i = new Image(); i.decoding = 'async'; i.src = url;
    var p = i.decode ? i.decode() : new Promise(function (ok, no) { i.onload = ok; i.onerror = no; });
    memoria[url] = p = p.then(function () { return i; });
    p.catch(function () { delete memoria[url]; });
    return p;
  }

  function Finestra(radice) {
    var animata = false, videoAmmessi = false;   // diventano veri quando GSAP e il movimento sono accesi
    var fp = $('.fp', radice), fpStrati = $$('.fp_strato', radice), fpVideo = $('.fp_video', radice);
    var fpNome = $('.fp_nome', radice), fpMeta = $('.fp_meta', radice), fpTipo = $('.fp_tipo', radice), fpN = $('.fp_n', radice), fpTot = $('.fp_tot', radice);
    var liste = $('.indice_liste', radice), voci = $$('.voce', radice), gruppi = $$('.gruppo', radice), filtri = $$('.filtri .filtro', radice);
    var campoCerca = $('.cerca_campo', radice), nessuno = $('.indice_nessuno', radice), barraFiltri = $('.filtri', radice);
    var corpo = $('.indice_corpo', radice);
    var settoreOra = 'tutti', attiva = null, sopra = 0, fpInVista = false, direzione = 'basso';
    var immagine = function (a) { return B.telefono.matches ? a.getAttribute('data-img-tel') : a.getAttribute('data-img'); };
    var visibili = function () { return voci.filter(function (v) { return v.style.display !== 'none'; }); };

    /* ---- immagine e video ---- */
    var mostrata = null, tendina = null, richiesta = 0, inCoda = null, fineUltima = 0, attesaCoda = null;
    var PAUSA = 120, DURATA = .6;
    function precarica(a) { if (a) prendi(immagine(a)).catch(function () {}); }
    function clipDi(a) { return a && ((B.schermoGrande() && a.getAttribute('data-clip-grande')) || a.getAttribute('data-clip')); }
    function spegniVideo() { fpVideo.style.transition = 'none'; fpVideo.classList.remove('in-onda'); void fpVideo.offsetWidth; fpVideo.style.transition = ''; }
    function videoGiusto() {
      if (!fpVideo) return;
      var clip = clipDi(mostrata);
      if (!videoAmmessi || !clip || !fpInVista || mostrata !== attiva) { fpVideo.classList.remove('in-onda'); if (!fpVideo.paused) fpVideo.pause(); return; }
      if (fpVideo.getAttribute('src') !== clip) { spegniVideo(); fpVideo.preload = 'auto'; fpVideo.setAttribute('src', clip); return; }   // parte da «canplay»
      if (fpVideo.readyState >= 3) { var p = fpVideo.play(); if (p && p.catch) p.catch(function () {}); }
    }
    if (fpVideo) {
      fpVideo.addEventListener('canplay', function () {
        if (clipDi(mostrata) === fpVideo.getAttribute('src') && fpInVista && videoAmmessi && mostrata === attiva) { var p = fpVideo.play(); if (p && p.catch) p.catch(function () {}); }
      });
      fpVideo.addEventListener('playing', function () { if (clipDi(mostrata) === fpVideo.getAttribute('src') && mostrata === attiva) fpVideo.classList.add('in-onda'); });
    }
    function scriviDati(a) {
      fpNome.textContent = a.getAttribute('data-nome'); fpNome.href = a.href;
      fpMeta.textContent = a.getAttribute('data-meta');
      var tipo = a.getAttribute('data-tipo') || '';
      // da fermo il video non parte: si vede il fotogramma poster, quindi «Render» o «Foto», non «animato»
      fpTipo.textContent = videoAmmessi || !a.getAttribute('data-clip') ? tipo : tipo.replace(/ animat[ao]$/, '');
    }
    function chiediImmagine(a, subito) {
      var n = ++richiesta, url = immagine(a);
      prendi(url).then(function () {
        if (n !== richiesta) return;
        inCoda = { a: a, url: url, subito: subito }; prova();
      }, function () {
        if (n !== richiesta) return;   // l'immagine non c'è: resta quella di prima, con i dati giusti
        scriviDati(a); mostrata = null; videoGiusto();
      });
    }
    function prova() {
      if (!inCoda || tendina) return;
      var resta = fineUltima + PAUSA - performance.now();
      if (resta > 0) { clearTimeout(attesaCoda); attesaCoda = setTimeout(prova, resta); return; }
      var c = inCoda; inCoda = null;
      if (c.a === mostrata) { videoGiusto(); return; }
      entra(c.a, c.url, c.subito);
    }
    function entra(a, url, subito) {
      var vecchio = fpStrati[sopra], nuovo = fpStrati[1 - sopra], img = nuovo.firstElementChild;
      var anima = animata && (!subito || !mostrata);   // la prima foto entra dal basso invece di comparire di colpo (21/11/2026)
      var piccola = a.hasAttribute('data-piccola'), pos = a.getAttribute('data-pos') || '50% 50%';
      if (window.gsap) gsap.killTweensOf([nuovo, img]);
      nuovo.style.clipPath = 'inset(100% 0% 0% 0%)';     // sopra, ma chiuso: si vede ancora tutto il vecchio
      nuovo.style.zIndex = 2; vecchio.style.zIndex = 1;
      nuovo.classList.toggle('piccola', piccola);
      img.style.objectPosition = pos; img.style.transformOrigin = pos;
      img.alt = a.getAttribute('data-nome') + (a.getAttribute('data-tipo') ? '. ' + a.getAttribute('data-tipo') : '');
      if (window.gsap) gsap.set(img, { scale: anima && !piccola ? 1.12 : 1, xPercent: 0, yPercent: anima && !piccola ? 3 : 0 });
      tendina = true;
      img.src = url;
      var apri = function () {
        if (img.getAttribute('src') !== url) return;
        sopra = 1 - sopra; mostrata = a;
        // lo sfondo con la prima foto scritto nella pagina (solo archivio) non serve più quando lo script ha la sua
        $$('.fp_prima', fp).forEach(function (x) { setTimeout(function () { x.remove(); }, DURATA * 1000 + 200); });
        // nome e dati cambiano a metà tendina, quando l'immagine nuova copre già quasi metà finestra
        if (anima) gsap.delayedCall(DURATA * .45, function () { if (mostrata === a) scriviDati(a); }); else scriviDati(a);
        var chiudi = function () { tendina = null; fineUltima = performance.now(); videoGiusto(); prova(); };
        if (!anima) { nuovo.style.clipPath = 'none'; chiudi(); return; }
        var da = 'inset(100% 0% 0% 0%)';   // un solo movimento in tutto il sito: l'immagine nuova entra dal basso (giro 3)
        tendina = gsap.fromTo(nuovo, { clipPath: da }, { clipPath: 'inset(0% 0% 0% 0%)', duration: DURATA, ease: 'power3.inOut', onComplete: chiudi });
        if (!piccola) gsap.to(img, { scale: 1.02, yPercent: 0, duration: 1, ease: 'power3.out',
          onComplete: function () { if (!B.leggero) gsap.to(img, { scale: 1.09, duration: 14, ease: 'none' }); } });   // lento avvicinamento
      };
      if (img.decode) img.decode().then(apri, function () { tendina = null; prova(); }); else apri();
    }
    function mostraProgetto(a, subito) {
      if (!a || a === attiva) return;
      if (attiva) { attiva.classList.remove('attiva'); attiva.removeAttribute('aria-current'); }
      attiva = a; a.classList.add('attiva'); a.setAttribute('aria-current', 'true');
      var vis = visibili(), k = vis.indexOf(a.parentNode);
      vis.forEach(function (v, i) { var l = $('a', v), d = Math.abs(i - k); l.classList.toggle('d1', d === 1); l.classList.toggle('d2', d === 2); });
      if (fpN) {
        var prima = fpN.textContent; fpN.textContent = due(k + 1); fpTot.textContent = due(vis.length);
        if (animata && !subito && prima !== fpN.textContent) gsap.fromTo(fpN, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .5, ease: 'power3.out', overwrite: true });
      }
      if (fpVideo) fpVideo.classList.remove('in-onda');
      chiediImmagine(a, subito);
      var avanti = direzione === 'alto' ? -1 : 1;
      [k + avanti, k - avanti, k + 2 * avanti].forEach(function (j) { if (vis[j]) precarica($('a', vis[j])); });
    }

    /* ---- la linea che decide il progetto attivo ---- */
    var richiesto = false, corpoDa = 0, corpoA = 0, ultimoY = window.scrollY;
    var mouseComanda = false, yAlMouse = 0, mouseMosso = false, ultimoScorrimento = 0;
    function misuraCorpo() { var r = corpo.getBoundingClientRect(); corpoDa = r.top + window.scrollY; corpoA = corpoDa + r.height; }
    function controllaLinea() {
      richiesto = false;
      if (window.scrollY + window.innerHeight < corpoDa || window.scrollY > corpoA) return;
      if (mouseComanda) { if (Math.abs(window.scrollY - yAlMouse) < 120) return; mouseComanda = false; }
      var y = B.telefono.matches ? fp.getBoundingClientRect().bottom + 1 : window.innerHeight / 2;
      var vis = visibili();
      for (var k = 0; k < vis.length; k++) { if (vis[k].getBoundingClientRect().bottom > y) { mostraProgetto($('a', vis[k])); return; } }
    }
    window.addEventListener('scroll', function () {
      var y = window.scrollY; if (y !== ultimoY) direzione = y > ultimoY ? 'basso' : 'alto'; ultimoY = y;
      ultimoScorrimento = performance.now(); mouseMosso = false;
      if (!richiesto) { richiesto = true; requestAnimationFrame(controllaLinea); }
    }, { passive: true });
    window.addEventListener('resize', misuraCorpo); window.addEventListener('load', misuraCorpo); misuraCorpo();
    liste.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') mouseMosso = true; });
    voci.forEach(function (v) {
      var a = $('a', v);
      var dalMouse = function (e) {
        if (e.pointerType !== 'mouse' || B.telefono.matches || attiva === a) return;
        if (!mouseMosso || performance.now() - ultimoScorrimento < 150) return;
        mouseComanda = true; yAlMouse = window.scrollY; direzione = 'destra'; mostraProgetto(a);
      };
      a.addEventListener('pointerenter', dalMouse); a.addEventListener('pointermove', dalMouse);
      a.addEventListener('focus', function () { direzione = 'destra'; mostraProgetto(a); });
      a.addEventListener('click', function (e) { entraNelProgetto(a.href, e, a); });
    });
    liste.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var vis = visibili(), k = vis.indexOf(document.activeElement && document.activeElement.parentNode);
      if (k < 0) return;
      var dopo = vis[k + (e.key === 'ArrowDown' ? 1 : -1)];
      if (dopo) { e.preventDefault(); $('a', dopo).focus(); }
    });
    new IntersectionObserver(function (v) { fpInVista = v[0].isIntersecting; videoGiusto(); }, { threshold: 0 }).observe(fp);

    // tornando indietro, Safari ripresenta la pagina com era (bfcache): via il velo della foto allargata (21/11/2026)
    window.addEventListener('pageshow', function (e) { if (e.persisted) document.querySelectorAll('.fp_pieno').forEach(function (x) { x.remove(); }); });
    /* ---- clic: la finestra si allarga a tutto schermo, poi si apre la scheda ---- */
    function entraNelProgetto(href, e, voce) {
      if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0)) return;
      if (!animata || !window.Flip) { if (!voce) window.location.href = href; return; }   // da fermo: il link fa da sé
      if (e) e.preventDefault();
      var vai = function () { window.location.href = href; };
      setTimeout(vai, 1200);   // in ogni caso la scheda si apre
      // si allarga l'immagine del progetto TOCCATO (correzione del 20/11 sera: prima era quella nella finestra)
      var su = fpStrati[sopra].firstElementChild, src = su.src, pos = su.style.objectPosition;
      if (voce && voce !== mostrata) { src = immagine(voce); pos = voce.getAttribute('data-pos') || '50% 50%'; }
      var parti = function () {
        var r = fp.getBoundingClientRect(), velo = document.createElement('div');
        velo.className = 'fp_pieno'; velo.innerHTML = '<img alt="">';
        velo.firstChild.src = src; velo.firstChild.style.objectPosition = pos;
        gsap.set(velo, { left: r.left, top: r.top, width: r.width, height: r.height });
        document.body.appendChild(velo);
        var pieno = document.createElement('div');
        pieno.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;visibility:hidden;pointer-events:none';
        document.body.appendChild(pieno);
        Flip.fit(velo, pieno, { duration: .55, ease: 'power3.inOut', absolute: true, scale: false, onComplete: vai });
        gsap.to(velo.firstChild, { opacity: .45, duration: .55, ease: 'power2.in' });   // finisce scura come l'apertura della scheda, così il passaggio non salta (21/11/2026)
      };
      if (src === su.src) parti(); else prendi(src).then(parti, parti);   // prima si decodifica, così non cresce un riquadro vuoto
    }
    fp.addEventListener('click', function (e) { var x = mostrata || attiva; if (x) entraNelProgetto(x.href, e); });

    /* ---- filtri per settore e ricerca ---- */
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
      liste.classList.toggle('poche', visti < 8);
      misuraCorpo();
      var prima = visibili()[0];
      if (prima && (!attiva || attiva.parentNode.style.display === 'none')) { if (attiva) attiva.classList.remove('attiva'); attiva = null; mostraProgetto($('a', prima), true); }
      else if (attiva) { var a = attiva; attiva = null; mostraProgetto(a, true); }
      radice.ultimoFiltro = { settore: settoreOra, testo: q, visibili: visibili().map(function (v) { return v.getAttribute('data-slug'); }) };
      radice.dispatchEvent(new CustomEvent('finestra:filtro', { detail: radice.ultimoFiltro }));
    }
    function centraTasto(t) { if (!t || !barraFiltri) return; barraFiltri.scrollTo({ left: t.offsetLeft - (barraFiltri.clientWidth - t.offsetWidth) / 2, behavior: animata ? 'smooth' : 'auto' }); }
    function tornaSu() {
      var top = corpo.getBoundingClientRect().top;
      if (top < 0) B.scorriA(top + window.scrollY - 140, 1.2);
    }
    function cambia(f, dopo) {
      settoreOra = f;
      filtri.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filtro') === f)); });
      var stato = animata && window.Flip ? Flip.getState(voci.concat(gruppi)) : null;
      applica();
      if (stato) Flip.from(stato, {
        duration: .6, ease: 'power3.inOut', absolute: true, prune: true,
        onEnter: function (el) { return gsap.fromTo(el, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .5, delay: .15, ease: 'power3.out' }); },
        onLeave: function (el) { return gsap.to(el, { opacity: 0, duration: .25 }); },
        onComplete: function () { ScrollTrigger.refresh(); if (dopo) dopo(); }
      });
      else if (dopo) dopo();
    }
    filtri.forEach(function (b) { b.addEventListener('click', function () { centraTasto(b); cambia(b.getAttribute('data-filtro'), tornaSu); }); });
    var attesaCerca = null;
    if (campoCerca) campoCerca.addEventListener('input', function () {
      clearTimeout(attesaCerca);
      attesaCerca = setTimeout(function () { applica(); if (animata) ScrollTrigger.refresh(); }, 160);
    });
    var lente = $('.cerca_lente', radice), barra = $('.indice_barra', radice);
    if (lente) lente.addEventListener('click', function () {
      var aperta = barra.classList.toggle('cerca-aperta');
      lente.setAttribute('aria-expanded', String(aperta));
      if (aperta) campoCerca.focus();
    });
    // filtro scelto da fuori (per esempio dalla mappa): radice.cambiaFiltro('Energetico')
    radice.cambiaFiltro = function (f) { var b = filtri.filter(function (x) { return x.getAttribute('data-filtro') === f; })[0]; centraTasto(b); cambia(f); };
    // filtro già scelto nell'indirizzo: progetti.html#settore=Energetico
    var m = /settore=(\w+)/.exec(location.hash); if (m && filtri.length) { settoreOra = m[1]; filtri.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filtro') === settoreOra)); }); }
    applica();

    /* ---- con il movimento acceso: tendina, video, finestra che si apre, pulsanti che si accendono ---- */
    B.quando(function () {
      if (!B.moto) return;
      animata = true; videoAmmessi = true;
      if (mostrata) scriviDati(mostrata);   // la dicitura torna «animato» ora che il video può partire
      ScrollTrigger.addEventListener('refresh', misuraCorpo);
      videoGiusto();
      // (giro 3) tolta la finestra che nasceva da una riga sottile: un effetto in meno
      gruppi.forEach(function (g) {
        var tasto = $('.filtro[data-filtro="' + g.getAttribute('data-settore') + '"]', radice);
        if (!tasto) return;
        ScrollTrigger.create({ trigger: g, start: 'top 55%', end: 'bottom 55%', onToggle: function (s) {
          tasto.classList.toggle('in-vista', s.isActive);
          if (s.isActive && B.telefono.matches) centraTasto(tasto);
        } });
      });
    });
  }
  B.$$('.indice').forEach(function (r) { new Finestra(r); });
})();
