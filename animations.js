/* ============================================================
   ANIMACIONES — Tienda Supermercados 668 C.A.
   ============================================================ */

/**
 * Marquesina infinita (ticker) — versión a prueba de balas.
 *
 * Estrategia: en vez de medir con getBoundingClientRect (que se corrompe
 * con transform y con gap), medimos el ancho de UNA COPIA sumando
 * offsetWidth de cada item + el gap real entre ellos.
 */
function initTicker() {
  const track = document.querySelector('.ticker-track');
  if (!track) { console.warn('[Ticker] No .ticker-track'); return null; }

  const items = Array.from(track.children);
  if (items.length < 4) { console.warn('[Ticker] Pocos items'); return null; }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    track.style.transform = 'none';
    return { stop() {}, pause() {}, play() {}, setSpeed() {} };
  }

  const half = Math.floor(items.length / 2);
  let copyWidth = 1000; // fallback

  function measure() {
    // Asegurar que no hay transform antes de medir
    const prevTransform = track.style.transform;
    track.style.transform = 'none';
    // Forzar reflow
    void track.offsetWidth;

    // Ancho real de una copia = scrollWidth / 2 (scrollWidth ignora transforms)
    const total = track.scrollWidth;
    copyWidth = Math.max(100, total / 2);

    track.style.transform = prevTransform;
    console.log('[Ticker] copyWidth =', copyWidth, '(total scrollWidth =', total + ')');
  }

  let offset = 0;
  let lastTime = 0;
  let rafId = null;
  let paused = false;
  let speed = 42;

  function step(ts) {
    if (!lastTime) lastTime = ts;
    let dt = (ts - lastTime) / 1000;
    if (dt > 0.05) dt = 0.05;
    lastTime = ts;

    if (!paused) {
      offset -= speed * dt;
      if (-offset >= copyWidth) offset += copyWidth;
      track.style.transform = `translate3d(${offset}px, 0, 0)`;
    }
    rafId = requestAnimationFrame(step);
  }

  const pause = () => { paused = true; };
  const play  = () => { paused = false; };
  track.addEventListener('mouseenter', pause);
  track.addEventListener('mouseleave', play);
  track.addEventListener('touchstart', pause, { passive: true });
  track.addEventListener('touchend', play);

  function updateSpeed() {
    const w = window.innerWidth;
    if (w <= 520) speed = 28;
    else if (w <= 860) speed = 36;
    else speed = 42;
  }

  window.addEventListener('resize', () => { updateSpeed(); measure(); });

  updateSpeed();

  function start() {
    measure();
    if (rafId) cancelAnimationFrame(rafId);
    lastTime = 0;
    offset = 0;
    rafId = requestAnimationFrame(step);
    console.log('[Ticker] Animación iniciada');
  }

  // Arrancar cuando fuentes + layout estén listos
  const whenReady = () => requestAnimationFrame(() => requestAnimationFrame(start));

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => setTimeout(whenReady, 100));
  } else {
    window.addEventListener('load', () => setTimeout(whenReady, 100));
  }

  return {
    stop: () => cancelAnimationFrame(rafId),
    pause, play,
    setSpeed: s => { speed = s; },
    remeasure: measure,
  };
}

let TickerCtrl = null;
function initAnimations() {
  if (TickerCtrl) return;
  TickerCtrl = initTicker();
}
window.initAnimations = initAnimations;
