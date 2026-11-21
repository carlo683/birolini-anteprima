/* =========================================================
   Mappa sulla notte: Leaflet locale (sito/js/vendor), mattonelle di OpenStreetMap tinte di blu dal CSS.
   Le posizioni sono INDICATIVE (il centro del comune); i progetti nello stesso comune si aprono a raggiera.
   Uso: <div class="mappa-notte" data-mappa [data-evidenza="slug"] [data-zoom="12"] [data-collega="id della finestra"]>
        e, nella stessa sezione, <script type="application/json" data-mappa-dati>[...]</script>.
   Si accende solo quando arriva vicino allo schermo. La rotella muove la pagina finché non si clicca la mappa;
   sul telefono un dito scorre la pagina, due dita (o i pulsanti + e −) muovono la mappa.
   ========================================================= */
(function () {
  'use strict';
  var B = window.B, $ = B.$, $$ = B.$$;
  if (!window.L) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var LOMBARDIA = function (p) { return p.la > 44.9 && p.ln > 8.5 && p.ln < 11.5; };

  function Mappa(el) {
    var sezione = el.closest('section') || document;
    var dati = JSON.parse($('[data-mappa-dati]', sezione).textContent);
    var evidenza = el.getAttribute('data-evidenza'), fermo = !B.moto;
    var tocco = window.matchMedia('(pointer: coarse)').matches;
    var mappa = L.map(el, {
      scrollWheelZoom: false, dragging: !tocco, touchZoom: true, tap: false,
      zoomAnimation: !fermo, fadeAnimation: !fermo, markerZoomAnimation: !fermo, zoomSnap: .25
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(mappa);
    mappa.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    // la rotella muove la mappa solo dopo un clic sulla mappa (e Lenis la lascia stare)
    mappa.on('click focus', function () { mappa.scrollWheelZoom.enable(); el.setAttribute('data-lenis-prevent', ''); });
    el.addEventListener('mouseleave', function () { mappa.scrollWheelZoom.disable(); el.removeAttribute('data-lenis-prevent'); });
    if (window.ResizeObserver) new ResizeObserver(function () { mappa.invalidateSize(); }).observe(el);

    // raggiera per i progetti con le stesse coordinate (per esempio 6 a Bernareggio)
    var gruppi = {};
    dati.forEach(function (p) { var k = p.la + ',' + p.ln; (gruppi[k] = gruppi[k] || []).push(p); });
    Object.keys(gruppi).forEach(function (k) {
      var g = gruppi[k];
      g.forEach(function (p, i) {
        if (g.length === 1) { p.mla = p.la; p.mln = p.ln; return; }
        var ang = (2 * Math.PI * i) / g.length, r = 0.012;
        p.mla = p.la + r * Math.sin(ang); p.mln = p.ln + (r * Math.cos(ang)) / Math.cos(p.la * Math.PI / 180);
      });
    });
    var punti = {}, scelto = null;
    function icona(p, sel) {
      var c = 'punto' + (p.c && !evidenza ? ' punto--corso' : '') + (evidenza ? (p.s === evidenza ? ' punto--evidenza' : ' punto--spento') : '') + (sel ? ' punto--scelto' : '');
      return L.divIcon({ className: '', html: '<span class="' + c + '"></span>', iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -12] });
    }
    dati.forEach(function (p) {
      var m = L.marker([p.mla, p.mln], { icon: icona(p, false), title: p.n, alt: p.n + ', ' + p.l, keyboard: !evidenza || p.s === evidenza, zIndexOffset: p.s === evidenza ? 1000 : 0 });
      m.bindPopup('<p><strong>' + esc(p.n) + '</strong></p><p class="mono">' + esc([p.l, p.a, p.st && p.st.toLowerCase()].filter(Boolean).join(', ')) + '</p>' +
        (p.s === evidenza ? '' : '<p><a href="' + esc(p.u) + '">Apri la scheda</a></p>'), { maxWidth: 280, autoPanPadding: [40, 40] });
      // 21/11: se il punto toccato ne ha altri attaccati (si coprono), la mappa prima si avvicina a quel gruppo; il fumetto si apre quando il punto è libero
      m.off('click', m._openPopup, m);
      m.on('click', function () {
        var vicini = attaccati(m);
        if (vicini.length > 1 && mappa.getZoom() < 15) {
          m.closePopup();
          mappa.fitBounds(L.latLngBounds(vicini.map(function (x) { return x.getLatLng(); })), { padding: [70, 70], maxZoom: Math.min(15, mappa.getZoom() + 3), animate: !fermo });
          return;
        }
        scegli(p.s); m.openPopup();
      });
      m.addTo(mappa); punti[p.s] = { m: m, p: p };
    });

    // i punti visibili a meno di 34 px da questo (compreso lui)
    function attaccati(m) {
      var a = mappa.latLngToContainerPoint(m.getLatLng()), out = [];
      Object.keys(punti).forEach(function (s) {
        var x = punti[s].m; if (!mappa.hasLayer(x)) return;
        if (mappa.latLngToContainerPoint(x.getLatLng()).distanceTo(a) < 34) out.push(x);
      });
      return out;
    }

    // la scheda accanto alla mappa (archivio): l'immagine cambia solo quando quella nuova è pronta
    var scheda = $('.mappa-scheda', sezione);
    function scegli(slug) {
      if (scelto && punti[scelto]) punti[scelto].m.setIcon(icona(punti[scelto].p, false));
      scelto = slug; var x = punti[slug]; if (!x) return;
      x.m.setIcon(icona(x.p, true));
      if (!scheda) return;
      var img = $('img', scheda), nuova = new Image();
      nuova.src = x.p.i;
      var metti = function () { if (scelto !== slug) return; img.src = x.p.i; img.alt = x.p.n + ', ' + x.p.l + (x.p.t ? '. ' + x.p.t : ''); };
      (nuova.decode ? nuova.decode() : Promise.resolve()).then(metti, metti);
      $('.mappa-scheda_nome', scheda).textContent = x.p.n;
      $('.mappa-scheda_dati', scheda).textContent = x.p.l + ', ' + x.p.a + ', ' + x.p.st.toLowerCase() + (x.p.t ? '. ' + x.p.t : '');
      $('.mappa-scheda_link', scheda).href = x.p.u;
      scheda.classList.add('piena');
    }

    function inquadra(lista) {
      var vicini = lista.filter(LOMBARDIA);
      var usa = vicini.length ? vicini : lista;
      if (!usa.length) return;
      if (usa.length === 1) { mappa.setView([usa[0].mla, usa[0].mln], 11, { animate: !fermo }); return; }
      mappa.fitBounds(L.latLngBounds(usa.map(function (p) { return [p.mla, p.mln]; })), { padding: [48, 48], maxZoom: 12, animate: !fermo });
    }
    if (evidenza && punti[evidenza]) mappa.setView([punti[evidenza].p.la, punti[evidenza].p.ln], +el.getAttribute('data-zoom') || 12);
    else inquadra(dati);

    // archivio: i filtri della finestra valgono anche per la mappa
    var collega = el.getAttribute('data-collega') && document.getElementById(el.getAttribute('data-collega'));
    function filtra(d) {
      var vis = {}; d.visibili.forEach(function (s) { vis[s] = 1; });
      var lista = [];
      Object.keys(punti).forEach(function (s) {
        var on = !!vis[s], m = punti[s].m;
        if (on && !mappa.hasLayer(m)) m.addTo(mappa); else if (!on && mappa.hasLayer(m)) mappa.removeLayer(m);
        if (on) lista.push(punti[s].p);
      });
      inquadra(lista);
      // i pulsanti dei settori accanto alla mappa seguono il filtro
      $$('[data-filtro-mappa]', sezione).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filtro-mappa') === d.settore)); });
    }
    if (collega) {
      collega.addEventListener('finestra:filtro', function (e) { filtra(e.detail); });
      if (collega.ultimoFiltro && collega.ultimoFiltro.settore !== 'tutti' || collega.ultimoFiltro && collega.ultimoFiltro.testo) filtra(collega.ultimoFiltro);
      // il filtro accorcia l'elenco sopra: la mappa resta ferma dov'è sullo schermo
      $$('[data-filtro-mappa]', sezione).forEach(function (b) { b.addEventListener('click', function () {
        var prima = sezione.getBoundingClientRect().top, t0 = performance.now();
        collega.cambiaFiltro(b.getAttribute('data-filtro-mappa'));
        (function tieni() {
          var d = sezione.getBoundingClientRect().top - prima;
          if (Math.abs(d) > 1) { var y = window.scrollY + d; if (B.lenis) B.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }
          if (performance.now() - t0 < 1000) requestAnimationFrame(tieni);
        })();
      }); });
    }
    $$('[data-vai]', sezione).forEach(function (b) {
      b.addEventListener('click', function () {
        var x = punti[b.getAttribute('data-vai')]; if (!x) return;
        if (!mappa.hasLayer(x.m)) x.m.addTo(mappa);
        mappa.setView([x.p.mla, x.p.mln], 9, { animate: !fermo });
        scegli(x.p.s); x.m.openPopup();
      });
    });
  }

  // si accende solo quando la mappa arriva vicino allo schermo (le mattonelle non si scaricano prima)
  $$('[data-mappa]').forEach(function (el) {
    if (!('IntersectionObserver' in window)) { Mappa(el); return; }
    var io = new IntersectionObserver(function (v) { if (v[0].isIntersecting) { io.disconnect(); Mappa(el); } }, { rootMargin: '600px 0px' });
    io.observe(el);
  });
})();
