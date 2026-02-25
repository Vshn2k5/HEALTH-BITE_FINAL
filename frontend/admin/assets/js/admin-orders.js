/**
 * HealthBite Admin — Orders Management Logic
 *
 * STATE:
 *   let ordersData = []
 *   let activeTab = 'all'
 *   let expandedOrderId = null
 *   let updatingOrderId = null
 *   let targetStatus = null
 */

let ordersData = [];
let activeTab = 'all';
let expandedOrderId = null;
let updatingOrderId = null;
let targetStatus = null;

document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    // Base systems handled by layout.js

    await loadOrders('all');

    // Attach listeners
    // Date inputs + search → filterOrders (input)
    document.getElementById('dateFrom').addEventListener('change', filterOrders);
    document.getElementById('dateTo').addEventListener('change', filterOrders);
    document.getElementById('orderSearch').addEventListener('input', filterOrders);

    // Clear filters
    document.getElementById('clearFiltersBtn').addEventListener('click', () => {
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        document.getElementById('orderSearch').value = '';
        document.getElementById('clearFiltersBtn').classList.add('hidden');
        renderTable(ordersData);
    });

    // Summary cards → switchTab to relevant tab
    document.getElementById('cardPending').addEventListener('click', () => switchTab('Pending'));
    document.getElementById('cardCompleted').addEventListener('click', () => switchTab('Completed'));
    document.getElementById('cardCancelled').addEventListener('click', () => switchTab('Cancelled'));

    // Status modal cancel (Escape key)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeStatusModal();
            closeAllDropdowns();
        }
    });

    // Outside click → close open dropdown
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.status-dropdown') && !e.target.closest('.status-dropdown-trigger')) {
            closeAllDropdowns();
        }
    });

    // Modal overlay click
    document.getElementById('statusModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('statusModal')) closeStatusModal();
    });
}

// ═══════════════════════════════════════
// loadOrders(status)
// GET /api/admin/orders?status={status}
// ═══════════════════════════════════════
async function loadOrders(status) {
    try {
        const queryParams = status === 'all' ? '' : `?status=${status.toLowerCase()}`;
        const response = await HealthBite.apiFetch(`/orders${queryParams}`);
        data = response || data;
    } catch (e) {
        console.error('Failed to load orders', e);
    }

    // Map backend items to frontend orders structure
    ordersData = (data.items || []).map(o => ({
        ...o,
        order_number: o.order_number || o.id.toString().padStart(6, '0'),
        total: o.total_price || 0,
        customer: {
            name: o.user_name || 'Guest',
            email: o.user_email || 'N/A',
            avatar_initials: (o.user_name || 'G').split(' ').map(n => n[0]).join('').toUpperCase()
        },
        items: o.items || [] // Safeguard
    }));

    updateSummaryStrip(recountSummary());
    updateTabCounts(recountSummary());
    renderTable(ordersData);
}

function showSkeletonRows() {
    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = Array(7).fill(0).map(() => `
        <tr class="h-[60px] border-b border-black/5">
            <td class="px-4 py-3"><div class="shimmer w-5 h-5 rounded"></div></td>
            <td class="px-4 py-3"><div class="shimmer h-4 w-24 rounded"></div></td>
            <td class="px-4 py-3"><div class="flex items-center gap-2"><div class="shimmer w-8 h-8 rounded-full"></div><div class="shimmer h-4 w-24 rounded"></div></div></td>
            <td class="px-4 py-3"><div class="shimmer h-4 w-40 rounded"></div></td>
            <td class="px-4 py-3"><div class="shimmer h-4 w-16 rounded ml-auto"></div></td>
            <td class="px-4 py-3"><div class="shimmer h-6 w-20 mx-auto rounded-full"></div></td>
            <td class="px-4 py-3"><div class="shimmer h-4 w-28 rounded ml-auto"></div></td>
            <td class="px-4 py-3"><div class="shimmer h-6 w-20 mx-auto rounded"></div></td>
        </tr>`).join('');
}

// ═══════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════

