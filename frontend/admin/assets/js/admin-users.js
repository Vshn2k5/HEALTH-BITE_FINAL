/**
 * HealthBite Admin — Users Management Logic
 *
 * STATE:
 *   let usersData = []
 *   let currentAdminRole = ''
 *   let editingUserId = null
 *   let selectedRole = null
 */

let usersData = [];
let currentAdminRole = '';
let editingUserId = null;
let selectedRole = null;

document.addEventListener('DOMContentLoaded', () => { init(); });

async function init() {
    await loadUsers();
    attachListeners();
}

function attachListeners() {
    // Filter inputs → filterUsers
    document.getElementById('searchInput').addEventListener('input', filterUsers);
    document.getElementById('filterRole').addEventListener('change', filterUsers);
    document.getElementById('filterRisk').addEventListener('change', filterUsers);
    document.getElementById('filterStatus').addEventListener('change', filterUsers);

    // Card 4 click → High risk filter
    document.getElementById('cardHighRisk').addEventListener('click', () => {
        document.getElementById('filterRisk').value = 'High';
        filterUsers();
    });

    // Escape → close modals/popovers
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeHealthModal(); closeRoleModal(); closeAllPopovers(); }
    });

    // Outside click → close popover
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.deactivate-popover') && !e.target.closest('.deactivate-trigger')) closeAllPopovers();
    });

    // Modal overlay clicks
    document.getElementById('healthModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('healthModal')) closeHealthModal();
    });
    document.getElementById('roleModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('roleModal')) closeRoleModal();
    });
}

// ═══════════════════════════════════════
// loadUsers()
// GET /api/admin/users
// ═══════════════════════════════════════
async function loadUsers() {
    showSkeletonRows();

    let data = { summary: { total: 0, active: 0, deactivated: 0, highRisk: 0 }, users: [] };
    try {
        const response = await HealthBite.apiFetch('/users');
        data = response.data || data;
    } catch (e) {
        console.error('Failed to load users', e);
    }

    usersData = data.users;
    detectAdminRole();
    applyRbacVisibility();
    updateSummaryStrip(data.summary);
    renderTable(usersData);
    updateResultsCount(usersData.length, usersData.length);
}

function showSkeletonRows() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = Array(6).fill(0).map(() => `
        <tr class="h-[60px] border-b border-black/5">
            <td class="px-4 py-3"><div class="shimmer w-10 h-10 rounded-full"></div></td>
            <td class="px-4 py-3"><div class="shimmer h-4 w-32 rounded mb-1"></div><div class="shimmer h-3 w-24 rounded"></div></td>
            <td class="px-4 py-3"><div class="shimmer h-5 w-16 rounded-full"></div></td>
            <td class="px-4 py-3"><div class="shimmer h-5 w-20 rounded-full"></div></td>
            <td class="px-4 py-3"><div class="shimmer h-4 w-20 rounded"></div></td>
            <td class="px-4 py-3"><div class="shimmer h-4 w-20 rounded"></div></td>
            <td class="px-4 py-3"><div class="shimmer h-5 w-16 mx-auto rounded-full"></div></td>
            <td class="px-4 py-3"><div class="shimmer h-6 w-24 mx-auto rounded"></div></td>
        </tr>`).join('');
}

// ═══════════════════════════════════════
// detectAdminRole() — Decode JWT → extract role
// ═══════════════════════════════════════
function detectAdminRole() {
    // Mock: read from localStorage or default to SUPER_ADMIN
    currentAdminRole = localStorage.getItem('admin_role') || 'SUPER_ADMIN';
}

// ═══════════════════════════════════════
// applyRbacVisibility()
// ═══════════════════════════════════════
function applyRbacVisibility() {
    const banner = document.getElementById('rbacBanner');
    banner.classList.add('hidden');
}

// ═══════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════
function renderTable(users) {
    const tbody = document.getElementById('usersTableBody');
    const emptyState = document.getElementById('emptyState');

    if (users.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden'); emptyState.classList.add('flex');
        return;
    }
    emptyState.classList.add('hidden'); emptyState.classList.remove('flex');
    tbody.innerHTML = users.map(u => buildUserRow(u)).join('');
}

