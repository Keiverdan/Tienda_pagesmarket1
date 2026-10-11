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

  let offset = 0;          // desplazamiento actual en px (negativo = hacia la izquierda)
  let lastTime = 0;
  let rafId = null;
  let paused = false;
  let speed = 42;          // px por segundo

  // Ancho de una sola copia de elementos (la pista contiene dos copias)
  const halfWidth = () => Math.max(1, track.scrollWidth / 2);

  function step(ts) {
    if (!lastTime) lastTime = ts;
    let dt = (ts - lastTime) / 1000;
    if (dt > 0.05) dt = 0.05;   // evita saltos grandes al cambiar de pestaña o al volver
    lastTime = ts;

    if (!paused) {
      offset -= speed * dt;
      const half = halfWidth();
      if (Math.abs(offset) >= half) offset += half;
      track.style.transform = `translateX(${offset}px)`;
    }

    rafId = requestAnimationFrame(step);
  }

  // Pausar al pasar el mouse / tocar (comportamiento del original)
  const pause = () => { paused = true; };
  const play = () => { paused = false; };
  track.addEventListener('mouseenter', pause);
  track.addEventListener('mouseleave', play);
  track.addEventListener('touchstart', pause, { passive: true });
  track.addEventListener('touchend', play);

  // Velocidad responsiva (ajustada para que el ciclo dure ~25-30s)
  function updateSpeed() {
    const w = window.innerWidth;
    if (w <= 520) speed = 28;
    else if (w <= 860) speed = 36;
    else speed = 42;
  }
  window.addEventListener('resize', updateSpeed);
  updateSpeed();

  // Respetar preferencia de movimiento reducido: marquesina estática
  if (reducedMotion) {
    track.style.transform = 'none';
    return { stop() {}, pause, play, setSpeed() {} };
  }

  rafId = requestAnimationFrame(step);

  return {
    stop: () => cancelAnimationFrame(rafId),
    pause,
    play,
    setSpeed: s => { speed = s; },
  };
}

/* ---------- Inicialización ---------- */
let TickerCtrl = null;
function initAnimations() {
  if (TickerCtrl) return;
  TickerCtrl = initTicker();
}

/* Exponer para uso externo (app.js u otro) */
window.initAnimations = initAnimations;