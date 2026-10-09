/* ============================================================
   CONFIGURACIÓN GLOBAL
   ============================================================ */
let CONFIG = {
  tienda: "Supermercados 668 C.A.",
  whatsapp: "584126887277",
  whatsappVisible: "0412-688-7277",
  tasaBCV: 0,
  banco: { codigo:"0102 - Banco de Venezuela", cedula:"V-12123123", telefono:"04126887277" }
};

let PRODUCTS = [];
let CATEGORIAS = [];
let CAT_LABEL = {};

const STORE_KEY = 'tienda_app_state_v5';

let state = {
  customerName: "",
  quantities: {},
  refNumber: "",
  category: "all",
  query: ""
};

const $ = id => document.getElementById(id);
const fmt = n => n.toLocaleString('es-VE', { minimumFractionDigits:2, maximumFractionDigits:2 });

function priceBs(p) { return p.precioUSD * CONFIG.tasaBCV; }

/* ============================================================
   PERFIL DE COMPORTAMIENTO (cache del navegador del usuario)
   Se usa para el algoritmo de recomendaciones en el catálogo.
   ============================================================ */
const PROFILE_KEY = 'tienda_profile_v1';

let profile = { views: {}, adds: {}, cats: {}, searches: [], lastCat: 'all' };

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) profile = Object.assign(profile, JSON.parse(raw));
  } catch(e) {}
}

function saveProfile() {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch(e) {}
}

/** Registrar que el usuario vio un producto (clic en la tarjeta) */
function trackView(id) {
  if (!id) return;
  profile.views[id] = (profile.views[id] || 0) + 1;
  saveProfile();
}

/** Registrar que el usuario agregó un producto al pedido */
function trackAdd(id) {
  if (!id) return;
  profile.adds[id] = (profile.adds[id] || 0) + 1;
  saveProfile();
}

/** Registrar categoría visitada */
function trackCat(cat) {
  if (!cat || cat === 'all') return;
  profile.cats[cat] = (profile.cats[cat] || 0) + 1;
  profile.lastCat = cat;
  saveProfile();
}

/** Registrar búsqueda del usuario */
function trackSearch(q) {
  if (!q) return;
  q = q.trim().toLowerCase();
  if (!q) return;
  profile.searches.push(q);
  if (profile.searches.length > 20) profile.searches.shift();
  saveProfile();
}

/**
 * Puntúa un producto según el comportamiento del usuario.
 * Señales: agregados al carrito (fuerte), vistas (moderada),
 * categoría preferida, coincidencia con búsquedas pasadas.
 */
function scoreProduct(p) {
  let s = 0;
  s += (profile.adds[p.id] || 0) * 30;
  s += (profile.views[p.id] || 0) * 8;
  if (p.categoria === profile.lastCat) s += 15;
  const q = (state.query || '').toLowerCase();
  if (q && (p.titulo.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q))) s += 25;
  // Refuerzo suave por productos de la misma categoría que los más agregados
  return s;
}

/** Umbral para mostrar el badge "Recomendado" */
const RECO_THRESHOLD = 20;

/* ============================================================
   CARGA DE DATOS
   ============================================================ */
async function cargarDatos() {
  try {
    const respuesta = await fetch('productos.json?v=' + Date.now());
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const data = await respuesta.json();
    aplicarDatos(data);
    console.log('✅ productos.json cargado. Tasa BCV =', CONFIG.tasaBCV);
  } catch (e) {
    console.error('❌ Error cargando productos.json:', e);
    alert('No se pudo cargar productos.json. Verifica que el archivo exista y tenga formato JSON válido.');
    throw e;
  }
}

function aplicarDatos(data) {
  if (data.config) {
    CONFIG = Object.assign(CONFIG, data.config);
    if (data.config.tasaBCV) {
      CONFIG.tasaBCV = parseFloat(data.config.tasaBCV) || CONFIG.tasaBCV;
    }
  }
  // Asegurar siempre el nombre correcto de la tienda
  CONFIG.tienda = "Supermercados 668 C.A.";
  if (data.categorias) {
    CATEGORIAS = data.categorias;
    CAT_LABEL = {};
    CATEGORIAS.forEach(c => CAT_LABEL[c.id] = c.nombre);
  }
  if (data.productos) {
    PRODUCTS = data.productos;
  }
  console.log('✅ Datos cargados. Tasa BCV =', CONFIG.tasaBCV);
}