function buildUserRow(user) {
    const isDeactivated = user.status === 'Deactivated';
    const rowOpacity = isDeactivated ? 'opacity-[0.65]' : '';
    const nameStrike = isDeactivated ? 'line-through' : '';
    const grad = getAvatarGradient(user.name);

    return `
    <tr class="group hover:bg-white/40 transition-colors border-b border-black/5 ${rowOpacity}" id="user-row-${user.id}">
        <td class="px-4 py-3">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-black shrink-0">${user.name.split(' ').map(n => n[0]).join('')}</div>
        </td>
        <td class="px-4 py-3">
            <p class="text-sm font-bold text-text-main ${nameStrike}">${user.name}</p>
            <p class="text-[10px] text-text-muted">${user.email}</p>
        </td>
        <td class="px-4 py-3">${getRoleBadge(user.role)}</td>
        <td class="px-4 py-3">${getRiskBadge(user.risk_level, user.risk_score)}</td>
        <td class="px-4 py-3 text-sm text-text-muted">${formatDate(user.joined_at)}</td>
        <td class="px-4 py-3 text-sm ${!user.last_active ? 'text-danger-red font-bold' : 'text-text-muted'}">${user.last_active ? formatRelativeTime(user.last_active) : 'Never'}</td>
        <td class="px-4 py-3 text-center">${getStatusBadge(user.status)}</td>
        <td class="px-4 py-3 text-center actions-col">
            <div class="flex items-center justify-center gap-1">
                <button onclick="openHealthModal(${user.id})" class="p-1.5 rounded-lg text-text-muted hover:text-blue-600 hover:bg-blue-50 transition-all" title="View Health Summary">
                    <span class="material-symbols-outlined text-[18px]">visibility</span>
                </button>
                <button onclick="openRoleModal(${user.id})" class="p-1.5 rounded-lg text-text-muted hover:text-purple-600 hover:bg-purple-50 transition-all" title="Change Role">
                    <span class="material-symbols-outlined text-[18px]">key</span>
                </button>
                <div class="relative">
                    <button class="deactivate-trigger p-1.5 rounded-lg text-text-muted hover:${isDeactivated ? 'text-green-600 hover:bg-green-50' : 'text-danger-red hover:bg-red-50'} transition-all" title="${isDeactivated ? 'Reactivate' : 'Deactivate'}" onclick="openDeactivatePopover(${user.id}, '${user.status}', this)">
                        <span class="material-symbols-outlined text-[18px]">${isDeactivated ? 'check_circle' : 'block'}</span>
                    </button>
                </div>
            </div>
        </td>
    </tr>`;
}

// ═══════════════════════════════════════
// BADGE HELPERS
// ═══════════════════════════════════════
function getAvatarGradient(name) {
    const gradients = ['from-green-400 to-emerald-600', 'from-blue-400 to-indigo-600', 'from-purple-400 to-fuchsia-600', 'from-amber-400 to-orange-600', 'from-rose-400 to-pink-600'];
    return gradients[name.charCodeAt(0) % gradients.length];
}

function getRoleBadge(role) {
    const map = {
        'ADMIN': 'bg-cyan-100 text-cyan-700 border-cyan-200',
        'USER': 'bg-black/5 text-text-muted border-black/10'
    };
    return `<span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${map[role] || map['USER']}">${role}</span>`;
}

function getRiskBadge(level, score) {
    const map = { 'Low': 'bg-green-100 text-green-700', 'Moderate': 'bg-amber-100 text-amber-700', 'High': 'bg-red-100 text-red-700' };
    return `<div class="flex items-center gap-1.5">
        <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${map[level]}">${level}</span>
        <span class="text-[10px] font-bold text-text-muted">${score}</span>
    </div>`;
}

function getStatusBadge(status) {
    if (status === 'Active') return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700"><span class="w-1.5 h-1.5 rounded-full bg-green-600"></span>Active</span>`;
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700"><span class="w-1.5 h-1.5 rounded-full bg-red-600"></span>Deactivated</span>`;
}

// ═══════════════════════════════════════
// updateSummaryStrip(summary)
// ═══════════════════════════════════════
function updateSummaryStrip(summaryOpt) {
    let s = summaryOpt;
    if (!s) {
        s = {
            total: usersData.length,
            active: usersData.filter(u => u.status === 'Active').length,
            deactivated: usersData.filter(u => u.status === 'Deactivated').length,
            highRisk: usersData.filter(u => u.risk_level === 'High').length
        };
    }
    const pairs = [['summaryTotal', s.total], ['summaryActive', s.active], ['summaryDeactivated', s.deactivated], ['summaryHighRisk', s.highRisk]];
    pairs.forEach(([id, val]) => {
        const el = document.getElementById(id);
        el.textContent = val; el.classList.remove('shimmer'); el.style.width = 'auto'; el.style.height = 'auto';
    });
    const card = document.getElementById('cardHighRisk');
    if (s.highRisk > 0) card.classList.add('high-risk-active'); else card.classList.remove('high-risk-active');
}

