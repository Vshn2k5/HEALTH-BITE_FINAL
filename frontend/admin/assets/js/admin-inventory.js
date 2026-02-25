/**
 * HealthBite Admin — Inventory Management Logic
 *
 * STATE:
 *   let inventoryData = []
 */

let inventoryData = [];

document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    // Base systems handled by layout.js

    await loadInventory();
    attachListeners();
}

function attachListeners() {
    // Search input → filterTable (input event)
    document.getElementById('searchInput').addEventListener('input', filterTable);

    // Status dropdown → filterTable (change event)
    document.getElementById('filterStatus').addEventListener('change', filterTable);

    // Card 2 click → set filter to "Low Stock"
    document.getElementById('lowStockCard').addEventListener('click', () => {
        document.getElementById('filterStatus').value = 'Low Stock';
        filterTable();
    });

    // Card 3 click → set filter to "Out of Stock"
    document.getElementById('outOfStockCard').addEventListener('click', () => {
        document.getElementById('filterStatus').value = 'Out of Stock';
        filterTable();
    });
}

// ═══════════════════════════════════════
// loadInventory()
// GET /api/admin/inventory
// ═══════════════════════════════════════
async function loadInventory() {
    showSkeletonRows();

    let data = { summary: { total: 0, lowStock: 0, outOfStock: 0 }, items: [] };
    try {
        const response = await HealthBite.apiFetch('/inventory');
        data = response || data;
    } catch (e) {
        console.error('Failed to load inventory', e);
    }

    inventoryData = data.items || [];
    updateSummaryStrip(data.summary);
    renderTable(inventoryData);
    updateResultsCount(inventoryData.length, inventoryData.length);
}

function showSkeletonRows() {
    const tbody = document.getElementById('inventoryTableBody');
    let html = '';
    for (let i = 0; i < 5; i++) {
        html += `<tr class="h-[64px] border-b border-black/5">
            <td class="px-6 py-3"><div class="shimmer h-4 w-36 rounded"></div></td>
            <td class="px-6 py-3"><div class="shimmer h-5 w-20 rounded-full"></div></td>
            <td class="px-6 py-3"><div class="shimmer h-4 w-12 rounded ml-auto"></div></td>
            <td class="px-6 py-3"><div class="shimmer h-4 w-10 rounded ml-auto"></div></td>
            <td class="px-6 py-3"><div class="shimmer h-6 w-20 mx-auto rounded-full"></div></td>
            <td class="px-6 py-3"><div class="shimmer h-4 w-20 rounded ml-auto"></div></td>
            <td class="px-6 py-3"><div class="shimmer h-4 w-8 mx-auto rounded"></div></td>
        </tr>`;
    }
    tbody.innerHTML = html;
}

// ═══════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════

function renderTable(items) {
    const tbody = document.getElementById('inventoryTableBody');
    const emptyState = document.getElementById('emptyState');

    if (items.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        emptyState.classList.add('flex');
        return;
    }

    emptyState.classList.add('hidden');
    emptyState.classList.remove('flex');

    // Sort: Out of Stock first → Low Stock → Healthy
    const sorted = [...items].sort((a, b) => {
        const getOrder = (item) => {
            if (item.current_stock === 0) return 0;
            if (item.current_stock < item.reorder_level) return 1;
            return 2;
        };
        return getOrder(a) - getOrder(b);
    });

    tbody.innerHTML = sorted.map(item => buildRow(item)).join('');
}

