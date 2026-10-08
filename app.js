/* ============================================================
   CONFIGURACIÓN GLOBAL
   ============================================================ */
let CONFIG = {
  tienda: "Inversiones Chupaalperro 668 C.A",
  whatsapp: "584126887277",
  whatsappVisible: "0412-688-7277",
  tasaBCV: 0,	// se sobrescribe al cargar productos.json
  banco: { codigo:"0102 - Banco de Venezuela", cedula:"V-12123123", telefono:"04126887277" }
};

let PRODUCTS = [];   // Se llena desde productos.json
let CATEGORIAS = []; // Se llena desde productos.json
let CAT_LABEL = {};  // Mapa id → nombre

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

/* Convierte precioUSD a Bs según la tasa actual */
function priceBs(p) { return p.precioUSD * CONFIG.tasaBCV; }

/* ============================================================
   CARGA DE DATOS (productos.json)
   ============================================================ */
function cargarDatos() {
  return new Promise((resolve, reject) => {
    const scripts = document.getElementsByTagName('script');
    let basePath = '';
    for (let s of scripts) {
      if (s.src && s.src.includes('app.js')) {
        basePath = s.src.substring(0, s.src.lastIndexOf('/') + 1);
        break;
      }
    }

    const url = basePath + 'productos.json?v=' + Date.now();
    console.log('🔍 Intentando cargar:', url);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      if (xhr.status === 200 || xhr.status === 0) {
        try {
          const data = JSON.parse(xhr.responseText);
          aplicarDatos(data);
          console.log('✅ productos.json cargado. Tasa BCV =', CONFIG.tasaBCV);
          resolve(true);
        } catch (e) {
          console.error('❌ JSON inválido:', e);
          reject(new Error('El JSON tiene un error de sintaxis'));
        }
      } else {
        console.error('❌ Error HTTP:', xhr.status);
        reject(new Error('No se encontró productos.json (HTTP ' + xhr.status + ')'));
      }
    };

    xhr.onerror = () => {
      console.error('❌ Error de red');
      reject(new Error('Error de red'));
    };

    xhr.send();
  });
}

function aplicarDatos(data) {
  if (data.config) {
    CONFIG = Object.assign(CONFIG, data.config);
     if (data.config.tasaBCV) {
        CONFIG.tasaBCV = parseFloat(data.config.tasaBCV) || CONFIG.tasaBCV;
        }
  }
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
  $('saveTxt').textContent = 'Guardando...';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch(e) {}
    $('saveTxt').textContent = 'Guardado';
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
  $('toastMsg').textContent = msg;
  $('toast').classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => $('toast').classList.remove('show'), ms);
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
  el.classList.remove(cls);
  void el.offsetWidth; // reinicia la animación
  el.classList.add(cls);
}

function updateCart(bump = false) {
  const t = totals();
  if (bump) {
    bumpEl($('hdrCount'), 'bump');
    bumpEl($('flN'), 'bump');
    bumpEl($('cartBtn'), 'bump');
  }
  $('hdrCount').textContent = t.items;
  $('flN').textContent = t.items;
  $('flBs').textContent = fmt(t.bs) + ' Bs.';
  $('flUsd').textContent = '($' + t.usd.toFixed(2) + ')';
  $('floatBar').style.display = t.items > 0 ? 'block' : 'none';
}

/* ============================================================
   RENDER CATÁLOGO + CATEGORÍAS
   ============================================================ */