// ═══════════════════════════════════════
// HEALTH SUMMARY MODAL
// ═══════════════════════════════════════
function openHealthModal(userId) {
    const user = usersData.find(u => u.id === userId);
    if (!user) return;

    const riskColor = user.risk_level === 'High' ? '#E53935' : user.risk_level === 'Moderate' ? '#FB8C00' : '#2E7D32';
    const circumference = 2 * Math.PI * 54;
    const offset = circumference - (user.risk_score / 100) * circumference;
    const grad = getAvatarGradient(user.name);

    document.getElementById('healthModalBody').innerHTML = `
        <!-- Header -->
        <div class="p-6 border-b border-black/5 flex items-center gap-4">
            <div class="w-14 h-14 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-lg font-black shrink-0">${user.name.split(' ').map(n => n[0]).join('')}</div>
            <div class="flex-1">
                <h3 class="text-lg font-bold text-text-main">${user.name}</h3>
                <p class="text-sm text-text-muted">${user.email}</p>
            </div>
            <div class="flex gap-2">${getRoleBadge(user.role)} ${getStatusBadge(user.status)}</div>
        </div>

        <div class="p-6 space-y-6">
            <!-- Section A: Risk Overview with SVG ring -->
            <div class="text-center">
                <div class="relative inline-block">
                    <svg width="130" height="130" viewBox="0 0 130 130">
                        <circle cx="65" cy="65" r="54" fill="none" stroke="rgba(0,0,0,0.05)" stroke-width="8"/>
                        <circle class="risk-ring" cx="65" cy="65" r="54" fill="none" stroke="${riskColor}" stroke-width="8" stroke-linecap="round"
                            stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" transform="rotate(-90 65 65)"
                            style="transition: stroke-dashoffset 1s ease-out;"
                            id="riskRingCircle"/>
                    </svg>
                    <div class="absolute inset-0 flex flex-col items-center justify-center">
                        <span class="text-3xl font-black" style="color:${riskColor}">${user.risk_score}</span>
                        <span class="text-[9px] font-bold text-text-muted uppercase">Risk Score</span>
                    </div>
                </div>
                <p class="text-sm font-bold mt-2" style="color:${riskColor}">${user.risk_level} Risk Profile</p>
            </div>

            <!-- Section B: Health Conditions -->
            <div>
                <h4 class="text-xs font-bold uppercase text-text-muted tracking-wider mb-2">Reported Conditions</h4>
                <div class="flex flex-wrap gap-2">
                    ${user.conditions.length > 0 && user.conditions[0] !== 'None' ? user.conditions.map(c => `<span class="px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">${c}</span>`).join('') : '<span class="text-sm text-text-muted">None reported</span>'}
                </div>
            </div>

            <!-- Section C: Dietary Preferences -->
            <div>
                <h4 class="text-xs font-bold uppercase text-text-muted tracking-wider mb-2">Dietary Preferences</h4>
                <div class="flex flex-wrap gap-2">
                    ${user.dietary_preferences.length > 0 ? user.dietary_preferences.map(d => `<span class="px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">${d}</span>`).join('') : '<span class="text-sm text-text-muted">No preferences set</span>'}
                </div>
            </div>

            <!-- Section D: Order Summary -->
            <div>
                <h4 class="text-xs font-bold uppercase text-text-muted tracking-wider mb-3">Order Summary</h4>
                <div class="grid grid-cols-3 gap-4">
                    <div class="bg-white/50 p-3 rounded-xl text-center">
                        <p class="text-2xl font-bold text-text-main">${user.order_stats.total_orders}</p>
                        <p class="text-[10px] text-text-muted font-bold">Total Orders</p>
                    </div>
                    <div class="bg-white/50 p-3 rounded-xl text-center">
                        <p class="text-2xl font-bold text-forest">₹${user.order_stats.total_spent.toLocaleString()}</p>
                        <p class="text-[10px] text-text-muted font-bold">Total Spent</p>
                    </div>
                    <div class="bg-white/50 p-3 rounded-xl text-center">
                        <p class="text-2xl font-bold text-text-main">₹${user.order_stats.avg_order_value}</p>
                        <p class="text-[10px] text-text-muted font-bold">Avg Value</p>
                    </div>
                </div>
            </div>

            <!-- Section E: AI Insights -->
            <div>
                <h4 class="text-xs font-bold uppercase text-text-muted tracking-wider mb-3">AI Insights</h4>
                <div class="space-y-2.5">
                    <p class="text-sm"><span class="font-bold">Most recommended:</span> ${user.ai_insights.top_category}</p>
                    <p class="text-sm"><span class="font-bold">Flagged items:</span> ${user.ai_insights.flagged_items}</p>
                    <div class="flex items-center gap-3">
                        <span class="text-sm font-bold">Compliance:</span>
                        <div class="flex-1 h-2 bg-black/5 rounded-full overflow-hidden">
                            <div class="h-full bg-primary rounded-full" style="width:${user.ai_insights.compliance_rate}%"></div>
                        </div>
                        <span class="text-sm font-bold">${user.ai_insights.compliance_rate}%</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="p-6 border-t border-black/5 flex justify-between items-center">
            <button onclick="closeHealthModal()" class="px-5 py-2.5 text-sm font-bold text-text-muted rounded-xl hover:bg-black/5 transition-colors">Close</button>
            <a href="admin-orders.html?user_id=${user.id}" class="text-sm font-bold text-primary hover:underline">View Order History →</a>
        </div>`;

    const modal = document.getElementById('healthModal');
    modal.classList.remove('hidden'); modal.classList.add('flex');

    // Animate SVG ring on open
    requestAnimationFrame(() => {
        const ring = document.getElementById('riskRingCircle');
        if (ring) ring.style.strokeDashoffset = offset;
    });
}