function buildRow(item) {
    const status = getStatus(item.current_stock, item.reorder_level);
    const statusBadge = getStatusBadge(item.current_stock, item.reorder_level);
    const relTime = formatRelativeTime(item.last_updated);

    // Row background hints
    let rowBg = '';
    if (status === 'Out of Stock') rowBg = 'bg-red-50/30';
    else if (status === 'Low Stock') rowBg = 'bg-orange-50/20';

    return `
    <tr class="group hover:bg-white/60 transition-colors border-b border-black/5 h-[64px] ${rowBg}" id="row-${item.id}">
        <td class="px-6 py-3">
            <p class="font-bold text-text-main text-sm">${item.food_name || item.name}</p>
            <p class="text-[10px] text-text-muted">#${item.food_id}</p>
        </td>
        <td class="px-6 py-3">
            <span class="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-black/5 text-text-muted border border-black/5">${item.category}</span>
        </td>
        <td class="px-6 py-3 text-right font-bold text-sm ${item.current_stock === 0 ? 'text-danger-red' : item.current_stock < item.reorder_level ? 'text-accent-orange' : 'text-forest'}">${item.current_stock}</td>
        <td class="px-6 py-3 text-right text-sm text-text-muted">${item.reorder_level}</td>
        <td class="px-6 py-3 text-center">${statusBadge}</td>
        <td class="px-6 py-3 text-right text-sm text-text-muted">${relTime}</td>
        <td class="px-6 py-3 text-center" id="actions-${item.id}">
            <div class="flex items-center justify-center gap-1">
                <span class="text-sm font-bold text-text-main" id="qty-display-${item.id}">${item.current_stock}</span>
                <button onclick="enableInlineEdit('${item.id}', ${item.current_stock})" class="p-1.5 rounded-lg text-text-muted hover:text-forest hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100" title="Edit stock">
                    <span class="material-symbols-outlined text-[18px]">edit</span>
                </button>
            </div>
        </td>
    </tr>`;
}

function getStatus(current, reorder) {
    if (current === 0) return 'Out of Stock';
    if (current < reorder) return 'Low Stock';
    return 'Healthy';
}