function renderCategorias() {
  const nav = $('catNav');
  // Limpiar categorías antiguas (excepto el botón "Todos" y el dropdown)
  nav.querySelectorAll('.cat:not([data-cat="all"]):not(.dropdown .cat)').forEach(b => b.remove());
  
  // Actualizar el menú desplegable si existe
  const dropdownContent = $('dropdownContent');
  if (dropdownContent) {
    dropdownContent.innerHTML = CATEGORIAS.map(c => 
      `<a href="#" data-cat="${c.id}"><i class="fa-solid ${c.icono}" style="margin-right:8px; color:var(--green-accent);"></i>${c.nombre}</a>`
    ).join('');
  }

  // Insertar las categorías en la barra de navegación (excepto "Todos")
  CATEGORIAS.forEach(c => {
    const b = document.createElement('button');
    b.className = 'cat';
    b.dataset.cat = c.id;
    b.innerHTML = `<i class="fa-solid ${c.icono}"></i>${c.nombre}`;
    if (state.category === c.id) b.classList.add('active');
    nav.appendChild(b);
  });
  
  // Marca activo "Todos" si corresponde
  const allBtn = nav.querySelector('[data-cat="all"]');
  if(allBtn) allBtn.classList.toggle('active', state.category === 'all');
}

function render(animate = true, justId = null) {
  const grid = $('grid');
  grid.classList.toggle('static', !animate);
  const list = PRODUCTS.filter(p => {
    const c = state.category === 'all' || p.categoria === state.category;
    const q = !state.query
      || p.titulo.toLowerCase().includes(state.query)
      || p.marca.toLowerCase().includes(state.query);
    return c && q;
  });

  $('counter').textContent = 'Mostrando ' + list.length + ' producto' + (list.length === 1 ? '' : 's');
  $('empty').style.display = list.length ? 'none' : 'block';

  grid.innerHTML = list.map((p, idx) => {
    const q = state.quantities[p.id] || 0;
    const bs = priceBs(p);
    const usd = p.precioUSD.toFixed(2);
    const ph = 'https://placehold.co/600x600/1f2937/9ca3af?text=' + encodeURIComponent(p.titulo);

    return `
    <article class="card ${q > 0 ? 'sel' : ''} ${p.id === justId ? 'just' : ''}" data-id="${p.id}" style="--i:${Math.min(idx, 12)}">
      <div class="img">
        <span class="badge-cat">${CAT_LABEL[p.categoria] || p.categoria}</span>
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
   CAMBIO DE CANTIDAD
   ============================================================ */
function changeQty(id, delta) {
  state.quantities[id] = Math.max(0, (state.quantities[id] || 0) + delta);
  render(false, id);
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
  $('refInput').value = '';
  render();
  updateCart();
  save();
  toast('Pedido vaciado');
}

/* ============================================================
   EVENTOS
   ============================================================ */
$('grid').addEventListener('click', e => {
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
  render(false, id);
  updateCart();
  save();
});

// Manejo del clic en las categorías (incluyendo el menú desplegable)
document.addEventListener('click', e => {
  const catBtn = e.target.closest('[data-cat]');
  if (catBtn) {
    e.preventDefault();
    const cat = catBtn.dataset.cat;
    state.category = cat;
    
    // Actualizar clases activas en la barra de navegación
    document.querySelectorAll('.cat').forEach(x => x.classList.toggle('active', x.dataset.cat === cat));
    
    // Si el clic fue en el dropdown, actualizar también el botón "Todos" o el botón principal
    if (!catBtn.classList.contains('cat')) {
        document.querySelectorAll('.cat').forEach(x => x.classList.remove('active'));
    }

    // Cerrar el dropdown en móvil
    $('dropdownContent').classList.remove('show');
    $('dropdownOverlay').classList.remove('show');

    render();
  }
});

// Lógica para el menú desplegable en móvil
$('catDropdownBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  const dropdown = $('dropdownContent');
  const overlay = $('dropdownOverlay');
  
  // Si ya está abierto, cerrarlo
  if (dropdown.classList.contains('show')) {
    dropdown.classList.remove('show');
    overlay.classList.remove('show');
  } else {
    dropdown.classList.add('show');
    overlay.classList.add('show');
  }
});

// Cerrar dropdown al hacer clic en el overlay
$('dropdownOverlay').addEventListener('click', () => {
  $('dropdownContent').classList.remove('show');
  $('dropdownOverlay').classList.remove('show');
});

$('searchInput').addEventListener('input', e => {
  state.query = e.target.value.trim().toLowerCase();
  $('clearBtn').style.display = state.query ? 'block' : 'none';
  render();
});

$('clearBtn').addEventListener('click', () => {
  $('searchInput').value = '';
  state.query = '';
  $('clearBtn').style.display = 'none';
  render();
});

/* Botones vaciar pedido */
$('clearCartBtn').addEventListener('click', vaciarPedido);
$('flClear').addEventListener('click', vaciarPedido);

/* ============================================================
   CLIENTE
   ============================================================ */
function showCustomer() {
  $('custName').value = state.customerName || '';
  $('custModal').classList.add('show');
  setTimeout(() => $('custName').focus(), 50);
}

$('custForm').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('custName').value.trim();
  if (!v) return;
  state.customerName = v;
  $('hdrName').textContent = v;
  $('custModal').classList.remove('show');
  save();
  toast('¡Bienvenido, ' + v + '!');
});

$('userBtn').addEventListener('click', showCustomer);

/* ============================================================
   FACTURA
   ============================================================ */
function openInvoice() {
  $('invBrand').textContent = CONFIG.tienda;
  $('invCust').textContent = 'Cliente: ' + (state.customerName || 'Cliente');

  const now = new Date();
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  $('invDate').textContent = `${String(now.getDate()).padStart(2,'0')} de ${meses[now.getMonth()]}, ${now.getFullYear()}`;

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

  $('invItems').innerHTML = html;
  $('invCount').textContent = 'Total: ' + count + ' ítems';
  $('invTotal').innerHTML = fmt(bs) + ' Bs.<small>$' + (bs / CONFIG.tasaBCV).toFixed(2) + ' USD</small>';
  $('pmBank').textContent = CONFIG.banco.codigo;
  $('pmId').textContent = CONFIG.banco.cedula;
  $('pmPhone').textContent = CONFIG.banco.telefono;
  $('pmTotal').textContent = fmt(bs) + ' Bs.';
  $('refInput').value = state.refNumber || '';
  $('invModal').classList.add('show');
}

function requireItems() {
  if (totals().items === 0) {
    toast('Aún no has agregado productos');
    return false;
  }
  return true;
}

$('flGo').addEventListener('click', openInvoice);
$('cartBtn').addEventListener('click', () => { if (requireItems()) openInvoice(); });
$('invClose').addEventListener('click', () => $('invModal').classList.remove('show'));
$('invModal').addEventListener('click', e => { if (e.target === $('invModal')) $('invModal').classList.remove('show'); });

$('refInput').addEventListener('input', e => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '');
  state.refNumber = e.target.value;
  save();
});

/* ============================================================
   COPIAR PAGO MÓVIL
   ============================================================ */
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

/* ============================================================
   WHATSAPP
   ============================================================ */
$('waBtn').addEventListener('click', () => {
  if (!state.refNumber) {
    toast('Ingresa el Nro. de Referencia');
    $('refInput').focus();
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
    $('invModal').classList.remove('show');
    state.quantities = {};
    state.refNumber = '';
    $('refInput').value = '';
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

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
async function init() {
  load();
   try {
  await cargarDatos();
} catch (e) {
      alert('Error cargando datos. Verifica que el archivo exista en GitHub.');
      return;
   }

  $('topPhone').textContent = CONFIG.whatsappVisible;
  $('footPhone').textContent = CONFIG.whatsappVisible;
  $('footBrand').textContent = CONFIG.tienda;
  $('footBrand2').textContent = CONFIG.tienda;
  $('invBrand').textContent = CONFIG.tienda;
  $('rateInput').value = CONFIG.tasaBCV.toFixed(2);
  $('yr').textContent = new Date().getFullYear();

  renderCategorias();
  render();
  updateCart();

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
    $('hdrName').textContent = state.customerName;
  } else {
    showCustomer();
  }
}

init();
