/* ============================================================
   ANIMACIONES — Tienda Supermercados 668 C.A.
   Todas las animaciones de la app se controlan desde este archivo.
   styles.css solo se encarga del diseño (colores, layout, tipografía).
   ============================================================ */

/**
 * Marquesina infinita (ticker).
 *
 * Estructura (tomada de ticker-animation.html):
 *   .ticker > .ticker-track > .ticker-item (icono + texto)
 * Los elementos se duplican para que el bucle sea seamless: cuando el
 * desplazamiento llega a la mitad del ancho total, se reinicia a cero
 * sin saltos visibles. El movimiento se drive con requestAnimationFrame
 * para un control total desde JS (las animaciones viven aquí, no en CSS).
 */
function initTicker() {
  const track = document.querySelector('.ticker-track');
  if (!track) return null;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let offset = 0;
  let lastTime = 0;
  let rafId = null;
  let paused = false;
  let speed = 42;
  let halfWidth = 1;

  // Medir el ancho de UNA copia usando los hijos reales (mitad de items)
  function measure() {
    const items = track.children;
    if (items.length < 2) { halfWidth = Math.max(1, track.scrollWidth); return; }
    const half = Math.floor(items.length / 2);
    const firstRect = items[0].getBoundingClientRect();
    const midRect = items[half].getBoundingClientRect();
    // Distancia horizontal entre el primer item y el primero de la 2ª copia
    halfWidth = Math.max(1, midRect.left - firstRect.left);
  }

  function step(ts) {
    if (!lastTime) lastTime = ts;
    let dt = (ts - lastTime) / 1000;
    if (dt > 0.05) dt = 0.05;
    lastTime = ts;

    if (!paused) {
      offset -= speed * dt;
      if (Math.abs(offset) >= halfWidth) offset += halfWidth;
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

  if (reducedMotion) {
    track.style.transform = 'none';
    return { stop() {}, pause, play, setSpeed() {} };
  }

  // Medir cuando el layout y las fuentes estén listas
  const start = () => {
    measure();
    rafId = requestAnimationFrame(step);
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start);
  } else {
    // Fallback: esperar un frame + un pequeño delay
    requestAnimationFrame(() => setTimeout(start, 100));
  }

  return {
    stop: () => cancelAnimationFrame(rafId),
    pause,
    play,
    setSpeed: s => { speed = s; },
  };
}
