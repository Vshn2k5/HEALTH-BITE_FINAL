/**
 * HealthBite Admin — Audit Logs Logic
 * Read-only interface. Server-side filtering logic simulation.
 */

let logsData = [];
let currentPage = 1;
let currentPerPage = 20;
let currentFilters = {};
let expandedLogId = null;
let autoRefreshInterval = null;
let lastActionInterval = null;
let debounceTimer = null;
let refreshCountdown = 30;
let countdownTimer = null;


document.addEventListener('DOMContentLoaded', () => { init(); });

async function init() {
    await Promise.all([
        loadSummary(),
        loadAdminList(),
        loadLogs(1, 20, {})
    ]);

    startLastActionRefresh();

    // Filter listeners (debounced)
    const filters = ['Search', 'Admin', 'Action', 'Target', 'From', 'To', 'Ip'];
    filters.forEach(f => {
        document.getElementById(`filter${f}`).addEventListener('input', () => { handleFilterChange(f.toLowerCase()); });
        if (['Admin', 'Action', 'Target'].includes(f)) {
            document.getElementById(`filter${f}`).addEventListener('change', () => { handleFilterChange(f.toLowerCase()); });
        }
    });

    // Pagination listeners
    document.getElementById('perPageSelect').addEventListener('change', (e) => {
        changePerPage(parseInt(e.target.value, 10));
    });

    document.getElementById('pageInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') jumpToPage();
    });

    // Auto-refresh toggle
    document.getElementById('autoRefreshToggle').addEventListener('change', (e) => {
        if (e.target.checked) startAutoRefresh();
        else stopAutoRefresh();
    });
}

// ═══════════════════════════════════════
// FILTER ROUTING & DEBOUNCE
// ═══════════════════════════════════════
function handleFilterChange(key) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const val = document.getElementById(`filter${key.charAt(0).toUpperCase() + key.slice(1)}`).value;
        if (val && val !== 'all') {
            currentFilters[key] = val;
        } else {
            delete currentFilters[key];
        }
        renderFilterPills();
        loadLogs(1, currentPerPage, currentFilters);
    }, 400);
}

function renderFilterPills() {
    const container = document.getElementById('filterPillsContainer');
    const keys = Object.keys(currentFilters);

    if (keys.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    container.innerHTML = keys.map(k => {
        return `<div class="flex items-center gap-1.5 px-3 py-1 bg-white rounded-full border border-black/10 shadow-sm">
            <span class="text-[10px] font-bold text-text-muted capitalize">${k}:</span>
            <span class="text-xs font-semibold text-text-main">${currentFilters[k]}</span>
            <button onclick="removeFilter('${k}')" class="ml-1 text-text-muted hover:text-danger-red transition-colors flex items-center justify-center"><span class="material-symbols-outlined text-[14px]">close</span></button>
        </div>`;
    }).join('');
}

function removeFilter(key) {
    delete currentFilters[key];
    const el = document.getElementById(`filter${key.charAt(0).toUpperCase() + key.slice(1)}`);
    if (el) {
        if (el.tagName === 'SELECT') el.value = 'all';
        else el.value = '';
    }
    renderFilterPills();
    loadLogs(1, currentPerPage, currentFilters);
}

function clearAllFilters() {
    currentFilters = {};
    const filters = ['Search', 'Admin', 'Action', 'Target', 'From', 'To', 'Ip'];
    filters.forEach(f => {
        const el = document.getElementById(`filter${f}`);
        if (el.tagName === 'SELECT') el.value = 'all';
        else el.value = '';
    });
    renderFilterPills();
    loadLogs(1, currentPerPage, currentFilters);
}

function filterByIp(ipAddress) {
    document.getElementById('filterIp').value = ipAddress;
    handleFilterChange('ip');
}

// ═══════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════
async function loadSummary() {
    let stats = { total: 0, today: 0, admins: 0, last: new Date().toISOString() };
    try {
        const response = await HealthBite.apiFetch('/audit/summary');
        stats = response.data || stats;
    } catch (e) {
        console.error('Failed to load audit summary', e);
    }

    setStat('statTotal', stats.total.toLocaleString());
    setStat('statToday', stats.today.toLocaleString());
    setStat('statAdmins', stats.admins.toString());
    updateLastActionTime(stats.last);
}

function setStat(id, val) {
    const el = document.getElementById(id);
    el.textContent = val;
    el.classList.remove('shimmer'); el.style.width = 'auto'; el.style.height = 'auto';
}

function startLastActionRefresh() {
    const lastIso = new Date(Date.now() - 120000).toISOString();
    lastActionInterval = setInterval(() => updateLastActionTime(lastIso), 30000);
}
function updateLastActionTime(iso) {
    setStat('statLastAction', formatRelativeTime(iso));
}

async function loadAdminList() {
    let admins = [];
    try {
        const response = await HealthBite.apiFetch('/audit/admins');
        admins = response.data || [];
    } catch (e) {
        console.error('Failed to load admin list', e);
    }
    const sel = document.getElementById('filterAdmin');
    admins.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.name;
        sel.appendChild(opt);
    });
}

