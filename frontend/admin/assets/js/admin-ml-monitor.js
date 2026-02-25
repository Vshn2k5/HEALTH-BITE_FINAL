/**
 * HealthBite Admin — AI Monitoring Logic
 *
 * STATE:
 *   let pollingInterval = null
 *   let currentFilters = {}
 *   let currentPage = 1
 *   let featureChart = null
 *   let accuracyChart = null
 */

let pollingInterval = null;
let currentFilters = {};
let currentPage = 1;
let featureChart = null;
let accuracyChart = null;

// Chart.js defaults
Chart.defaults.color = '#738A76';
Chart.defaults.font.family = 'Plus Jakarta Sans, sans-serif';
Chart.defaults.font.size = 11;
Chart.defaults.plugins.tooltip.backgroundColor = '#1B261D';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;

document.addEventListener('DOMContentLoaded', () => { init(); });

async function init() {
    await Promise.all([
        loadAiStatus(),
        loadFeatureImportanceChart(),
        loadAccuracyTrendChart(),
        loadRecommendationLogs(1, {}),
        loadTrainingHistory()
    ]);

    // Filter listeners → filterLogs
    document.getElementById('logSearch').addEventListener('input', filterLogs);
    document.getElementById('logRisk').addEventListener('change', filterLogs);
    document.getElementById('logAction').addEventListener('change', filterLogs);
    document.getElementById('logPeriod').addEventListener('change', filterLogs);

    // Page input → Enter to jump
    document.getElementById('pageInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const pg = parseInt(e.target.value, 10);
            if (pg >= 1) goToPage(pg);
        }
    });

    // Modal overlay click
    document.getElementById('retrainModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('retrainModal')) closeRetrainModal();
    });
}

// ═══════════════════════════════════════
// loadAiStatus()
// GET /api/admin/ai/status
// ═══════════════════════════════════════
async function loadAiStatus() {
    let data = {
        status: 'Active', version: 'v2.4.1',
        last_trained: new Date(Date.now() - 3 * 86400000).toISOString(),
        total_predictions: 0,
        metrics: { accuracy: 0, precision: 0, recall: 0, f1: 0 }
    };

    try {
        const response = await HealthBite.apiFetch('/ai/status');
        data = response.data || data;
    } catch (e) {
        console.error('Failed to load AI status', e);
    }

    // Status bar
    updateStatusBar(data.status, data.version, data.last_trained, data.total_predictions);

    // Metric cards
    setMetric('metricAccuracy', data.metrics.accuracy + '%', 'accBar', data.metrics.accuracy, getMetricColor(data.metrics.accuracy));
    setMetric('metricPrecision', data.metrics.precision.toFixed(2), 'precBar', data.metrics.precision * 100, getMetricColor(data.metrics.precision * 100));
    setMetric('metricRecall', data.metrics.recall.toFixed(2), 'recBar', data.metrics.recall * 100, getMetricColor(data.metrics.recall * 100));
    setMetric('metricF1', data.metrics.f1.toFixed(2), 'f1Bar', data.metrics.f1 * 100, getMetricColor(data.metrics.f1 * 100));
}

function updateStatusBar(status, version, lastTrained, totalPred) {
    const dot = document.getElementById('statusDot');
    const label = document.getElementById('statusLabel');
    const sub = document.getElementById('statusSub');

    dot.className = 'w-4 h-4 rounded-full';
    if (status === 'Active') { dot.classList.add('status-active'); label.textContent = 'Active'; label.className = 'text-lg font-bold text-forest'; }
    else if (status === 'Degraded') { dot.classList.add('status-degraded'); label.textContent = 'Degraded'; label.className = 'text-lg font-bold text-accent-orange'; }
    else if (status === 'Retraining') { dot.classList.add('status-retraining'); label.textContent = 'Retraining...'; label.className = 'text-lg font-bold text-cyan-600'; }

    document.getElementById('modelVersion').textContent = version;
    document.getElementById('versionPill').textContent = version;
    document.getElementById('lastTrained').textContent = formatRelativeTime(lastTrained);
    document.getElementById('totalPredictions').textContent = totalPred.toLocaleString();

    // Disable retrain button if Retraining
    const btn = document.getElementById('retrainBtn');
    btn.disabled = status === 'Retraining';
    if (status === 'Retraining') { btn.classList.add('opacity-50', 'cursor-not-allowed'); }
    else { btn.classList.remove('opacity-50', 'cursor-not-allowed'); }
}

function setMetric(textId, text, barId, pct, color) {
    const el = document.getElementById(textId);
    el.textContent = text;
    el.classList.remove('shimmer'); el.style.width = 'auto'; el.style.height = 'auto';
    const bar = document.getElementById(barId);
    bar.style.background = color;
    requestAnimationFrame(() => setTimeout(() => { bar.style.width = pct + '%'; }, 100));
}

