// ──────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────
let products = [];
let cart = {};          // { productId: quantity }
let salesHistory = [];  // persisted in localStorage
let currentCategory = 'Tous';
let cartId = generateCartId();

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadHistoryFromStorage();
  loadDefaultProducts();
  updateClock();
  setInterval(updateClock, 1000);
  document.getElementById('session-id').textContent = cartId;
});

function loadDefaultProducts() {
  console.log("oui");
  try {
    const response = await fetch('./datas/products.json');
    if (!response.ok) throw new Error('Erreur de chargement');

    const data = await response.json();

    if (!Array.isArray(data)) throw new Error('Format invalide');

    // Validate structure
    data.forEach(item => {
      if (!item.id || !item.nom || item.prix === undefined) {
        throw new Error('Champ manquant');
      }
    });

    cart = {};
    setProducts(data);
    updateCartUI();
    showToast(`${data.length} articles chargés ✓`);

  } catch (err) {
    showToast('Erreur : JSON invalide ✗');
  }
}

function setProducts(data) {
  products = data;
  renderCategoryFilters();
  renderGrid();
}

// ──────────────────────────────────────────────
// CLOCK
// ──────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleDateString('fr-FR') + ' · ' +
    now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ──────────────────────────────────────────────
// CATEGORIES
// ──────────────────────────────────────────────
function renderCategoryFilters() {
  const cats = ['Tous', ...new Set(products.map(p => p.categorie))];
  const container = document.getElementById('category-filters');
  container.innerHTML = '';
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (cat === currentCategory ? ' active' : '');
    btn.textContent = cat;
    btn.onclick = () => { currentCategory = cat; renderCategoryFilters(); renderGrid(); };
    container.appendChild(btn);
  });
}

// ──────────────────────────────────────────────
// GRID
// ──────────────────────────────────────────────
function filterProducts() {
  renderGrid();
}

function renderGrid() {
  const query = document.getElementById('search').value.toLowerCase();
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '';

  const filtered = products.filter(p => {
    const matchCat = currentCategory === 'Tous' || p.categorie === currentCategory;
    const matchQ = p.nom.toLowerCase().includes(query) || p.id.toLowerCase().includes(query);
    return matchCat && matchQ;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="no-results">Aucun article trouvé</div>';
    return;
  }

  filtered.forEach(product => {
    const qty = cart[product.id] || 0;
    const card = document.createElement('div');
    card.className = 'product-card' + (qty > 0 ? ' in-cart' : '');
    card.dataset.id = product.id;
    card.innerHTML = `
      <div class="card-badge">${qty > 0 ? qty : ''}</div>
      <span class="card-emoji">${product.emoji || '📦'}</span>
      <div class="card-name">${product.nom}</div>
      <div class="card-cat">${product.categorie}</div>
      <div>
        <span class="card-price">${formatPrice(product.prix)}</span>
      </div>
    `;
    card.addEventListener('click', () => addToCart(product.id));
    grid.appendChild(card);
  });
}

// ──────────────────────────────────────────────
// CART
// ──────────────────────────────────────────────
function addToCart(productId) {
  cart[productId] = (cart[productId] || 0) + 1;
  updateCartUI();
  // Bump total animation
  const el = document.getElementById('total-display');
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 300);
}

function removeOneFromCart(productId) {
  if (!cart[productId]) return;
  cart[productId]--;
  if (cart[productId] <= 0) delete cart[productId];
  updateCartUI();
}

function removeFromCart(productId) {
  delete cart[productId];
  updateCartUI();
}

function clearCart() {
  cart = {};
  updateCartUI();
}