// GET /api/admin/audit?page=&limit=&filters...
async function loadLogs(page, perPage, filters) {
    document.getElementById('tableLoading').classList.remove('hidden');
    document.getElementById('tableLoading').classList.add('flex');

    currentPage = page;
    currentPerPage = perPage;

    let logs = [];
    let total = 0;
    let pages = 1;

    try {
        const params = new URLSearchParams({ page, limit: perPage });
        if (filters.search) params.append('search', filters.search);
        if (filters.admin) params.append('admin_id', filters.admin);
        if (filters.action) params.append('action_type', filters.action);
        if (filters.target) params.append('target_table', filters.target);
        if (filters.ip) params.append('ip', filters.ip);
        if (filters.from) params.append('from', filters.from);
        if (filters.to) params.append('to', filters.to);

        const response = await HealthBite.apiFetch(`/audit?${params.toString()}`);
        if (response.data) {
            logs = response.data.logs;
            total = response.data.total;
            pages = response.data.pages;
        }
    } catch (e) {
        console.error('Failed to load audit logs', e);
    }

    logsData = logs;

    document.getElementById('tableLoading').classList.add('hidden');
    document.getElementById('tableLoading').classList.remove('flex');

    renderTable(logs);
    renderPagination(total, page, pages, perPage);
}

// ═══════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════
function renderTable(logs) {
    const tbody = document.getElementById('logsTableBody');
    const emptyState = document.getElementById('logsEmptyState');

    if (logs.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden'); emptyState.classList.add('flex');
        return;
    }
    emptyState.classList.add('hidden'); emptyState.classList.remove('flex');

    tbody.innerHTML = logs.map(log => buildLogRow(log)).join('');
}

