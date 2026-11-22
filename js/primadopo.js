/* Giro 7: «Prima e dopo» (pagina Aree). La linea si trascina col mouse o col dito (in orizzontale: in verticale la pagina scorre),
   con la tastiera si usa il cursore nascosto (frecce). Entrando nello schermo la linea scorre da sola una volta, per far capire che si muove. */
(function () {
  var ridotto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var morbido = function (x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  [].forEach.call(document.querySelectorAll('.pd_quadro'), function (q) {
    var r = q.querySelector('.pd_cursore'), toccato = false, anim = null, giu = false, deciso = false, x0 = 0, y0 = 0;
    function metti(v) {
      v = Math.max(0, Math.min(100, v));
      q.style.setProperty('--pos', v + '%');
      r.value = Math.round(v);
      r.setAttribute('aria-valuetext', 'Render visibile al ' + (100 - Math.round(v)) + ' per cento');
    }
    function ferma() { toccato = true; if (anim) { cancelAnimationFrame(anim); anim = null; } }
    function segui(e) { var b = q.getBoundingClientRect(); metti((e.clientX - b.left) / b.width * 100); }
    r.addEventListener('input', function () { ferma(); metti(+r.value); });
    q.addEventListener('pointerdown', function (e) {
      giu = true; deciso = e.pointerType === 'mouse'; x0 = e.clientX; y0 = e.clientY;
      if (deciso) { ferma(); segui(e); e.preventDefault(); }
    });
    q.addEventListener('pointermove', function (e) {
      if (!giu) return;
      if (!deciso) {   // col dito: si decide al primo movimento se è un trascinamento (di lato) o uno scorrimento della pagina
        if (Math.abs(e.clientX - x0) < 6 && Math.abs(e.clientY - y0) < 6) return;
        if (Math.abs(e.clientX - x0) <= Math.abs(e.clientY - y0)) { giu = false; return; }
        deciso = true; ferma();
      }
      segui(e);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) { q.addEventListener(t, function (e) { if (t === 'pointerup' && giu && !deciso) { ferma(); segui(e); } giu = false; }); });
    q.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') giu = false; });
    if (ridotto || !('IntersectionObserver' in window)) { metti(50); return; }
    metti(100);   // prima si vede tutta la foto di prima
    var io = new IntersectionObserver(function (v) {
      if (!v[0].isIntersecting || toccato) return;
      io.disconnect();
      var t0 = performance.now(), D = 2800;
      (function passo(t) {
        if (toccato) return;
        var p = Math.min(1, (t - t0) / D);
        metti(p < .62 ? 100 - 92 * morbido(p / .62) : 8 + 42 * morbido((p - .62) / .38));   // fin quasi tutto «dopo», poi a metà
        if (p < 1) anim = requestAnimationFrame(passo);
      })(t0);
    }, { threshold: .6 });
    io.observe(q);
  });
})();