function closeHealthModal() {
    const modal = document.getElementById('healthModal');
    modal.classList.add('hidden'); modal.classList.remove('flex');
}

// ═══════════════════════════════════════
// ROLE CHANGE MODAL
// ═══════════════════════════════════════
function openRoleModal(userId) {
    const user = usersData.find(u => u.id === userId);
    if (!user) return;
    editingUserId = userId;
    selectedRole = user.role;

    const roles = [
        { key: 'USER', desc: 'Standard user with ordering access' },
        { key: 'ADMIN', desc: 'Full system control' }
    ];

    document.getElementById('roleModalBody').innerHTML = `
        <h3 class="text-lg font-bold text-text-main mb-1">Change Role</h3>
        <p class="text-sm text-text-muted mb-5">${user.name} — Current: <span class="font-bold">${user.role}</span></p>

        <div class="space-y-2 mb-4" id="roleCards">
            ${roles.map(r => `
                <button onclick="selectRole('${r.key}')" class="role-card w-full text-left p-3.5 rounded-xl border-2 transition-all ${r.key === user.role ? 'border-primary/30 bg-primary/5 cursor-default' : 'border-transparent hover:border-primary/20 hover:bg-white/50 cursor-pointer'}" data-role="${r.key}" ${r.key === user.role ? 'disabled' : ''}>
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-bold text-text-main">${r.key}</span>
                        ${r.key === user.role ? '<span class="text-[10px] font-bold text-primary">Current</span>' : ''}
                    </div>
                    <p class="text-xs text-text-muted mt-0.5">${r.desc}</p>
                </button>`).join('')}
        </div>

        <div id="superAdminWarning" class="hidden mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <span class="text-amber-600">⚠️</span>
            <p class="text-xs font-bold text-amber-700">This grants full system control.</p>
        </div>

        <div class="flex gap-3 justify-end">
            <button onclick="closeRoleModal()" class="px-5 py-2.5 text-sm font-bold text-text-muted rounded-xl hover:bg-black/5 transition-colors">Cancel</button>
            <button id="roleConfirmBtn" onclick="confirmRoleChange()" class="px-6 py-2.5 text-sm font-bold text-white bg-forest rounded-xl hover:bg-green-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" disabled>
                <span id="roleConfirmText">Update Role</span>
                <span id="roleSpinner" class="hidden animate-spin material-symbols-outlined text-[16px]">progress_activity</span>
            </button>
        </div>`;

    const modal = document.getElementById('roleModal');
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function selectRole(role) {
    const user = usersData.find(u => u.id === editingUserId);
    if (!user || role === user.role) return;
    selectedRole = role;

    document.querySelectorAll('.role-card').forEach(c => {
        c.classList.remove('border-primary', 'bg-primary/10');
        c.classList.add('border-transparent');
    });
    const card = document.querySelector(`.role-card[data-role="${role}"]`);
    if (card) { card.classList.add('border-primary', 'bg-primary/10'); card.classList.remove('border-transparent'); }

    document.getElementById('roleConfirmBtn').disabled = (role === user.role);
    document.getElementById('superAdminWarning').classList.toggle('hidden', role !== 'ADMIN');
}

// PUT /api/admin/users/:editingUserId { role: selectedRole }
async function confirmRoleChange() {
    if (!editingUserId || !selectedRole) return;
    const btn = document.getElementById('roleConfirmBtn');
    btn.disabled = true;
    document.getElementById('roleConfirmText').textContent = 'Updating...';
    document.getElementById('roleSpinner').classList.remove('hidden');

    try {
        await HealthBite.apiFetch(`/users/${editingUserId}`, {
            method: 'PUT',
            body: JSON.stringify({ role: selectedRole })
        });

        const user = usersData.find(u => u.id === editingUserId);
        const isOwnRole = (user.id === localStorage.getItem('admin_id'));
        user.role = selectedRole;

        closeRoleModal();
        renderTable(usersData);

        if (isOwnRole) {
            if (window.HealthBite) HealthBite.showToast('Your role changed. Reloading...', 'warn');
            setTimeout(() => location.reload(), 2000);
        } else {
            if (window.HealthBite) HealthBite.showToast(`Role updated to ${selectedRole}`, 'success');
        }
    } catch (e) {
        if (window.HealthBite) HealthBite.showToast('Failed to update role', 'error');
        btn.disabled = false;
        document.getElementById('roleConfirmText').textContent = 'Update Role';
        document.getElementById('roleSpinner').classList.add('hidden');
    }
}

function closeRoleModal() {
    const modal = document.getElementById('roleModal');
    modal.classList.add('hidden'); modal.classList.remove('flex');
    editingUserId = null; selectedRole = null;
}

// ═══════════════════════════════════════
// DEACTIVATE / REACTIVATE POPOVER
// ═══════════════════════════════════════
function openDeactivatePopover(userId, currentStatus, anchorEl) {
    closeAllPopovers();
    const user = usersData.find(u => u.id === userId);
    if (!user) return;
    const isActive = currentStatus === 'Active';

    const popover = document.createElement('div');
    popover.className = 'deactivate-popover bg-white rounded-xl shadow-xl border border-black/10 p-4 w-64';
    popover.innerHTML = `
        <p class="text-sm font-medium text-text-main mb-3">${isActive ? `Deactivate ${user.name}? They will lose system access.` : `Reactivate ${user.name}?`}</p>
        <div class="flex gap-2">
            <button onclick="confirmDeactivation(${userId}, ${!isActive})" class="px-3 py-1.5 text-xs font-bold text-white rounded-lg ${isActive ? 'bg-danger-red hover:bg-red-700' : 'bg-forest hover:bg-green-800'} transition-colors">
                ${isActive ? 'Yes, Deactivate' : 'Yes, Reactivate'}
            </button>
            <button onclick="closeAllPopovers()" class="text-xs font-bold text-text-muted hover:underline">Cancel</button>
        </div>`;

    anchorEl.closest('.relative').appendChild(popover);
}

async function confirmDeactivation(userId, makeActive) {
    closeAllPopovers();
    try {
        const newStatus = makeActive ? 'Active' : 'Deactivated';
        await HealthBite.apiFetch(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });

        const user = usersData.find(u => u.id === userId);
        if (!user) return;
        user.status = newStatus;

        renderTable(usersData);
        updateSummaryStrip();
        if (window.HealthBite) HealthBite.showToast(`${user.name} has been ${makeActive ? 'reactivated' : 'deactivated'}`, 'success');
    } catch (e) {
        if (window.HealthBite) HealthBite.showToast('Action failed', 'error');
    }
}

function closeAllPopovers() {
    document.querySelectorAll('.deactivate-popover').forEach(p => p.remove());
}

// ═══════════════════════════════════════
// FILTERING
// ═══════════════════════════════════════
function filterUsers() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const role = document.getElementById('filterRole').value;
    const risk = document.getElementById('filterRisk').value;
    const status = document.getElementById('filterStatus').value;

    const filtered = usersData.filter(u => {
        const matchSearch = u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
        const matchRole = role === 'all' || u.role === role;
        const matchRisk = risk === 'all' || u.risk_level === risk;
        const matchStatus = status === 'all' || u.status === status;
        return matchSearch && matchRole && matchRisk && matchStatus;
    });

    renderTable(filtered);
    updateResultsCount(filtered.length, usersData.length);
}

function updateResultsCount(showing, total) {
    document.getElementById('resultsCount').textContent = `Showing ${showing} of ${total} users`;
}

// ═══════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════
function formatRelativeTime(isoString) {
    const now = new Date(); const past = new Date(isoString);
    const diffMin = Math.floor((now - past) / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
    if (diffHr < 24) return `${diffHr} hr${diffHr > 1 ? 's' : ''} ago`;
    if (diffDay === 1) return 'Yesterday';
    return `${diffDay} days ago`;
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