function buildLogRow(log) {
    const gradients = ['from-green-400 to-emerald-600', 'from-blue-400 to-indigo-600', 'from-purple-400 to-fuchsia-600', 'from-amber-400 to-orange-600'];
    const grad = gradients[log.admin_name.charCodeAt(0) % gradients.length];

    const actionBadge = getActionBadge(log.action_type);

    return `
        <tr class="border-b border-black/5 hover:bg-white/40 transition-colors group cursor-pointer" onclick="toggleExpandRow('${log.id}')">
            <td class="px-4 py-2.5">
                <p class="text-xs font-semibold text-text-main">${formatDateTime(log.timestamp)}</p>
                <p class="text-[10px] text-text-muted mt-0.5">${formatRelativeTime(log.timestamp)}</p>
            </td>
            <td class="px-4 py-2.5">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-[9px] font-black">${log.admin_name.split(' ').map(n => n[0]).join('')}</div>
                    <div>
                        <span class="text-sm font-semibold text-text-main leading-tight block">${log.admin_name}</span>
                        <span class="text-[9px] font-bold text-text-muted leading-tight uppercase tracking-wide">${log.admin_role}</span>
                    </div>
                </div>
            </td>
            <td class="px-4 py-2.5">${actionBadge}</td>
            <td class="px-4 py-2.5">
                <span class="px-2.5 py-1 rounded bg-black/5 text-text-muted text-[11px] font-mono">${log.target_table}</span>
            </td>
            <td class="px-4 py-2.5">
                <span class="text-sm text-text-main block truncate max-w-[280px]" title="${log.summary}">${log.summary}</span>
            </td>
            <td class="px-4 py-2.5">
                <span class="text-xs text-text-muted hover:text-primary font-mono cursor-pointer transition-colors" onclick="event.stopPropagation(); filterByIp('${log.ip_address}')">${log.ip_address}</span>
            </td>
            <td class="px-4 py-2.5 text-center">
                <button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors">
                    <span id="chevron-${log.id}" class="material-symbols-outlined text-text-muted text-[20px] transition-transform duration-300">expand_more</span>
                </button>
            </td>
        </tr>
        <tr id="payload-${log.id}" class="payload-row bg-[#FAFAFA]">
            <td colspan="7" class="p-0 border-b border-black/10 shadow-inner">
                <div class="p-5" id="payload-content-${log.id}"></div>
            </td>
        </tr>
    `;
}

function getActionBadge(action) {
    const map = {
        'CREATE': 'bg-green-100 text-green-700',
        'UPDATE': 'bg-cyan-100 text-cyan-700',
        'DELETE': 'bg-red-100 text-red-700',
        'LOGIN': 'bg-purple-100 text-purple-700',
        'LOGOUT': 'bg-gray-200 text-gray-700',
        'EXPORT': 'bg-blue-100 text-blue-700',
        'RETRAIN': 'bg-amber-100 text-amber-700',
        'STATUS_CHANGE': 'bg-orange-100 text-orange-700'
    };
    return `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${map[action] || 'bg-black/5 text-text-muted'}">${action}</span>`;
}

// ═══════════════════════════════════════
// EXPANDABLE PAYLOAD & DIFF
// ═══════════════════════════════════════
function toggleExpandRow(id) {
    // Collapse previous
    if (expandedLogId && expandedLogId !== id) {
        document.getElementById(`payload-${expandedLogId}`)?.classList.remove('expanded');
        document.getElementById(`chevron-${expandedLogId}`)?.classList.remove('rotate-180');
    }

    const row = document.getElementById(`payload-${id}`);
    const chev = document.getElementById(`chevron-${id}`);

    if (row.classList.contains('expanded')) {
        row.classList.remove('expanded');
        chev.classList.remove('rotate-180');
        expandedLogId = null;
    } else {
        const log = logsData.find(l => l.id === id);
        if (document.getElementById(`payload-content-${id}`).innerHTML === '') {
            renderPayloadViewer(log);
        }
        row.classList.add('expanded');
        chev.classList.add('rotate-180');
        expandedLogId = id;
    }
}

function renderPayloadViewer(log) {
    const container = document.getElementById(`payload-content-${log.id}`);

    if (!log.payload) {
        container.innerHTML = `<p class="text-sm font-semibold text-text-muted flex items-center gap-2"><span class="material-symbols-outlined">visibility_off</span> No payload data recorded for this action.</p>`;
        return;
    }

    const hl = syntaxHighlight(log.payload);
    let html = `
        <div class="relative bg-white border border-black/10 shadow-sm rounded-lg overflow-hidden max-h-[320px] flex flex-col">
            <div class="px-4 py-2 border-b border-black/5 bg-gray-50 flex justify-between items-center z-10 sticky top-0">
                <span class="text-[11px] font-bold text-text-muted uppercase tracking-wider">Raw JSON Payload</span>
                <button onclick="copyPayload('${log.id}')" class="text-xs font-bold text-forest hover:text-primary transition-colors flex items-center gap-1.5"><span class="material-symbols-outlined text-[14px]">content_copy</span> Copy JSON</button>
            </div>
            <div class="overflow-y-auto flex-1">
                <pre class="json-viewer">${hl}</pre>
            </div>
        </div>
    `;

    if (log.action_type === 'UPDATE' && log.payload_before && log.payload_after) {
        html += `<div class="mt-4"><span class="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2 px-1">Changes Diff</span>${renderDiffView(log.payload_before, log.payload_after)}</div>`;
    }

    container.innerHTML = html;
}