function renderTable(orders) {
    const tbody = document.getElementById('ordersTableBody');
    const emptyState = document.getElementById('emptyState');

    if (orders.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        emptyState.classList.add('flex');
        const statusLabel = activeTab === 'all' ? '' : activeTab.toLowerCase();
        document.getElementById('emptyMsg').textContent = `No ${statusLabel} orders found`.trim();
        return;
    }

    emptyState.classList.add('hidden');
    emptyState.classList.remove('flex');

    tbody.innerHTML = orders.map(order => buildOrderRow(order) + buildExpandedRow(order)).join('');
}

// ═══════════════════════════════════════
// buildOrderRow(order)
// ═══════════════════════════════════════
function buildOrderRow(order) {
    const isExpanded = expandedOrderId === order.id;
    const chevron = isExpanded ? 'expand_more' : 'chevron_right';
    const isCancelled = order.status === 'Cancelled';
    const rowOpacity = isCancelled ? 'opacity-60' : '';

    // Gradient colors from initials hash
    const gradients = [
        'from-green-400 to-emerald-600',
        'from-blue-400 to-indigo-600',
        'from-purple-400 to-fuchsia-600',
        'from-amber-400 to-orange-600',
        'from-rose-400 to-pink-600'
    ];
    const gradIdx = order.customer.name.charCodeAt(0) % gradients.length;

    return `
    <tr class="group hover:bg-white/40 transition-colors border-b border-black/5 cursor-pointer ${rowOpacity} ${isCancelled ? 'cancelled-row' : ''}" id="order-row-${order.id}" onclick="toggleExpandRow(${order.id})">
        <td class="px-4 py-3">
            <button class="p-1 rounded-md hover:bg-black/5 transition-colors" onclick="event.stopPropagation(); toggleExpandRow(${order.id})">
                <span class="material-symbols-outlined text-text-muted text-[18px] transition-transform ${isExpanded ? 'rotate-90' : ''}" id="chevron-${order.id}">${chevron}</span>
            </button>
        </td>
        <td class="px-4 py-3">
            <div class="flex items-center gap-1.5">
                <span class="text-sm font-mono font-bold text-text-main">#${order.order_number}</span>
                <button onclick="event.stopPropagation(); copyOrderId('${order.order_number}')" class="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/5" title="Copy ID">
                    <span class="material-symbols-outlined text-text-muted text-[14px]">content_copy</span>
                </button>
            </div>
        </td>
        <td class="px-4 py-3">
            <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-full bg-gradient-to-br ${gradients[gradIdx]} flex items-center justify-center text-white text-[10px] font-black shrink-0">${order.customer.avatar_initials}</div>
                <div>
                    <p class="text-sm font-bold text-text-main ${isCancelled ? 'line-through' : ''}">${order.customer.name}</p>
                    <p class="text-[10px] text-text-muted">${order.customer.email}</p>
                </div>
            </div>
        </td>
        <td class="px-4 py-3 text-sm text-text-main">${getItemsSummary(order.items)}</td>
        <td class="px-4 py-3 text-right">
            <span class="text-sm font-bold text-text-main">₹${order.total.toLocaleString()}</span>
            <p class="text-[10px] text-text-muted">(${order.items.reduce((s, i) => s + i.qty, 0)} items)</p>
        </td>
        <td class="px-4 py-3 text-center">${getStatusPill(order.status)}</td>
        <td class="px-4 py-3 text-right">
            <p class="text-sm text-text-main">${formatDateTime(order.created_at)}</p>
            <p class="text-[10px] text-text-muted">${formatRelativeTime(order.created_at)}</p>
        </td>
        <td class="px-4 py-3 text-center" onclick="event.stopPropagation()">
            ${buildActionButton(order)}
        </td>
    </tr>`;
}

