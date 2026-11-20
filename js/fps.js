/* Contatore dei fotogrammi (solo con ?fps nell'indirizzo). Tocca il riquadro per azzerare.
   Per ogni parte della pagina: quanti fotogrammi sono durati più di 34 ms e più di 50 ms (gli «scatti») e il peggiore. */
(function () {
  'use strict';
  var box = document.createElement('div');
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:2147483647;background:rgba(0,0,0,.8);color:#fff;font:11px/1.4 ui-monospace,Menlo,Consolas,monospace;padding:6px 8px;border-radius:6px;white-space:pre;max-width:calc(100vw - 12px);overflow:hidden;';
  document.body.appendChild(box);
  var liv = document.documentElement.getAttribute('data-leggero') || '0';
  var stat = {}, ordine = [], ora = '?', prima = performance.now(), conta = 0, inizio = prima, fps = 0;
  function nomeSezione() {
    var el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    var s = el && el.closest('section, header, footer, main > div, .film');
    if (!s) return '?';
    return s.id || (s.className && String(s.className).split(' ')[0]) || s.tagName.toLowerCase();
  }
  function prendi(n) { if (!stat[n]) { stat[n] = { f: 0, a: 0, b: 0, p: 0 }; ordine.push(n); } return stat[n]; }
  function giro(t) {
    var dt = t - prima; prima = t; conta++;
    if (dt < 1000) { var s = prendi(ora); s.f++; if (dt > 34) s.a++; if (dt > 50) s.b++; if (dt > s.p) s.p = dt; }
    requestAnimationFrame(giro);
  }
  requestAnimationFrame(giro);
  setInterval(function () { ora = nomeSezione(); }, 250);
  setInterval(function () {
    var t = performance.now(); fps = Math.round(conta * 1000 / (t - inizio)); conta = 0; inizio = t;
    var video = Array.prototype.filter.call(document.querySelectorAll('video'), function (v) { return !v.paused; }).length;
    var righe = ['fps ' + fps + '  leggero ' + liv + '  video ' + video + '  ora: ' + ora, 'parte            >34ms >50ms peggiore'];
    ordine.slice(-9).forEach(function (n) { var s = stat[n]; righe.push((n + '                ').slice(0, 16) + ' ' + ('     ' + s.a).slice(-5) + ' ' + ('     ' + s.b).slice(-5) + ' ' + ('      ' + Math.round(s.p)).slice(-6) + 'ms'); });
    box.textContent = righe.join('\n');
  }, 500);
  box.addEventListener('click', function () { stat = {}; ordine = []; });
})();