function getMetricColor(pct) {
    if (pct > 85) return '#2E7D32';
    if (pct >= 60) return '#FB8C00';
    return '#E53935';
}

// ═══════════════════════════════════════
// loadFeatureImportanceChart()
// GET /api/admin/ai/features
// ═══════════════════════════════════════
async function loadFeatureImportanceChart() {
    if (featureChart) { featureChart.destroy(); featureChart = null; }

    let features = [];
    try {
        const response = await HealthBite.apiFetch('/ai/features');
        features = response.data || [];
    } catch (e) {
        console.error('Failed to load feature importance', e);
    }
    features.sort((a, b) => b.importance - a.importance);

    const ctx = document.getElementById('featureChart').getContext('2d');
    featureChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: features.map(f => f.name),
            datasets: [{
                data: features.map(f => f.importance),
                backgroundColor: features.map((_, i) => `rgba(46,125,50,${1 - i * 0.08})`),
                borderRadius: 4, barThickness: 24
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => `Importance: ${ctx.raw}%` } }
            },
            scales: {
                x: { grid: { color: 'rgba(0,0,0,0.04)' }, max: 100, ticks: { callback: v => v + '%' } },
                y: { grid: { display: false } }
            }
        }
    });
}

// ═══════════════════════════════════════
// loadAccuracyTrendChart()
// GET /api/admin/ai/accuracy-history
// ═══════════════════════════════════════
async function loadAccuracyTrendChart() {
    if (accuracyChart) { accuracyChart.destroy(); accuracyChart = null; }

    let dates = [];
    let accuracy = [];
    let notes = [];
    try {
        const response = await HealthBite.apiFetch('/ai/accuracy-history');
        if (response.data) {
            dates = response.data.dates;
            accuracy = response.data.accuracy;
            notes = response.data.notes;
        }
    } catch (e) {
        console.error('Failed to load accuracy history', e);
    }

    // Reference line plugin (dashed line at 85%)
    const refLinePlugin = {
        id: 'refLine',
        afterDraw(chart) {
            const y = chart.scales.y.getPixelForValue(85);
            const ctx = chart.ctx;
            ctx.save();
            ctx.setLineDash([5, 3]);
            ctx.strokeStyle = 'rgba(229,57,53,0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(chart.chartArea.left, y);
            ctx.lineTo(chart.chartArea.right, y);
            ctx.stroke();
            // Label
            ctx.fillStyle = '#E53935';
            ctx.font = '600 10px "Plus Jakarta Sans"';
            ctx.fillText('Target: 85%', chart.chartArea.right - 70, y - 6);
            ctx.restore();
        }
    };

    const ctx = document.getElementById('accuracyChart').getContext('2d');
    accuracyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Accuracy', data: accuracy,
                borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.1)',
                fill: true, tension: 0.4, borderWidth: 2.5,
                pointRadius: 5, pointHoverRadius: 8,
                pointBackgroundColor: '#06b6d4', pointBorderColor: '#fff', pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        afterLabel: (ctx) => `Notes: ${notes[ctx.dataIndex]}`
                    }
                }
            },
            scales: {
                y: { min: 80, max: 100, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => v + '%' } },
                x: { grid: { display: false } }
            }
        },
        plugins: [refLinePlugin]
    });
}

// ═══════════════════════════════════════
// loadRecommendationLogs(page, filters)
// GET /api/admin/ai/logs?page=&limit=20&risk=&action=&period=&search=
// ═══════════════════════════════════════
async function loadRecommendationLogs(page, filters) {
    currentPage = page;
    currentFilters = filters;
    showLogSkeletons();

    let logs = [];
    let totalPages = 1;
    let totalLogs = 0;

    try {
        const params = new URLSearchParams({ page, limit: 20 });
        if (filters.search) params.append('search', filters.search);
        if (filters.risk && filters.risk !== 'all') params.append('risk', filters.risk);
        if (filters.action && filters.action !== 'all') params.append('action', filters.action);
        if (filters.period && filters.period !== 'all') params.append('period', filters.period);

        const response = await HealthBite.apiFetch(`/ai/logs?${params.toString()}`);
        if (response.data) {
            logs = response.data.logs;
            totalPages = response.data.pages;
            totalLogs = response.data.total;
        }
    } catch (e) {
        console.error('Failed to load recommendation logs', e);
    }

    renderLogRows(logs);
    updatePagination(page, totalPages, totalLogs);
}

