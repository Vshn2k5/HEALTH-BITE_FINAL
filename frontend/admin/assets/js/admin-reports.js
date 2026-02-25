/**
 * HealthBite Admin — Reports & Export Logic
 *
 * STATE:
 *   let activeReport = null
 *   let previewData = null
 *   let exportInProgress = false
 */

let activeReport = null;
let previewData = null;
let exportInProgress = false;

document.addEventListener('DOMContentLoaded', () => { init(); });

function init() {
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('inv-date').value = today;
    ['sales', 'health'].forEach(t => { setPresetRange('30d', t); });

    // Inventory history checkbox toggle
    document.getElementById('inv-history-check').addEventListener('change', function () {
        document.getElementById('inv-history-range').classList.toggle('hidden', !this.checked);
    });

    // Format toggle styling
    document.querySelectorAll('.format-toggle input').forEach(inp => {
        inp.addEventListener('change', () => {
            const name = inp.name;
            document.querySelectorAll(`input[name="${name}"]`).forEach(sibling => {
                const span = sibling.nextElementSibling;
                if (sibling.checked) { span.style.background = '#2E7D32'; span.style.color = '#fff'; }
                else { span.style.background = 'rgba(0,0,0,0.05)'; span.style.color = '#738A76'; }
            });
        });
        // Init state
        if (inp.checked) { inp.nextElementSibling.style.background = '#2E7D32'; inp.nextElementSibling.style.color = '#fff'; }
    });

    renderRecentExports();
}

// ═══════════════════════════════════════
// toggleConfigPanel(reportType)
// ═══════════════════════════════════════
function toggleConfigPanel(reportType) {
    const panels = ['sales', 'health', 'inventory'];
    panels.forEach(p => {
        const el = document.getElementById(`panel-${p}`);
        if (p === reportType && !el.classList.contains('open')) {
            el.classList.add('open');
        } else {
            el.classList.remove('open');
        }
    });
    activeReport = reportType;
}

// ═══════════════════════════════════════
// setPresetRange(preset, panelId)
// ═══════════════════════════════════════
function setPresetRange(preset, panelId) {
    const now = new Date();
    let from = new Date(now);
    if (preset === 'today') { from = new Date(now); }
    else if (preset === '7d') { from.setDate(from.getDate() - 7); }
    else if (preset === '30d') { from.setDate(from.getDate() - 30); }
    else if (preset === '90d') { from.setDate(from.getDate() - 90); }

    document.getElementById(`${panelId}-from`).value = from.toISOString().split('T')[0];
    document.getElementById(`${panelId}-to`).value = now.toISOString().split('T')[0];
}

// ═══════════════════════════════════════
// getReportConfig(reportType)
// ═══════════════════════════════════════
function getReportConfig(reportType) {
    const config = { type: reportType };

    if (reportType === 'sales') {
        config.from = document.getElementById('sales-from').value;
        config.to = document.getElementById('sales-to').value;
        config.groupBy = document.querySelector('input[name="sales-group"]:checked')?.value || 'daily';
        config.sections = Array.from(document.querySelectorAll('.sales-section:checked')).map(c => c.value);
        config.format = document.querySelector('input[name="sales-format"]:checked')?.value || 'csv';
    } else if (reportType === 'health') {
        config.from = document.getElementById('health-from').value;
        config.to = document.getElementById('health-to').value;
        config.sections = Array.from(document.querySelectorAll('.health-section:checked')).map(c => c.value);
        config.anonymize = document.getElementById('health-anonymize').checked;
        config.format = document.querySelector('input[name="health-format"]:checked')?.value || 'csv';
    } else if (reportType === 'inventory') {
        config.snapshotDate = document.getElementById('inv-date').value;
        config.sections = Array.from(document.querySelectorAll('.inv-section:checked')).map(c => c.value);
        if (config.sections.includes('history')) {
            config.histFrom = document.getElementById('inv-hist-from')?.value;
            config.histTo = document.getElementById('inv-hist-to')?.value;
        }
        config.format = 'csv';
    }
    return config;
}