function updateCartUI() {
  const items = Object.entries(cart);
  const totalQty = items.reduce((s, [, q]) => s + q, 0);
  const totalPrice = items.reduce((s, [id, q]) => {
    const p = products.find(x => x.id === id);
    return s + (p ? p.prix * q : 0);
  }, 0);

  // Total
  document.getElementById('total-display').textContent = formatPrice(totalPrice);
  document.getElementById('item-count').textContent =
    totalQty === 0 ? '0 article' : `${totalQty} article${totalQty > 1 ? 's' : ''}`;

  // Buttons
  const hasItems = items.length > 0;
  document.getElementById('btn-pay').disabled = !hasItems;
  document.getElementById('btn-clear').disabled = !hasItems;

  // Cart items list
  const empty = document.getElementById('cart-empty');
  const list = document.getElementById('cart-items');
  empty.style.display = hasItems ? 'none' : 'flex';
  list.innerHTML = '';

  items.forEach(([id, qty]) => {
    const product = products.find(x => x.id === id);
    if (!product) return;
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="cart-item-emoji">${product.emoji || '📦'}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${product.nom}</div>
        <div class="cart-item-price">${formatPrice(product.prix)} / u.</div>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn remove" title="Retirer" onclick="removeOneFromCart('${id}')">−</button>
        <span class="cart-qty">${qty}</span>
        <button class="qty-btn" title="Ajouter" onclick="addToCart('${id}')">+</button>
      </div>
      <div class="cart-item-total">${formatPrice(product.prix * qty)}</div>
    `;
    list.appendChild(row);
  });

  // Update grid badges
  document.querySelectorAll('.product-card').forEach(card => {
    const id = card.dataset.id;
    const qty = cart[id] || 0;
    const badge = card.querySelector('.card-badge');
    if (qty > 0) {
      card.classList.add('in-cart');
      badge.textContent = qty;
    } else {
      card.classList.remove('in-cart');
      badge.textContent = '';
    }
  });
}

// ──────────────────────────────────────────────
// RECEIPT MODAL
// ──────────────────────────────────────────────
function openReceipt() {
  const items = Object.entries(cart);
  const total = items.reduce((s, [id, q]) => {
    const p = products.find(x => x.id === id);
    return s + (p ? p.prix * q : 0);
  }, 0);

  let html = '';
  items.forEach(([id, qty]) => {
    const product = products.find(x => x.id === id);
    if (!product) return;
    html += `<div class="receipt-row">
      <span class="rname">${product.emoji} ${product.nom}</span>
      <span class="rqty">×${qty}</span>
      <span class="rprice">${formatPrice(product.prix * qty)}</span>
    </div>`;
  });

  document.getElementById('receipt-items').innerHTML = html;
  document.getElementById('receipt-total').textContent = formatPrice(total);
  document.getElementById('receipt-meta').textContent =
    `Panier #${cartId} · ${new Date().toLocaleString('fr-FR')}`;

  openModal('modal-receipt');
}

function confirmPayment() {
  const now = new Date().toISOString();
  const entries = Object.entries(cart);

  entries.forEach(([id, qty]) => {
    const product = products.find(x => x.id === id);
    if (!product) return;
    salesHistory.push({
      id_panier: cartId,
      id_article: product.id,
      nom: product.nom,
      quantite: qty,
      prix_unitaire: product.prix,
      sous_total: +(product.prix * qty).toFixed(2),
      date: now,
    });
  });

  saveHistoryToStorage();
  closeModal('modal-receipt');

  // Show success flash
  const s = document.getElementById('pay-success');
  s.classList.add('show');
  setTimeout(() => {
    s.classList.remove('show');
    clearCart();
    cartId = generateCartId();
    document.getElementById('session-id').textContent = cartId;
    showToast('Vente enregistrée ✓');
  }, 1400);
}

// ──────────────────────────────────────────────
// HISTORY MODAL
// ──────────────────────────────────────────────
function openHistory() {
  const tbody = document.getElementById('history-tbody');
  if (salesHistory.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="history-empty">Aucune vente enregistrée</td></tr>';
  } else {
    tbody.innerHTML = salesHistory.slice().reverse().map(e => `
      <tr>
        <td style="color:var(--accent); font-size:10px;">${e.id_panier}</td>
        <td>${e.id_article}</td>
        <td>${e.nom}</td>
        <td style="text-align:center;">${e.quantite}</td>
        <td>${formatPrice(e.prix_unitaire)}</td>
        <td style="color:var(--accent);">${formatPrice(e.sous_total)}</td>
        <td style="font-size:10px;">${new Date(e.date).toLocaleString('fr-FR')}</td>
      </tr>
    `).join('');
  }
  openModal('modal-history');
}

// ──────────────────────────────────────────────
// MODALS
// ──────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ──────────────────────────────────────────────
// IMPORT / EXPORT
// ──────────────────────────────────────────────
function triggerImport() {
  document.getElementById('file-input').click();
}

function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) throw new Error('Format invalide');
      // Validate structure
      data.forEach(item => {
        if (!item.id || !item.nom || item.prix === undefined) throw new Error('Champ manquant');
      });
      cart = {};
      setProducts(data);
      updateCartUI();
      showToast(`${data.length} articles chargés ✓`);
    } catch (err) {
      showToast('Erreur : JSON invalide ✗');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function importHistory() {
  document.getElementById('file-history-input').click();
}

function handleHistoryImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) throw new Error();
      salesHistory = data;
      saveHistoryToStorage();
      openHistory();
      showToast(`${data.length} entrées importées ✓`);
    } catch {
      showToast('Erreur : JSON invalide ✗');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function exportHistory() {
  downloadJSON(salesHistory, 'historique_ventes.json');
  showToast('Historique exporté ✓');
}

function exportProducts() {
  downloadJSON(products, 'products.json');
  showToast('Catalogue exporté ✓');
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ──────────────────────────────────────────────
// LOCAL STORAGE
// ──────────────────────────────────────────────
function saveHistoryToStorage() {
  localStorage.setItem('caisse_history', JSON.stringify(salesHistory));
}

function loadHistoryFromStorage() {
  try {
    const raw = localStorage.getItem('caisse_history');
    if (raw) salesHistory = JSON.parse(raw);
  } catch { salesHistory = []; }
}

// ──────────────────────────────────────────────
// UTILS
// ──────────────────────────────────────────────
function formatPrice(n) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function generateCartId() {
  return 'C' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}