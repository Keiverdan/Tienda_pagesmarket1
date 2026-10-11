/* ============================================================
   ANIMACIONES — Tienda Supermercados 668 C.A.
   ============================================================ */

/**
 * Marquesina infinita (ticker) — versión robusta.
 *
 * Claves del arreglo:
 *  1) Se mide el ancho real de UNA copia con getBoundingClientRect()
 *     sobre los hijos (no con scrollWidth, que se corrompe con transform).
 *  2) Se mide DESPUÉS de document.fonts.ready + un delay, para que
 *     Font Awesome ya tenga ancho real en los <i>.
 *  3) Se usa translate3d() para forzar composición en GPU.
 *  4) Se re-mide en resize y cuando las imágenes cargan.
 */
function initTicker() {
  const track = document.querySelector('.ticker-track');
  if (!track) {
    console.warn('[Ticker] No se encontró .ticker-track');
    return null;
  }

  const items = Array.from(track.children);
  if (items.length < 2) {
    console.warn('[Ticker] Faltan items duplicados en el track');
    return null;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    track.style.transform = 'none';
    return { stop() {}, pause() {}, play() {}, setSpeed() {} };
  }

  // El track tiene 2 copias: medimos la distancia del primer item
  // al primer item de la segunda copia.
  const half = Math.floor(items.length / 2);
  let copyWidth = 1;

  function measure() {
    // Reset del transform para medir en posición natural
    const prev = track.style.transform;
    track.style.transform = 'translate3d(0,0,0)';
    // forzar reflow
    void track.offsetWidth;

    const first = items[0].getBoundingClientRect();
    const mid   = items[half].getBoundingClientRect();
    copyWidth = Math.max(1, mid.left - first.left);

    // restauramos
    track.style.transform = prev;
    console.log('[Ticker] copyWidth =', copyWidth);
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
  window.addEventListener('load', measure);
  // re-medir cuando carguen las imágenes internas (placeholders, etc.)
  track.querySelectorAll('img').forEach(img => {
    img.addEventListener('load', measure, { once: true });
  });

  updateSpeed();

  function start() {
    measure();
    if (rafId) cancelAnimationFrame(rafId);
    lastTime = 0;
    offset = 0;
    rafId = requestAnimationFrame(step);
    console.log('[Ticker] Animación iniciada');
  }

  // Medir cuando el layout esté listo: esperar fuentes + 2 frames
  const whenReady = () => {
    requestAnimationFrame(() => requestAnimationFrame(start));
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => setTimeout(whenReady, 50));
  } else {
    window.addEventListener('load', () => setTimeout(whenReady, 50));
  }

  return {
    stop: () => cancelAnimationFrame(rafId),
    pause,
    play,
    setSpeed: s => { speed = s; },
    remeasure: measure,
  };
}

/* ---------- Inicialización ---------- */
let TickerCtrl = null;
function initAnimations() {
  if (TickerCtrl) return;
  TickerCtrl = initTicker();
}

window.initAnimations = initAnimations;