/* ============================================================
   PERSISTENCIA
   ============================================================ */
let saveTimer;
function save() {
  const el = $('saveTxt');
  if (el) el.textContent = 'Guardando...';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch(e) {}
    if (el) el.textContent = 'Guardado';
  }, 300);
}

function load() {
  try {
    const c = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (c) state = { ...state, ...c };
  } catch(e) {}
}

/* ============================================================
   TOAST
   ============================================================ */
let toastT;
function toast(msg, ms = 4000) {
  const toastEl = $('toast');
  const toastMsg = $('toastMsg');
  if (!toastEl || !toastMsg) return;
  toastMsg.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('show'), ms);
}

/* ============================================================
   TOTALES
   ============================================================ */
function totals() {
  let items = 0, bs = 0;
  PRODUCTS.forEach(p => {
    const q = state.quantities[p.id] || 0;
    items += q;
    bs += q * priceBs(p);
  });
  return { items, bs, usd: bs / CONFIG.tasaBCV };
}

/* ============================================================
   CARRITO
   ============================================================ */
function bumpEl(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function updateCart(bump = false) {
  const t = totals();
  if (bump) {
    bumpEl($('hdrCount'), 'bump');
    bumpEl($('flN'), 'bump');
    bumpEl($('cartBtn'), 'bump');
  }
  if ($('hdrCount')) $('hdrCount').textContent = t.items;
  if ($('flN')) $('flN').textContent = t.items;
  if ($('flBs')) $('flBs').textContent = fmt(t.bs) + ' Bs.';
  if ($('flUsd')) $('flUsd').textContent = '($' + t.usd.toFixed(2) + ')';
  
  const floatBar = $('floatBar');
  const body = document.body;
  
  if (floatBar) {
    if (t.items > 0) {
      floatBar.style.display = 'block';
      body.classList.add('has-floatbar');
    } else {
      floatBar.style.display = 'none';
      body.classList.remove('has-floatbar');
    }
  }
}

/* ============================================================
   RENDER CATÁLOGO + CATEGORÍAS
   ============================================================ */
function renderCategorias() {
  const dropdownContent = $('dropdownContent');
  if (!dropdownContent) return;

  // Si la categoría guardada ya no existe, volver a "Todos"
  if (state.category !== 'all' && !CAT_LABEL[state.category]) state.category = 'all';

  dropdownContent.innerHTML = CATEGORIAS.map(c =>
    `<button type="button" class="cat-item ${state.category === c.id ? 'active' : ''}" data-cat="${c.id}"><i class="fa-solid ${c.icono}"></i><span>${c.nombre}</span></button>`
  ).join('');

  syncCategoriaUI();
}

/* Marca la categoría activa en la barra, el menú y el botón */
function syncCategoriaUI() {
  const allBtn = document.querySelector('.cat[data-cat="all"]');
  if (allBtn) allBtn.classList.toggle('active', state.category === 'all');

  document.querySelectorAll('#dropdownContent [data-cat]').forEach(a => {
    a.classList.toggle('active', a.dataset.cat === state.category);
  });

  const hasCat = state.category !== 'all';
  const btn = $('catDropdownBtn');
  const lbl = $('catDropdownLbl');
  if (btn) btn.classList.toggle('active', hasCat);
  if (lbl) lbl.textContent = hasCat ? (CAT_LABEL[state.category] || 'Categorías') : 'Categorías';
}

function render(animate = true, justId = null) {
  const grid = $('grid');
  if (!grid) return;
  grid.classList.toggle('static', !animate);
  const list = PRODUCTS.filter(p => {
    const c = state.category === 'all' || p.categoria === state.category;
    const q = !state.query
      || p.titulo.toLowerCase().includes(state.query)
      || p.marca.toLowerCase().includes(state.query);
    return c && q;
  });

  // Algoritmo de recomendaciones: solo ordena cuando NO hay búsqueda activa
  // (con búsqueda se respeta el orden de relevancia del usuario).
  if (!state.query) {
    list.sort((a, b) => scoreProduct(b) - scoreProduct(a));
  }

  if ($('counter')) $('counter').textContent = 'Mostrando ' + list.length + ' producto' + (list.length === 1 ? '' : 's');
  if ($('empty')) $('empty').style.display = list.length ? 'none' : 'block';

  grid.innerHTML = list.map((p, idx) => {
    const q = state.quantities[p.id] || 0;
    const bs = priceBs(p);
    const usd = p.precioUSD.toFixed(2);
    const ph = 'https://placehold.co/600x600/1f2937/9ca3af?text=' + encodeURIComponent(p.titulo);
    const reco = !state.query && scoreProduct(p) >= RECO_THRESHOLD;

    return `
    <article class="card ${q > 0 ? 'sel' : ''} ${p.id === justId ? 'just' : ''} ${reco ? 'reco' : ''}" data-id="${p.id}" style="--i:${Math.min(idx, 12)}">
      <div class="img">
        <span class="badge-cat">${CAT_LABEL[p.categoria] || p.categoria}</span>
        ${reco ? `<span class="badge-reco"><i class="fa-solid fa-sparkles"></i> Recomendado</span>` : ''}
        ${q > 0 ? `<span class="badge-qty">x${q}</span>` : ''}
        <img src="${p.imagen}" alt="${p.titulo}" loading="lazy" decoding="async" onload="this.parentNode.classList.add('ld')" onerror="this.onerror=null;this.src='${ph}'">
      </div>
      <div class="brand-line"><span class="b">${p.marca}</span><span class="w">${p.peso}</span></div>
      <h3>${p.titulo}</h3>
      <div class="price"><span class="bs">${bs.toLocaleString('es-VE',{maximumFractionDigits:2})} <small>Bs</small></span><span class="usd">$${usd}</span></div>
      ${q > 0 ? `
        <div class="step">
          <button class="m" data-act="dec" aria-label="Disminuir"><i class="fa-solid fa-minus"></i></button>
          <input type="number" min="0" step="1" value="${q}" data-act="set" aria-label="Cantidad">
          <button data-act="inc" aria-label="Aumentar"><i class="fa-solid fa-plus"></i></button>
        </div>` : `
        <button class="add" data-act="inc"><i class="fa-solid fa-cart-plus"></i>Agregar</button>`
      }
    </article>`;
  }).join('');
}

/* ============================================================
   CAMBIO DE CANTIDAD (Optimizado: solo actualiza la tarjeta)
   ============================================================ */
function changeQty(id, delta) {
  state.quantities[id] = Math.max(0, (state.quantities[id] || 0) + delta);
  if (delta > 0) trackAdd(id);
  
  const card = document.querySelector(`.card[data-id="${id}"]`);
  if (card) {
    const q = state.quantities[id] || 0;
    card.classList.toggle('sel', q > 0);
    
    // Badge de cantidad
    let badge = card.querySelector('.badge-qty');
    if (q > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'badge-qty';
        card.querySelector('.img').appendChild(badge);
      }
      badge.textContent = `x${q}`;
    } else if (badge) {
      badge.remove();
    }
    
    // Zona de acción (add vs step)
    const actionZone = card.querySelector('.add, .step');
    if (q > 0) {
      if (actionZone && actionZone.classList.contains('add')) {
        const step = document.createElement('div');
        step.className = 'step';
        step.innerHTML = `
          <button class="m" data-act="dec" aria-label="Disminuir"><i class="fa-solid fa-minus"></i></button>
          <input type="number" min="0" step="1" value="${q}" data-act="set" aria-label="Cantidad">
          <button data-act="inc" aria-label="Aumentar"><i class="fa-solid fa-plus"></i></button>
        `;
        actionZone.replaceWith(step);
      } else if (actionZone && actionZone.classList.contains('step')) {
        actionZone.querySelector('input').value = q;
      }
    } else {
      if (actionZone && actionZone.classList.contains('step')) {
        const addBtn = document.createElement('button');
        addBtn.className = 'add';
        addBtn.dataset.act = 'inc';
        addBtn.innerHTML = '<i class="fa-solid fa-cart-plus"></i>Agregar';
        actionZone.replaceWith(addBtn);
      }
    }
  }
  
  updateCart(delta > 0);
  save();
}