function syntaxHighlight(jsonObj) {
    let json = JSON.stringify(jsonObj, null, 2);
    // Escape HTML
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Regex for basic syntax highlighting
    json = json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'json-number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) { cls = 'json-key'; }
            else { cls = 'json-string'; }
        } else if (/true|false/.test(match)) {
            cls = 'json-bool';
        } else if (/null/.test(match)) {
            cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
    // Add lines wrap
    const lines = json.split('\n');
    return lines.map(l => `<span class="line">${l}</span>`).join('');
}

function renderDiffView(before, after) {
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

    let html = `<div class="grid grid-cols-2 gap-4">`;

    // Panel 1: Before
    let h1 = `<div class="bg-[#FFEBEB]/40 border border-[#FCA5A5]/40 rounded-lg overflow-hidden"><div class="px-4 py-1.5 bg-[#FCA5A5]/20 text-[#DC2626] text-[11px] font-bold uppercase tracking-wider border-b border-[#FCA5A5]/40">Before</div><div class="p-3 font-mono text-xs">`;
    // Panel 2: After
    let h2 = `<div class="bg-[#ECFDF5]/50 border border-[#86EFAC]/40 rounded-lg overflow-hidden"><div class="px-4 py-1.5 bg-[#86EFAC]/30 text-[#059669] text-[11px] font-bold uppercase tracking-wider border-b border-[#86EFAC]/40">After</div><div class="p-3 font-mono text-xs">`;

    keys.forEach(k => {
        const v1 = JSON.stringify(before[k]);
        const v2 = JSON.stringify(after[k]);

        if (v1 === v2) {
            h1 += `<div class="text-text-muted py-0.5"><span class="font-bold mr-2">${k}:</span>${v1}</div>`;
            h2 += `<div class="text-text-muted py-0.5"><span class="font-bold mr-2">${k}:</span>${v2}</div>`;
        } else if (v1 === undefined) {
            // Added
            h1 += `<div class="py-0.5 text-transparent select-none">&nbsp;</div>`;
            h2 += `<div class="py-0.5 diff-added px-1 rounded"><span class="font-bold mr-2">${k}:</span>${v2}</div>`;
        } else if (v2 === undefined) {
            // Removed
            h1 += `<div class="py-0.5 diff-removed px-1 rounded"><span class="font-bold mr-2">${k}:</span>${v1}</div>`;
            h2 += `<div class="py-0.5 text-transparent select-none">&nbsp;</div>`;
        } else {
            // Changed
            h1 += `<div class="py-0.5 diff-changed px-1 rounded"><span class="font-bold mr-2">${k}:</span>${v1}</div>`;
            h2 += `<div class="py-0.5 diff-changed px-1 rounded"><span class="font-bold mr-2">${k}:</span>${v2}</div>`;
        }
    });

    h1 += `</div></div>`; h2 += `</div></div>`;
    return html + h1 + h2 + `</div>`;
}

function copyPayload(id) {
    const log = logsData.find(l => l.id === id);
    if (log && log.payload) {
        navigator.clipboard.writeText(JSON.stringify(log.payload, null, 2)).then(() => {
            const toast = document.getElementById('microToast');
            toast.style.opacity = '1';
            setTimeout(() => toast.style.opacity = '0', 1500);
        });
    }
}