function showLogSkeletons() {
    const tbody = document.getElementById('logsTableBody');
    tbody.innerHTML = Array(5).fill(0).map(() => `
        <tr class="h-[52px] border-b border-black/5">
            <td class="px-4 py-2"><div class="shimmer h-4 w-28 rounded"></div></td>
            <td class="px-4 py-2"><div class="shimmer h-4 w-20 rounded"></div></td>
            <td class="px-4 py-2"><div class="shimmer h-5 w-14 rounded-full"></div></td>
            <td class="px-4 py-2"><div class="shimmer h-4 w-28 rounded"></div></td>
            <td class="px-4 py-2"><div class="shimmer h-4 w-36 rounded"></div></td>
            <td class="px-4 py-2"><div class="shimmer h-5 w-10 mx-auto rounded-full"></div></td>
            <td class="px-4 py-2"><div class="shimmer h-5 w-16 mx-auto rounded-full"></div></td>
            <td class="px-4 py-2"><div class="shimmer h-4 w-8 mx-auto rounded"></div></td>
        </tr>`).join('');
}

function renderLogRows(logs) {
    const tbody = document.getElementById('logsTableBody');
    const emptyState = document.getElementById('logsEmptyState');

    if (logs.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden'); emptyState.classList.add('flex');
        return;
    }
    emptyState.classList.add('hidden'); emptyState.classList.remove('flex');

    const gradients = ['from-green-400 to-emerald-600', 'from-blue-400 to-indigo-600', 'from-purple-400 to-fuchsia-600', 'from-amber-400 to-orange-600', 'from-rose-400 to-pink-600'];

    tbody.innerHTML = logs.map(log => {
        const riskBadge = getRiskBadge(log.user_risk);
        const confBadge = getConfidenceBadge(log.confidence);
        const actionBadge = getActionBadge(log.user_action);
        const truncReason = log.reason.length > 40 ? log.reason.slice(0, 40) + '…' : log.reason;
        const grad = gradients[log.user_name.charCodeAt(0) % gradients.length];

        return `<tr class="border-b border-black/5 hover:bg-white/40 transition-colors">
            <td class="px-4 py-2.5">
                <p class="text-xs font-medium text-text-main">${formatDateTime(log.timestamp)}</p>
                <p class="text-[10px] text-text-muted">${formatRelativeTime(log.timestamp)}</p>
            </td>
            <td class="px-4 py-2.5">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-[8px] font-black">${log.user_name.split(' ').map(n => n[0]).join('')}</div>
                    <span class="text-sm font-medium text-text-main">${log.user_name}</span>
                </div>
            </td>
            <td class="px-4 py-2.5">${riskBadge}</td>
            <td class="px-4 py-2.5">
                <span class="text-sm font-medium text-text-main">${log.food_name}</span>
                <span class="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/5 text-text-muted">${log.food_category}</span>
            </td>
            <td class="px-4 py-2.5">
                <span class="text-xs text-text-muted" title="${log.reason}">${truncReason}</span>
            </td>
            <td class="px-4 py-2.5 text-center">${confBadge}</td>
            <td class="px-4 py-2.5 text-center">${actionBadge}</td>
            <td class="px-4 py-2.5 text-center">
                <span class="text-sm font-bold text-text-main">${log.match_score}</span>
            </td>
        </tr>`;
    }).join('');
}

function getRiskBadge(risk) {
    const map = { 'Low': 'bg-green-100 text-green-700', 'Moderate': 'bg-amber-100 text-amber-700', 'High': 'bg-red-100 text-red-700' };
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${map[risk]}">${risk}</span>`;
}

function getConfidenceBadge(pct) {
    let cls = 'bg-green-100 text-green-700';
    if (pct < 60) cls = 'bg-red-100 text-red-700';
    else if (pct < 85) cls = 'bg-amber-100 text-amber-700';
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}">${pct}%</span>`;
}

function getActionBadge(action) {
    const map = {
        'Accepted': 'bg-green-100 text-green-700',
        'Rejected': 'bg-red-100 text-red-700',
        'No Response': 'bg-black/5 text-text-muted'
    };
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${map[action]}">${action}</span>`;
}

function updatePagination(page, totalPages, totalRows) {
    document.getElementById('pageInfo').textContent = `Page ${page} of ${totalPages} (${totalRows} logs)`;
    document.getElementById('pageInput').value = page;
    document.getElementById('prevPageBtn').disabled = page <= 1;
    document.getElementById('nextPageBtn').disabled = page >= totalPages;
}