// ═══════════════════════════════════════
// buildExpandedRow(order)
// ═══════════════════════════════════════
function buildExpandedRow(order) {
    const isExpanded = expandedOrderId === order.id;
    const hasHealthFlag = order.items.some(i => i.health_flag);

    return `
    <tr id="expand-${order.id}">
        <td colspan="8" class="p-0">
            <div class="expand-row ${isExpanded ? 'open' : ''}" id="expand-content-${order.id}">
                <div class="p-6 bg-white/30 border-b border-black/5">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- Left: Item breakdown sub-table -->
                        <div>
                            <h4 class="text-xs font-bold uppercase text-text-muted tracking-wider mb-3">Order Items</h4>
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="text-[10px] uppercase tracking-wider text-text-muted border-b border-black/5">
                                        <th class="pb-2 text-left">Item</th>
                                        <th class="pb-2 text-center">Qty</th>
                                        <th class="pb-2 text-right">Unit Price</th>
                                        <th class="pb-2 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${order.items.map(item => `
                                        <tr class="border-b border-black/5">
                                            <td class="py-2.5">
                                                <span class="font-medium">${item.name}</span>
                                                <span class="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/5 text-text-muted">${item.category}</span>
                                            </td>
                                            <td class="py-2.5 text-center font-bold">${item.qty}</td>
                                            <td class="py-2.5 text-right">₹${item.unit_price}</td>
                                            <td class="py-2.5 text-right font-bold">₹${item.subtotal}</td>
                                        </tr>
                                    `).join('')}
                                    <tr>
                                        <td colspan="3" class="pt-2 text-right font-bold text-text-main">Total</td>
                                        <td class="pt-2 text-right font-black text-forest text-base">₹${order.total.toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <!-- Right: Order metadata -->
                        <div class="space-y-3">
                            <h4 class="text-xs font-bold uppercase text-text-muted tracking-wider mb-3">Order Details</h4>
                            <div class="flex items-center gap-3 text-sm">
                                <span class="material-symbols-outlined text-text-muted text-[18px]">schedule</span>
                                <span class="font-medium">${formatDateTime(order.created_at)}</span>
                            </div>
                            <div class="flex items-center gap-3 text-sm">
                                <span class="material-symbols-outlined text-text-muted text-[18px]">payment</span>
                                <span class="font-medium">${order.payment_method}</span>
                            </div>
                            <div class="flex items-center gap-3 text-sm">
                                <span class="material-symbols-outlined text-text-muted text-[18px]">${order.delivery_type === 'Dine In' ? 'restaurant' : 'takeout_dining'}</span>
                                <span class="font-medium">${order.delivery_type}</span>
                            </div>
                            <div class="flex items-start gap-3 text-sm">
                                <span class="material-symbols-outlined text-text-muted text-[18px] mt-0.5">note</span>
                                <span class="font-medium">${order.special_instructions || 'None'}</span>
                            </div>
                            ${hasHealthFlag ? `
                                <div class="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                                    <span class="text-amber-600 text-lg">⚠️</span>
                                    <p class="text-xs font-bold text-amber-700">Contains items flagged for this user's health profile</p>
                                </div>` : ''}
                        </div>
                    </div>
                    <!-- Footer shortcuts -->
                    <div class="mt-5 pt-4 border-t border-black/5 flex items-center gap-3">
                        ${order.status === 'Pending' ? `
                            <button onclick="event.stopPropagation(); openStatusModal(${order.id}, 'Completed')" class="px-4 py-2 bg-forest text-white text-xs font-bold rounded-lg hover:bg-green-800 transition-colors flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-[16px]">check_circle</span> Mark as Completed
                            </button>
                            <button onclick="event.stopPropagation(); openStatusModal(${order.id}, 'Cancelled')" class="px-4 py-2 text-danger-red text-xs font-bold rounded-lg hover:bg-red-50 transition-colors border border-danger-red/20 flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-[16px]">cancel</span> Cancel Order
                            </button>` : ''}
                        <button onclick="event.stopPropagation(); window.print()" class="px-4 py-2 text-text-muted text-xs font-bold rounded-lg hover:bg-black/5 transition-colors border border-black/10 flex items-center gap-1.5 ml-auto">
                            <span class="material-symbols-outlined text-[16px]">print</span> Print Receipt
                        </button>
                    </div>
                </div>
            </div>
        </td>
    </tr>`;
}