/* ============================================================
   VACIAR PEDIDO
   ============================================================ */
function vaciarPedido() {
  if (totals().items === 0) { toast('El pedido ya está vacío'); return; }
  if (!confirm('¿Borrar todos los productos seleccionados?')) return;
  state.quantities = {};
  state.refNumber = '';
  if ($('refInput')) $('refInput').value = '';
  render();
  updateCart();
  save();
  toast('Pedido vaciado');
}

/* ============================================================
   EVENTOS DEL GRID
   ============================================================ */
if ($('grid')) {
  // Vista: cualquier clic sobre una tarjeta cuenta como interacción con ese producto
  $('grid').addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (card && card.dataset.id) trackView(+card.dataset.id);
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.tagName === 'INPUT') return;
    const id = +btn.closest('.card').dataset.id;
    if (btn.classList.contains('add')) {
      const r = btn.getBoundingClientRect();
      const s = Math.max(r.width, r.height);
      const sp = document.createElement('span');
      sp.className = 'ripple';
      sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
      btn.appendChild(sp);
      setTimeout(() => sp.remove(), 600);
    }
    changeQty(id, btn.dataset.act === 'inc' ? 1 : -1);
  });

  $('grid').addEventListener('change', e => {
    if (e.target.dataset.act !== 'set') return;
    const id = +e.target.closest('.card').dataset.id;
    let n = parseInt(e.target.value, 10);
    if (isNaN(n) || n < 0) n = 0;
    state.quantities[id] = n;
    changeQty(id, 0);
    updateCart();
    save();
  });
}