// ═══════════════════════════════════════
// validateConfig(reportType)
// ═══════════════════════════════════════
function validateConfig(reportType) {
    const config = getReportConfig(reportType);
    const errors = [];
    if (reportType !== 'inventory') {
        if (!config.from || !config.to) errors.push('Please select a date range');
    } else {
        if (!config.snapshotDate) errors.push('Please select a snapshot date');
    }
    if (errors.length > 0 && window.HealthBite) {
        errors.forEach(e => HealthBite.showToast(e, 'error'));
    }
    return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════════
// previewReport(reportType)
// GET /api/admin/export/{reportType}/preview + params
// ═══════════════════════════════════════
async function previewReport(reportType) {
    if (!validateConfig(reportType).valid) return;
    activeReport = reportType;
    const config = getReportConfig(reportType);

    // Fetch preview data from API
    let data;
    try {
        const queryParams = new URLSearchParams(config);
        const response = await HealthBite.apiFetch(`/export/${reportType}/preview?${queryParams.toString()}`);
        if (response.data) {
            data = response.data;
        } else {
            throw new Error('No preview data returned');
        }
    } catch (e) {
        console.error('Failed to load preview', e);
        if (window.HealthBite) HealthBite.showToast('Failed to load preview', 'error');
        return;
    }

    previewData = data;
    renderPreview(reportType, data);
}

function renderPreview(reportType, data) {
    const names = { sales: 'Sales Report', health: 'Health Trends Report', inventory: 'Inventory Report' };
    document.getElementById('previewTitle').textContent = `Report Preview — ${names[reportType]}`;
    document.getElementById('previewSubtitle').textContent = `Showing first 10 rows. Full report exports ${data.total_rows} rows.`;

    // Header
    document.getElementById('previewThead').innerHTML = `<tr class="border-b border-black/5 text-[10px] uppercase tracking-wider text-text-muted font-bold bg-white/30">${data.columns.map(c => `<th class="px-4 py-3">${c}</th>`).join('')}</tr>`;

    // Body
    document.getElementById('previewTbody').innerHTML = data.rows.map(row =>
        `<tr class="border-b border-black/5 hover:bg-white/40 transition-colors">${row.map(cell => `<td class="px-4 py-2.5 text-sm text-text-main">${cell}</td>`).join('')}</tr>`
    ).join('');

    // Stats
    document.getElementById('previewStats').innerHTML = `
        <span><strong>Total rows:</strong> ${data.total_rows}</span>
        <span><strong>Date range:</strong> ${data.summary.date_range}</span>
        <span><strong>Generated at:</strong> ${data.summary.generated_at}</span>`;

    document.getElementById('previewPanel').classList.remove('hidden');
    document.getElementById('previewPanel').scrollIntoView({ behavior: 'smooth' });
}

function closePreview() {
    document.getElementById('previewPanel').classList.add('hidden');
}

// ═══════════════════════════════════════
// exportReport(reportType, formatOverride)
// GET /api/admin/export/{reportType} + params + &format=
// ═══════════════════════════════════════
async function exportReport(reportType, formatOverride) {
    if (exportInProgress) return;
    if (!reportType) reportType = activeReport;
    if (!reportType) return;
    if (!validateConfig(reportType).valid) return;

    const config = getReportConfig(reportType);
    const format = formatOverride || config.format || 'csv';
    const btn = document.getElementById(`export-btn-${reportType}`);

    exportInProgress = true;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="animate-spin material-symbols-outlined text-[16px]">progress_activity</span><span>Preparing export...</span>`;
    }

    try {
        const queryParams = new URLSearchParams(config);
        queryParams.set('format', format);

        const response = await HealthBite.apiFetch(`/export/${reportType}?${queryParams.toString()}`);
        if (!response.download_url) {
            throw new Error('Download URL missing');
        }

        const downloadUrl = `${HealthBite.API_BASE}${response.download_url}`;

        const token = localStorage.getItem('token');
        const blobResp = await fetch(downloadUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!blobResp.ok) throw new Error('Download failed');

        const blob = await blobResp.blob();
        const filename = `${reportType}-report-${new Date().toISOString().split('T')[0]}.${format}`;

        triggerDownload(blob, filename);
        logExport(reportType, format, config);

        if (btn) btn.innerHTML = `<span class="material-symbols-outlined text-[16px]">check_circle</span><span>✓ Downloaded</span>`;
        setTimeout(() => {
            if (btn) { btn.innerHTML = `<span>Download Report</span>`; btn.disabled = false; }
            exportInProgress = false;
        }, 3000);

        if (window.HealthBite) HealthBite.showToast(`${reportType} report downloaded`, 'success');
    } catch (e) {
        if (window.HealthBite) HealthBite.showToast('Export failed', 'error');
        if (btn) { btn.innerHTML = `<span>Download Report</span>`; btn.disabled = false; }
        exportInProgress = false;
    }
}

// ═══════════════════════════════════════
// triggerDownload(blob, filename)
// ═══════════════════════════════════════
function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

// ═══════════════════════════════════════
// logExport / renderRecentExports — sessionStorage
// ═══════════════════════════════════════
function logExport(reportType, format, config) {
    const logs = JSON.parse(sessionStorage.getItem('exportLogs') || '[]');
    logs.unshift({
        type: reportType, format, dateRange: `${config.from || config.snapshotDate || '—'} to ${config.to || '—'}`,
        generatedAt: new Date().toLocaleString(), config
    });
    if (logs.length > 10) logs.pop();
    sessionStorage.setItem('exportLogs', JSON.stringify(logs));
    renderRecentExports();
}

function renderRecentExports() {
    const logs = JSON.parse(sessionStorage.getItem('exportLogs') || '[]');
    const tbody = document.getElementById('recentExportsBody');
    const empty = document.getElementById('exportsEmpty');

    if (logs.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    const names = { sales: 'Sales Report', health: 'Health Trends', inventory: 'Inventory' };
    tbody.innerHTML = logs.map((l, i) =>
        `<tr class="border-b border-black/5 hover:bg-white/40 transition-colors">
            <td class="px-4 py-2.5 text-sm font-medium text-text-main">${names[l.type] || l.type}</td>
            <td class="px-4 py-2.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${l.format === 'pdf' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}">${l.format.toUpperCase()}</span></td>
            <td class="px-4 py-2.5 text-sm text-text-muted">${l.dateRange}</td>
            <td class="px-4 py-2.5 text-sm text-text-muted">${l.generatedAt}</td>
            <td class="px-4 py-2.5 text-center"><button onclick="downloadAgain(${i})" class="text-xs font-bold text-primary hover:underline">Download Again</button></td>
        </tr>`
    ).join('');
}

function downloadAgain(index) {
    const logs = JSON.parse(sessionStorage.getItem('exportLogs') || '[]');
    if (logs[index]) exportReport(logs[index].type, logs[index].format);
}