// ═══════════════════════════════════════
// getItemsSummary(items)
// ═══════════════════════════════════════
function getItemsSummary(items) {
    if (items.length <= 2) {
        return items.map(i => `<span class="font-bold">${i.qty}x</span> ${i.name}`).join(', ');
    }
    const shown = items.slice(0, 2).map(i => `<span class="font-bold">${i.qty}x</span> ${i.name}`).join(', ');
    return `${shown} <span class="text-text-muted font-bold">+${items.length - 2} more</span>`;
}

// ═══════════════════════════════════════
// Status pill & action button helpers
// ═══════════════════════════════════════
function getStatusPill(status) {
    const map = {
        'Pending': 'bg-amber-100 text-amber-700 border-amber-200',
        'Completed': 'bg-green-100 text-green-700 border-green-200',
        'Cancelled': 'bg-red-100 text-red-700 border-red-200'
    };
    const dotMap = {
        'Pending': 'bg-amber-500 animate-pulse',
        'Completed': 'bg-green-600',
        'Cancelled': 'bg-red-600'
    };
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${map[status] || 'bg-gray-100 text-gray-600'}">
        <span class="w-1.5 h-1.5 rounded-full ${dotMap[status] || 'bg-gray-500'}"></span>${status}
    </span>`;
}

function buildActionButton(order) {
    if (order.status === 'Completed') {
        return `<span class="text-[10px] font-bold text-text-muted px-3 py-1.5 rounded-full bg-black/5">Finalized</span>`;
    }
    if (order.status === 'Cancelled') {
        return `<span class="text-[10px] font-bold text-text-muted px-3 py-1.5 rounded-full bg-black/5">Cancelled</span>`;
    }
    // Pending → dropdown trigger
    return `
        <div class="relative inline-block">
            <button class="status-dropdown-trigger flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-black/10 text-xs font-bold text-text-main hover:shadow-sm transition-all" onclick="openStatusDropdown(${order.id}, '${order.status}', this)">
                ${order.status} <span class="material-symbols-outlined text-[14px]">expand_more</span>
            </button>
        </div>`;
}

// ═══════════════════════════════════════
// toggleExpandRow(orderId)
// ═══════════════════════════════════════
function toggleExpandRow(orderId) {
    // Collapse all other rows
    if (expandedOrderId && expandedOrderId !== orderId) {
        const prevContent = document.getElementById(`expand-content-${expandedOrderId}`);
        if (prevContent) prevContent.classList.remove('open');
        const prevChev = document.getElementById(`chevron-${expandedOrderId}`);
        if (prevChev) { prevChev.classList.remove('rotate-90'); prevChev.textContent = 'chevron_right'; }
    }

    const content = document.getElementById(`expand-content-${orderId}`);
    const chevron = document.getElementById(`chevron-${orderId}`);

    if (expandedOrderId === orderId) {
        // Collapse
        content.classList.remove('open');
        chevron.classList.remove('rotate-90');
        chevron.textContent = 'chevron_right';
        expandedOrderId = null;
    } else {
        // Expand
        content.classList.add('open');
        chevron.classList.add('rotate-90');
        chevron.textContent = 'expand_more';
        expandedOrderId = orderId;
    }
}

// ═══════════════════════════════════════
// copyOrderId(orderId)
// ═══════════════════════════════════════
function copyOrderId(orderNumber) {
    navigator.clipboard.writeText(orderNumber).then(() => {
        if (window.HealthBite) HealthBite.showToast('✓ Copied!', 'success', 1500);
    });
}

// ═══════════════════════════════════════
// openStatusDropdown(orderId, currentStatus, anchorEl)
// ═══════════════════════════════════════
function openStatusDropdown(orderId, currentStatus, anchorEl) {
    closeAllDropdowns();

    const dropdown = document.createElement('div');
    dropdown.className = 'status-dropdown bg-white rounded-xl shadow-xl border border-black/10 p-1 w-40';
    dropdown.id = 'active-dropdown';

    let options = '';
    if (currentStatus === 'Pending') {
        options = `
            <button class="w-full text-left px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-50 rounded-lg flex items-center gap-2" onclick="closeAllDropdowns(); openStatusModal(${orderId}, 'Completed')">
                <span class="w-2 h-2 rounded-full bg-green-600"></span> Mark Completed
            </button>
            <button class="w-full text-left px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 rounded-lg flex items-center gap-2" onclick="closeAllDropdowns(); openStatusModal(${orderId}, 'Cancelled')">
                <span class="w-2 h-2 rounded-full bg-red-600"></span> Mark Cancelled
            </button>`;
    }

    dropdown.innerHTML = options;
    anchorEl.parentElement.appendChild(dropdown);
}

function closeAllDropdowns() {
    document.querySelectorAll('.status-dropdown').forEach(d => d.remove());
}

// ═══════════════════════════════════════
// openStatusModal(orderId, tgtStatus)
// ═══════════════════════════════════════
function openStatusModal(orderId, tgtStatus) {
    updatingOrderId = orderId;
    targetStatus = tgtStatus;

    const order = ordersData.find(o => o.id === orderId);
    if (!order) return;

    const modal = document.getElementById('statusModal');
    const content = document.getElementById('statusModalContent');
    const icon = document.getElementById('modalIcon');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const btn = document.getElementById('modalConfirmBtn');

    if (tgtStatus === 'Completed') {
        icon.className = 'w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center text-3xl bg-green-100';
        icon.innerHTML = '✅';
        title.textContent = 'Mark as Completed?';
        btn.className = 'px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-lg flex items-center gap-2 bg-forest hover:bg-green-800';
    } else {
        icon.className = 'w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center text-3xl bg-red-100';
        icon.innerHTML = '✖️';
        title.textContent = 'Cancel Order?';
        btn.className = 'px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-lg flex items-center gap-2 bg-danger-red hover:bg-red-700';
    }

    body.innerHTML = `Order <span class="font-bold text-primary">#${order.order_number}</span> will be marked as <span class="font-bold">${tgtStatus}</span>. This action will notify the customer.`;

    // Reset button state
    document.getElementById('confirmBtnText').textContent = 'Confirm';
    document.getElementById('confirmSpinner').classList.add('hidden');
    btn.disabled = false;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    requestAnimationFrame(() => {
        content.style.transform = 'scale(1)';
        content.style.opacity = '1';
    });
}