// ═══════════════════════════════════════
// getStatusBadge(current, reorder)
// ═══════════════════════════════════════
function getStatusBadge(current, reorder) {
    if (current === 0) {
        return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
            <span class="w-1.5 h-1.5 rounded-full bg-red-600"></span>Out of Stock</span>`;
    }
    if (current < reorder) {
        return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200 animate-pulse">
            <span class="w-1.5 h-1.5 rounded-full bg-orange-600"></span>Low Stock</span>`;
    }
    return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
        <span class="w-1.5 h-1.5 rounded-full bg-green-600"></span>Healthy</span>`;
}

// ═══════════════════════════════════════
// updateSummaryStrip()
// Recount from inventoryData — no API call
// ═══════════════════════════════════════
function updateSummaryStrip(summaryOpt) {
    let total, lowStock, outOfStock;

    if (summaryOpt) {
        total = summaryOpt.total;
        lowStock = summaryOpt.lowStock;
        outOfStock = summaryOpt.outOfStock;
    } else {
        // Recount from memory
        total = inventoryData.length;
        outOfStock = inventoryData.filter(i => i.current_stock === 0).length;
        lowStock = inventoryData.filter(i => i.current_stock > 0 && i.current_stock < i.reorder_level).length;
    }

    const totalEl = document.getElementById('summaryTotal');
    totalEl.textContent = total.toLocaleString();
    totalEl.classList.remove('shimmer');
    totalEl.style.width = 'auto'; totalEl.style.height = 'auto';

    const lowEl = document.getElementById('summaryLowStock');
    lowEl.textContent = lowStock;
    lowEl.classList.remove('shimmer');
    lowEl.style.width = 'auto'; lowEl.style.height = 'auto';

    const oosEl = document.getElementById('summaryOutOfStock');
    oosEl.textContent = outOfStock;
    oosEl.classList.remove('shimmer');
    oosEl.style.width = 'auto'; oosEl.style.height = 'auto';

    // Card 3 border changes to danger if outOfStock > 0
    const oosCard = document.getElementById('outOfStockCard');
    if (outOfStock > 0) {
        oosCard.classList.add('oos-urgent');
    } else {
        oosCard.classList.remove('oos-urgent');
    }
}

// ═══════════════════════════════════════
// INLINE EDIT
// ═══════════════════════════════════════

// enableInlineEdit(recId, currentQty)
function enableInlineEdit(recId, currentQty) {
    const actionsCell = document.getElementById(`actions-${recId}`);
    actionsCell.innerHTML = `
        <div class="flex items-center justify-center gap-1.5">
            <input type="number" min="0" id="edit-input-${recId}" value="${currentQty}" class="w-16 px-2 py-1.5 rounded-lg border border-primary/50 bg-white text-text-main text-center text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" autofocus>
            <button onclick="saveStock('${recId}', ${currentQty})" class="px-2.5 py-1.5 bg-primary text-white text-[10px] font-bold rounded-lg hover:bg-primary-dark transition-colors">Save</button>
            <button onclick="cancelEdit('${recId}', ${currentQty})" class="px-2.5 py-1.5 text-text-muted text-[10px] font-bold rounded-lg hover:bg-black/5 transition-colors">Cancel</button>
        </div>`;

    // Focus the input
    const input = document.getElementById(`edit-input-${recId}`);
    input.focus();
    input.select();

    // Enter key → save, Escape → cancel
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveStock(recId, currentQty);
        if (e.key === 'Escape') cancelEdit(recId, currentQty);
    });
}

// saveStock(foodId, originalQty)
// PUT /api/admin/inventory/:food_id { quantity: newQty }
async function saveStock(foodId, originalQty) {
    const input = document.getElementById(`edit-input-${foodId}`);
    const newQty = parseInt(input.value, 10);

    // Validate: must be number >= 0, not empty
    if (isNaN(newQty) || newQty < 0 || input.value.trim() === '') {
        input.classList.add('shake', 'border-danger-red');
        setTimeout(() => input.classList.remove('shake'), 500);
        if (window.HealthBite) HealthBite.showToast('Quantity must be a number ≥ 0', 'error');
        return;
    }

    try {
        // PUT /api/admin/inventory/:inv_id
        await HealthBite.apiFetch(`/inventory/${recId}`, {
            method: 'PUT',
            body: JSON.stringify({ current_stock: newQty })
        });

        // Update inventoryData array in memory
        const idx = inventoryData.findIndex(i => i.id == recId);
        if (idx !== -1) {
            inventoryData[idx].current_stock = newQty;
            inventoryData[idx].last_updated = new Date().toISOString();
        }

        // Re-render that row only (surgical update)
        const row = document.getElementById(`row-${recId}`);
        if (row) {
            const item = inventoryData[idx];
            row.outerHTML = buildRow(item);

            // Flash row green briefly (fade out 1.5s)
            const newRow = document.getElementById(`row-${recId}`);
            if (newRow) {
                newRow.classList.add('row-flash');
                setTimeout(() => newRow.classList.remove('row-flash'), 1500);
            }
        }

        // Recalculate summary strip counts
        updateSummaryStrip();

        // Success toast
        if (window.HealthBite) HealthBite.showToast(`Stock updated to ${newQty}`, 'success');

    } catch (e) {
        // Revert to original on error
        cancelEdit(recId, originalQty);
        if (window.HealthBite) HealthBite.showToast('Failed to update stock', 'error');
    }
}

// cancelEdit — revert to display mode
function cancelEdit(recId, originalQty) {
    const actionsCell = document.getElementById(`actions-${recId}`);
    actionsCell.innerHTML = `
        <div class="flex items-center justify-center gap-1">
            <span class="text-sm font-bold text-text-main" id="qty-display-${recId}">${originalQty}</span>
            <button onclick="enableInlineEdit('${recId}', ${originalQty})" class="p-1.5 rounded-lg text-text-muted hover:text-forest hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100" title="Edit stock">
                <span class="material-symbols-outlined text-[18px]">edit</span>
            </button>
        </div>`;
}

// ═══════════════════════════════════════
// FILTERING
// ═══════════════════════════════════════

function filterTable() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const statusFilter = document.getElementById('filterStatus').value;

    const filtered = inventoryData.filter(item => {
        const matchName = item.name.toLowerCase().includes(search);
        const status = getStatus(item.current_stock, item.reorder_level);
        const matchStatus = statusFilter === 'all' || status === statusFilter;
        return matchName && matchStatus;
    });

    renderTable(filtered);
    updateResultsCount(filtered.length, inventoryData.length);
}

function updateResultsCount(showing, total) {
    document.getElementById('resultsCount').textContent = `Showing ${showing} of ${total} items`;
}

// ═══════════════════════════════════════
// formatRelativeTime(isoString)
// ═══════════════════════════════════════
function formatRelativeTime(isoString) {
    const now = new Date();
    const past = new Date(isoString);
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
    if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;
    return past.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