// ═══════════════════════════════════════
// PAGINATION
// ═══════════════════════════════════════
function renderPagination(total, page, pages, perPage) {
    const startObj = (page - 1) * perPage + 1;
    const endObj = Math.min(page * perPage, total);

    document.getElementById('pageInfo').textContent = `Showing ${startObj}–${endObj} of ${total.toLocaleString()} results`;
    document.getElementById('pageInput').value = page;

    const nav = document.getElementById('paginationControls');
    let h = '';

    h += `<button onclick="goToPage(1)" class="px-2 py-1 mx-0.5 text-xs font-bold rounded hover:bg-black/5 ${page === 1 ? 'opacity-30 cursor-not-allowed' : 'text-text-muted'}" ${page === 1 ? 'disabled' : ''}>First</button>`;
    h += `<button onclick="goToPage(${page - 1})" class="px-2 py-1 mx-0.5 text-xs font-bold rounded hover:bg-black/5 ${page === 1 ? 'opacity-30 cursor-not-allowed' : 'text-text-muted'}" ${page === 1 ? 'disabled' : ''}>Prev</button>`;

    let start = Math.max(1, page - 2);
    let end = Math.min(pages, page + 2);
    if (end - start < 4) {
        if (start === 1) end = Math.min(pages, 5);
        if (end === pages) start = Math.max(1, pages - 4);
    }

    for (let i = start; i <= end; i++) {
        const pCls = i === page
            ? 'bg-forest text-white shadow shadow-forest/20'
            : 'text-text-main hover:bg-black/5 bg-white';
        h += `<button onclick="goToPage(${i})" class="w-7 h-7 mx-0.5 rounded flex items-center justify-center text-xs font-bold transition-colors ${pCls}">${i}</button>`;
    }

    h += `<button onclick="goToPage(${page + 1})" class="px-2 py-1 mx-0.5 text-xs font-bold rounded hover:bg-black/5 ${page === pages ? 'opacity-30 cursor-not-allowed' : 'text-text-muted'}" ${page === pages ? 'disabled' : ''}>Next</button>`;
    h += `<button onclick="goToPage(${pages})" class="px-2 py-1 mx-0.5 text-xs font-bold rounded hover:bg-black/5 ${page === pages ? 'opacity-30 cursor-not-allowed' : 'text-text-muted'}" ${page === pages ? 'disabled' : ''}>Last</button>`;

    nav.innerHTML = h;
}

function goToPage(p) {
    if (p < 1 || p === currentPage) return;
    loadLogs(p, currentPerPage, currentFilters);
    expandedLogId = null; // Clean up expansion on page load
}

function jumpToPage() {
    const p = parseInt(document.getElementById('pageInput').value, 10);
    if (p) goToPage(p);
}

function changePerPage(lim) {
    expandedLogId = null;
    loadLogs(1, lim, currentFilters);
}

// ═══════════════════════════════════════
// AUTO REFRESH
// ═══════════════════════════════════════
function startAutoRefresh() {
    refreshCountdown = 30;
    const counter = document.getElementById('refreshCounter');
    counter.style.opacity = '1';

    countdownTimer = setInterval(() => {
        refreshCountdown--;
        if (refreshCountdown <= 0) {
            refreshCountdown = 30;
            // soft load to keep expand state
            loadLogs(1, currentPerPage, currentFilters);
            counter.textContent = `Last refreshed: Just now`;
        } else {
            counter.textContent = `Refresh in: ${refreshCountdown}s`;
        }
    }, 1000);
}

function stopAutoRefresh() {
    clearInterval(countdownTimer);
    document.getElementById('refreshCounter').style.opacity = '0';
}

// ═══════════════════════════════════════
// UTILS & MOCKS
// ═══════════════════════════════════════
function formatDateTime(isoString) {
    const d = new Date(isoString);
    return `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })} ${d.getFullYear()}, ${d.toLocaleTimeString('en-IN', { hour12: false })}`;
}
function formatRelativeTime(isoString) {
    const min = Math.floor((new Date() - new Date(isoString)) / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return `${min} min${min > 1 ? 's' : ''} ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hr${hr > 1 ? 's' : ''} ago`;
    return `${Math.floor(hr / 24)} days ago`;
}