// ═══════════════════════════════════════
// loadTrainingHistory()
// GET /api/admin/ai/training-history
// ═══════════════════════════════════════
async function loadTrainingHistory() {
    let history = [];
    try {
        const response = await HealthBite.apiFetch('/ai/training-history');
        history = response.data || [];
    } catch (e) {
        console.error('Failed to load training history', e);
    }

    document.getElementById('historyTableBody').innerHTML = history.map(h => {
        const statusBadge = getTrainStatusBadge(h.status);
        const accDiff = h.acc_after - h.acc_before;
        const accColor = accDiff > 0 ? 'text-green-600' : accDiff === 0 ? 'text-text-muted' : 'text-red-600';

        return `<tr class="border-b border-black/5 hover:bg-white/40 transition-colors">
            <td class="px-4 py-3 text-sm text-text-muted">#${h.id}</td>
            <td class="px-4 py-3 text-sm font-medium text-text-main">${h.triggered_by}</td>
            <td class="px-4 py-3 text-sm text-text-muted">${h.date}</td>
            <td class="px-4 py-3 text-sm text-text-muted">${h.duration}</td>
            <td class="px-4 py-3 text-sm text-right">${h.acc_before}%</td>
            <td class="px-4 py-3 text-sm text-right font-bold ${accColor}">${h.acc_after}%</td>
            <td class="px-4 py-3 text-center">${statusBadge}</td>
            <td class="px-4 py-3 text-xs text-text-muted">${h.notes}</td>
        </tr>`;
    }).join('');
}

function getTrainStatusBadge(status) {
    if (status === 'Success') return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Success</span>`;
    if (status === 'Failed') return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Failed</span>`;
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-700 animate-pulse">In Progress</span>`;
}

// ═══════════════════════════════════════
// RETRAIN MODAL + POLLING
// ═══════════════════════════════════════
function openRetrainModal() {
    const modal = document.getElementById('retrainModal');
    const btn = document.getElementById('confirmRetrainBtn');
    document.getElementById('retrainBtnText').textContent = 'Start Retraining';
    document.getElementById('retrainSpinner').classList.add('hidden');
    btn.disabled = false;
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function closeRetrainModal() {
    const modal = document.getElementById('retrainModal');
    modal.classList.add('hidden'); modal.classList.remove('flex');
}

// POST /api/admin/ai/retrain
async function confirmRetrain() {
    const btn = document.getElementById('confirmRetrainBtn');
    btn.disabled = true;
    document.getElementById('retrainBtnText').textContent = 'Initiating...';
    document.getElementById('retrainSpinner').classList.remove('hidden');

    try {
        await HealthBite.apiFetch('/ai/retrain', { method: 'POST' });

        closeRetrainModal();
        updateStatusBar('Retraining', document.getElementById('versionPill').textContent, new Date().toISOString(), parseInt(document.getElementById('totalPredictions').textContent.replace(/,/g, ''), 10));

        if (window.HealthBite) HealthBite.showToast('Model retraining initiated', 'success');

        startPolling();
    } catch (e) {
        if (window.HealthBite) HealthBite.showToast('Retraining failed. Please try again.', 'error');
        btn.disabled = false;
        document.getElementById('retrainBtnText').textContent = 'Start Retraining';
        document.getElementById('retrainSpinner').classList.add('hidden');
    }
}

// ═══════════════════════════════════════
// Polling — GET /api/admin/ai/status every 10s
// ═══════════════════════════════════════
function startPolling() {
    pollingInterval = setInterval(pollStatus, 10000);
}

try {
    const response = await HealthBite.apiFetch('/ai/status');
    const data = response.data;
    if (data && data.status !== 'Retraining') {
        stopPolling();
        const newAccuracy = data.metrics?.accuracy || 0;
        updateStatusBar(data.status, data.version, data.last_trained, data.total_predictions);
        setMetric('metricAccuracy', newAccuracy + '%', 'accBar', newAccuracy, getMetricColor(newAccuracy));

        if (data.status === 'Active') {
            if (window.HealthBite) HealthBite.showToast(`Model retrained successfully. New accuracy: ${newAccuracy}%`, 'success');
        } else {
            if (window.HealthBite) HealthBite.showToast(`Retraining ended with status: ${data.status}`, 'warn');
        }

        // Refresh training history
        loadTrainingHistory();
    }
} catch (e) {
    console.error('Polling for AI status failed', e);
}

function stopPolling() {
    if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
}

// ═══════════════════════════════════════
// filterLogs() — reads all filter inputs, resets to page 1
// ═══════════════════════════════════════
function filterLogs() {
    const filters = {
        search: document.getElementById('logSearch').value.trim(),
        risk: document.getElementById('logRisk').value,
        action: document.getElementById('logAction').value,
        period: document.getElementById('logPeriod').value
    };
    loadRecommendationLogs(1, filters);
}

function goToPage(pageNum) {
    if (pageNum < 1) return;
    loadRecommendationLogs(pageNum, currentFilters);
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

function formatDateTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' +
        d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}