/* ============================================================
   MENÚ DE CATEGORÍAS (PC: desplegable · Móvil: panel inferior)
   - El menú está fuera del <header> (no lo recorta ni lo tapa nada)
   - Se abre/cierra con clic (también funciona en pantallas táctiles)
   ============================================================ */
const catBtn     = $('catDropdownBtn');
const catMenu    = $('dropdownContent');
const catOverlay = $('dropdownOverlay');
const isMobileView = () => window.matchMedia('(max-width: 860px)').matches;

function menuAbierto() { return !!catMenu && catMenu.classList.contains('show'); }

function posicionarMenu() {
  if (!catBtn || !catMenu) return;
  if (isMobileView()) {          // en móvil lo ubica el CSS (panel inferior)
    catMenu.style.top = '';
    catMenu.style.left = '';
    return;
  }
  const r = catBtn.getBoundingClientRect();
  const maxLeft = window.innerWidth - catMenu.offsetWidth - 12;
  catMenu.style.top  = (r.bottom + 8) + 'px';
  catMenu.style.left = Math.max(12, Math.min(r.left, maxLeft)) + 'px';
}

function abrirMenuCategorias() {
  if (!catMenu) return;
  catMenu.classList.add('show');
  if (catOverlay) catOverlay.classList.add('show');
  if (catBtn) catBtn.setAttribute('aria-expanded', 'true');
  posicionarMenu();
}

function cerrarMenuCategorias() {
  if (catMenu) catMenu.classList.remove('show');
  if (catOverlay) catOverlay.classList.remove('show');
  if (catBtn) catBtn.setAttribute('aria-expanded', 'false');
}

if (catBtn) {
  catBtn.addEventListener('click', e => {
    e.stopPropagation();
    menuAbierto() ? cerrarMenuCategorias() : abrirMenuCategorias();
  });
}
if (catOverlay) catOverlay.addEventListener('click', cerrarMenuCategorias);
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarMenuCategorias(); });
window.addEventListener('resize', () => { if (menuAbierto()) posicionarMenu(); });
window.addEventListener('scroll', () => { if (menuAbierto()) posicionarMenu(); }, { passive: true });