function closeStatusModal() {
    const modal = document.getElementById('statusModal');
    const content = document.getElementById('statusModalContent');
    content.style.transform = 'scale(0.95)';
    content.style.opacity = '0';
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 200);
    updatingOrderId = null;
    targetStatus = null;
}

// ═══════════════════════════════════════
// confirmStatusChange()
// PUT /api/admin/orders/:id/status { status: targetStatus }
// ═══════════════════════════════════════
async function confirmStatusChange() {
    if (!updatingOrderId || !targetStatus) return;

    const btn = document.getElementById('modalConfirmBtn');
    const btnText = document.getElementById('confirmBtnText');
    const spinner = document.getElementById('confirmSpinner');

    // Double-submit prevention
    btn.disabled = true;
    btnText.textContent = 'Updating...';
    spinner.classList.remove('hidden');

    try {
        // PATCH /api/admin/orders/:id/status
        await HealthBite.apiFetch(`/orders/${updatingOrderId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: targetStatus.toLowerCase() })
        });

        const order = ordersData.find(o => o.id === updatingOrderId);
        if (!order) return;

        const oldStatus = order.status;
        order.status = targetStatus;

        // Close modal
        closeStatusModal();

        // If on a filtered tab and the order no longer matches, fade-remove
        if (activeTab !== 'all' && activeTab !== targetStatus) {
            const row = document.getElementById(`order-row-${order.id}`);
            const expandRow = document.getElementById(`expand-${order.id}`);
            if (row) row.classList.add('fade-remove');
            if (expandRow) expandRow.classList.add('fade-remove');
            setTimeout(() => {
                renderTable(ordersData.filter(o => o.status === activeTab));
            }, 350);
        } else {
            // Update row in-place
            renderTable(activeTab === 'all' ? ordersData : ordersData.filter(o => o.status === activeTab));
        }

        // Update summary strip & tab counts
        const summary = recountSummary();
        updateSummaryStrip(summary);
        updateTabCounts(summary);

        // Toast
        if (window.HealthBite) HealthBite.showToast(`Order #${order.order_number} marked as ${targetStatus}`, 'success');

    } catch (e) {
        if (window.HealthBite) HealthBite.showToast('Failed to update order status', 'error');
        // Keep modal open on error
        btn.disabled = false;
        btnText.textContent = 'Confirm';
        spinner.classList.add('hidden');
    }
}

// ═══════════════════════════════════════
// updateSummaryStrip(summary)
// ═══════════════════════════════════════
function updateSummaryStrip(summary) {
    const ids = ['summaryTotal', 'summaryPending', 'summaryCompleted', 'summaryCancelled'];
    const vals = [summary.total, summary.pending, summary.completed, summary.cancelled];

    ids.forEach((id, i) => {
        const el = document.getElementById(id);
        el.textContent = vals[i];
        el.classList.remove('shimmer');
        el.style.width = 'auto'; el.style.height = 'auto';
    });

    // Card 4 border danger if cancelled > 0
    const card = document.getElementById('cardCancelled');
    if (summary.cancelled > 0) {
        card.style.borderColor = 'rgba(229,57,53,0.3)';
        card.style.boxShadow = '0 0 15px rgba(229,57,53,0.08)';
    } else {
        card.style.borderColor = '';
        card.style.boxShadow = '';
    }
}

// ═══════════════════════════════════════
// updateTabCounts(summary)
// ═══════════════════════════════════════
function updateTabCounts(summary) {
    document.getElementById('countAll').textContent = summary.total;
    document.getElementById('countPending').textContent = summary.pending;
    document.getElementById('countCompleted').textContent = summary.completed;
    document.getElementById('countCancelled').textContent = summary.cancelled;
}

function recountSummary() {
    return {
        total: ordersData.length,
        pending: ordersData.filter(o => o.status === 'Pending').length,
        completed: ordersData.filter(o => o.status === 'Completed').length,
        cancelled: ordersData.filter(o => o.status === 'Cancelled').length
    };
}

// ═══════════════════════════════════════
// switchTab(tab)
// ═══════════════════════════════════════
function switchTab(tab) {
    activeTab = tab;

    // Update active tab styling
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    // we use lower case for logic but UI buttons might have capitalized text
    const buttons = document.querySelectorAll('.tab-btn');
    for (const b of buttons) {
        if (b.textContent.trim().toLowerCase() === tab.toLowerCase() ||
            (tab === 'all' && b.textContent.trim().toLowerCase() === 'all orders')) {
            b.classList.add('active');
        }
    }

    // Tab switch = new server fetch
    // GET /api/admin/orders?status={tab}
    loadOrders(tab);
}

// ═══════════════════════════════════════
// filterOrders()
// Client-side filter on ordersData
// ═══════════════════════════════════════
function filterOrders() {
    const search = document.getElementById('orderSearch').value.toLowerCase().trim();
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;

    // Show/hide clear button
    const clearBtn = document.getElementById('clearFiltersBtn');
    if (search || dateFrom || dateTo) {
        clearBtn.classList.remove('hidden');
    } else {
        clearBtn.classList.add('hidden');
    }

    let filtered = ordersData;

    // Search by Order ID or customer name
    if (search) {
        filtered = filtered.filter(o =>
            o.order_number.toLowerCase().includes(search) ||
            o.customer.name.toLowerCase().includes(search)
        );
    }

    // Date from
    if (dateFrom) {
        filtered = filtered.filter(o => new Date(o.created_at) >= new Date(dateFrom));
    }

    // Date to
    if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        filtered = filtered.filter(o => new Date(o.created_at) <= endOfDay);
    }

    renderTable(filtered);
}

// ═══════════════════════════════════════
// formatRelativeTime(isoString)
// ═══════════════════════════════════════
function formatRelativeTime(isoString) {
    const now = new Date();
    const past = new Date(isoString);
    const diffMs = now - past;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
    if (diffHr < 24) return `${diffHr} hr${diffHr > 1 ? 's' : ''} ago`;
    if (diffDay === 1) return 'Yesterday';
    return `${diffDay} days ago`;
}

// ═══════════════════════════════════════
// formatDateTime(isoString)
// ═══════════════════════════════════════
function formatDateTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' +
        d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}