/* ============================================================
   FILTRO POR CATEGORÍA
   Un solo listener delegado: funciona para "Todos" y para cada
   categoría del menú, aunque se vuelvan a renderizar.
   ============================================================ */
function setCategory(cat) {
  state.category = cat;
  trackCat(cat);
  syncCategoriaUI();
  cerrarMenuCategorias();
  save();
  render();

  // En móvil, llevar al catálogo para ver el resultado del filtro
  const cat_ = $('catalogo');
  if (cat_ && isMobileView()) cat_.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function activarFiltrosCategoria() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-cat]');
    if (!el) return;
    if (el.tagName === 'A') e.preventDefault();
    setCategory(el.dataset.cat);
  });
}

/* ============================================================
   BÚSQUEDA
   ============================================================ */
if ($('searchInput')) {
  $('searchInput').addEventListener('input', e => {
    state.query = e.target.value.trim().toLowerCase();
    if (state.query) trackSearch(state.query);
    if ($('clearBtn')) $('clearBtn').style.display = state.query ? 'block' : 'none';
    render();
  });
}

if ($('clearBtn')) {
  $('clearBtn').addEventListener('click', () => {
    $('searchInput').value = '';
    state.query = '';
    $('clearBtn').style.display = 'none';
    render();
  });
}

if ($('clearCartBtn')) $('clearCartBtn').addEventListener('click', vaciarPedido);
if ($('flClear')) $('flClear').addEventListener('click', vaciarPedido);

/* ============================================================
   CLIENTE
   ============================================================ */
function showCustomer() {
  if ($('custName')) $('custName').value = state.customerName || '';
  if ($('custModal')) $('custModal').classList.add('show');
  setTimeout(() => { if ($('custName')) $('custName').focus(); }, 50);
}

if ($('custForm')) {
  $('custForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('custName').value.trim();
    if (!v) return;
    state.customerName = v;
    if ($('hdrName')) $('hdrName').textContent = v;
    if ($('custModal')) $('custModal').classList.remove('show');
    save();
    toast('¡Bienvenido, ' + v + '!');
  });
}

if ($('userBtn')) $('userBtn').addEventListener('click', showCustomer);

/* ============================================================
   FACTURA
   ============================================================ */
function openInvoice() {
  if ($('invBrand')) $('invBrand').textContent = CONFIG.tienda;
  if ($('invCust')) $('invCust').textContent = 'Cliente: ' + (state.customerName || 'Cliente');

  const now = new Date();
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  if ($('invDate')) $('invDate').textContent = `${String(now.getDate()).padStart(2,'0')} de ${meses[now.getMonth()]}, ${now.getFullYear()}`;

  let html = '', count = 0, bs = 0;
  PRODUCTS.forEach(p => {
    const q = state.quantities[p.id] || 0;
    if (!q) return;
    const sub = q * priceBs(p);
    count += q;
    bs += sub;
    html += `<div class="rc-row">
      <div><b>${q}x</b> ${p.titulo} <small>(${p.marca})</small></div>
      <div class="r">${sub.toLocaleString('es-VE',{maximumFractionDigits:2})} Bs.<small style="display:block">($${(sub / CONFIG.tasaBCV).toFixed(2)})</small></div>
    </div>`;
  });

  if ($('invItems')) $('invItems').innerHTML = html;
  if ($('invCount')) $('invCount').textContent = 'Total: ' + count + ' ítems';
  if ($('invTotal')) $('invTotal').innerHTML = fmt(bs) + ' Bs.<small>$' + (bs / CONFIG.tasaBCV).toFixed(2) + ' USD</small>';
  if ($('pmBank')) $('pmBank').textContent = CONFIG.banco.codigo;
  if ($('pmId')) $('pmId').textContent = CONFIG.banco.cedula;
  if ($('pmPhone')) $('pmPhone').textContent = CONFIG.banco.telefono;
  if ($('pmTotal')) $('pmTotal').textContent = fmt(bs) + ' Bs.';
  if ($('refInput')) $('refInput').value = state.refNumber || '';
  if ($('invModal')) $('invModal').classList.add('show');
}

function requireItems() {
  if (totals().items === 0) {
    toast('Aún no has agregado productos');
    return false;
  }
  return true;
}

if ($('flGo')) $('flGo').addEventListener('click', openInvoice);
if ($('cartBtn')) $('cartBtn').addEventListener('click', () => { if (requireItems()) openInvoice(); });
if ($('invClose')) $('invClose').addEventListener('click', () => $('invModal').classList.remove('show'));
if ($('invModal')) $('invModal').addEventListener('click', e => { if (e.target === $('invModal')) $('invModal').classList.remove('show'); });

if ($('refInput')) {
  $('refInput').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
    state.refNumber = e.target.value;
    save();
  });
}

/* ============================================================
   COPIAR PAGO MÓVIL
   ============================================================ */
if ($('copyBtn')) {
  $('copyBtn').addEventListener('click', () => {
    const t = totals();
    const text = `${CONFIG.banco.codigo.split(' ')[0]}\n${CONFIG.banco.cedula.replace('V-','')}\n${CONFIG.banco.telefono}\n${t.bs.toFixed(2)}`;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch(e) {}
      document.body.removeChild(ta);
    }
    toast('¡Datos de Pago Móvil copiados!');
  });
}

/* ============================================================
   WHATSAPP
   ============================================================ */
if ($('waBtn')) {
  $('waBtn').addEventListener('click', () => {
    if (!state.refNumber) {
      toast('Ingresa el Nro. de Referencia');
      if ($('refInput')) $('refInput').focus();
      return;
    }
    if (!requireItems()) return;

    let lines = '';
    PRODUCTS.forEach(p => {
      const q = state.quantities[p.id] || 0;
      if (!q) return;
      lines += `• ${q}x ${p.titulo} - ${p.marca} (${p.peso})\n`;
    });

    const msg = `*NUEVO PEDIDO DE COMPRA*\n*${CONFIG.tienda}*\n*Cliente:* ${state.customerName}\n\n*PRODUCTOS SOLICITADOS:*\n${lines}\n*Nro. Referencia Pago:* ${state.refNumber}\n\n¡Gracias por su compra!`;

    window.open('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(msg), '_blank');

    const limpiarPedido = () => {
      if ($('invModal')) $('invModal').classList.remove('show');
      state.quantities = {};
      state.refNumber = '';
      if ($('refInput')) $('refInput').value = '';
      render();
      updateCart();
      save();
      toast('¡Gracias por su compra! 🛒', 5000);
      window.removeEventListener('focus', limpiarPedido);
    };

    window.addEventListener('focus', limpiarPedido, { once: true });

    setTimeout(() => {
      if (state.quantities && Object.keys(state.quantities).length > 0 && !totals().items) return;
      if (Object.values(state.quantities).some(v => v > 0)) limpiarPedido();
    }, 1200);
  });
}

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
async function init() {
  load();
  loadProfile();
  try {
    await cargarDatos();
  } catch (e) {
    return;
  }

  if ($('topPhone')) $('topPhone').textContent = CONFIG.whatsappVisible;
  if ($('footPhone')) $('footPhone').textContent = CONFIG.whatsappVisible;
  if ($('footBrand')) $('footBrand').textContent = CONFIG.tienda;
  if ($('footBrand2')) $('footBrand2').textContent = CONFIG.tienda;
  if ($('invBrand')) $('invBrand').textContent = CONFIG.tienda;
  if ($('rateInput')) $('rateInput').value = CONFIG.tasaBCV.toFixed(2);
  if ($('yr')) $('yr').textContent = new Date().getFullYear();

  renderCategorias();
  render();
  updateCart();
  
  // Activar filtros de categoría DESPUÉS de renderizar las categorías
  activarFiltrosCategoria();

  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  if (state.customerName) {
    if ($('hdrName')) $('hdrName').textContent = state.customerName;
  } else {
    showCustomer();
  }
}

init();
