/**
 * HealthBite Admin Dashboard Logic
 * 
 * STATE:
 *   let hourlyChart = null
 *   let salesChart = null
 *   let currentPeriod = '7d'
 *   let hourlyRefreshInterval = null
 */

let hourlyChart = null;
let salesChart = null;
let currentPeriod = '7d';
let hourlyRefreshInterval = null;

// ═══════════════════════════════════════
// CHART.JS GLOBAL DEFAULTS
// ═══════════════════════════════════════
Chart.defaults.color = '#738A76';                                   // text-muted
Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";     // design file font
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(255,255,255,0.92)';
Chart.defaults.plugins.tooltip.titleColor = '#1B261D';
Chart.defaults.plugins.tooltip.bodyColor = '#1B261D';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(0,0,0,0.08)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.scale.grid.color = 'rgba(0,0,0,0.04)';

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    // authGuard, startClock, loadAdminIdentity handled by layout.js

    await loadOverview();

    await Promise.all([
        loadHourlyChart(),
        loadSalesChart('7d'),
        loadTopItems(),
        loadAlerts()
    ]);

    startHourlyAutoRefresh();

    // Attach listeners
    // Card 4 click → navigate to inventory
    document.getElementById('lowStockCard').addEventListener('click', () => {
        window.location.href = 'admin-inventory.html';
    });

    // Topbar bell click → scroll to alerts panel
    document.addEventListener('click', (e) => {
        const bellIcon = e.target.closest('[class*="notifications"]') ||
            (e.target.textContent === 'notifications' && e.target.closest('button'));
        if (bellIcon) {
            document.getElementById('alertsPanel').scrollIntoView({ behavior: 'smooth' });
        }
    });

    // Clear interval on page unload
    window.addEventListener('beforeunload', () => {
        clearInterval(hourlyRefreshInterval);
    });
}

// ═══════════════════════════════════════
// loadOverview()
// GET /api/admin/overview
// ═══════════════════════════════════════
async function loadOverview() {
    try {
        const data = await HealthBite.apiFetch('/overview');

        // Card 1: Total Revenue
        const revEl = document.getElementById('kpiRevenue');
        revEl.textContent = '₹' + data.revenue.value.toLocaleString('en-IN');
        revEl.classList.remove('shimmer');
        revEl.style.width = 'auto';
        revEl.style.height = 'auto';

        const revBadge = document.getElementById('revenueBadge');
        const isPositive = data.revenue.change.startsWith('+');
        revBadge.className = `inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;
        revBadge.innerHTML = `<span class="material-symbols-outlined text-[14px] mr-1">${isPositive ? 'trending_up' : 'trending_down'}</span>${data.revenue.change}`;

        // Card 2: Today's Orders
        const ordEl = document.getElementById('kpiOrders');
        ordEl.textContent = data.orders.value;
        ordEl.classList.remove('shimmer');
        ordEl.style.width = 'auto'; ordEl.style.height = 'auto';

        const ordPend = document.getElementById('kpiOrdersPending');
        ordPend.textContent = `${data.orders.pending} pending`;
        ordPend.classList.remove('shimmer');
        ordPend.style.width = 'auto'; ordPend.style.height = 'auto';

        // Card 3: Active Users
        const usrEl = document.getElementById('kpiUsers');
        usrEl.textContent = data.users.value.toLocaleString();
        usrEl.classList.remove('shimmer');
        usrEl.style.width = 'auto'; usrEl.style.height = 'auto';

        const usrBadge = document.getElementById('usersBadge');
        usrBadge.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700';
        usrBadge.innerHTML = `<span class="material-symbols-outlined text-[14px] mr-1">trending_up</span>+5%`;

        const usrNew = document.getElementById('kpiUsersNew');
        usrNew.textContent = `+${data.users.newThisMonth} joined this month`;
        usrNew.classList.remove('shimmer');
        usrNew.style.width = 'auto'; usrNew.style.height = 'auto';

        // Card 4: Low Stock Alerts
        const stockEl = document.getElementById('kpiLowStock');
        stockEl.textContent = data.lowStock.value + ' Items';
        stockEl.classList.remove('shimmer');
        stockEl.style.width = 'auto'; stockEl.style.height = 'auto';

        const stockMsg = document.getElementById('kpiLowStockMsg');
        if (data.lowStock.value > 0) {
            stockMsg.textContent = 'Action needed!';
            stockMsg.className = 'text-xs font-bold mt-2 text-accent-orange';
            // Change card border to danger
            document.getElementById('lowStockCard').classList.add('low-stock-urgent');
            // Show ping dot
            document.getElementById('lowStockPing').classList.remove('hidden');
            // Show notification dot on topbar bell
            const bellBadge = document.getElementById('bellBadge');
            if (bellBadge) bellBadge.classList.remove('hidden');
        } else {
            stockMsg.textContent = 'All good';
            stockMsg.className = 'text-xs font-bold mt-2 text-primary-dark';
        }
    } catch (e) {
        console.error('loadOverview failed:', e);
    }
}

// ═══════════════════════════════════════
// loadHourlyChart()
// GET /api/admin/analytics/orders-by-hour-today
// ═══════════════════════════════════════
async function loadHourlyChart() {
    try {
        const data = await HealthBite.apiFetch('/analytics/orders-by-hour-today');

        const ctx = document.getElementById('hourlyChart').getContext('2d');

        // Calculate average
        const avg = Math.round(data.counts.reduce((a, b) => a + b, 0) / data.counts.length);

        // Bar color logic: last bar = current hour → accent, others → 30% opacity
        const bgColors = data.counts.map((_, i) =>
            i === data.counts.length - 1 ? '#11d41b' : 'rgba(17, 212, 27, 0.3)'
        );

        const dataset = {
            label: 'Orders',
            data: data.counts,
            backgroundColor: bgColors,
            borderRadius: 6,
            borderWidth: 0,
            barThickness: 24
        };

        if (hourlyChart) {
            // Silent refresh — update data, do NOT destroy
            hourlyChart.data.labels = data.hours;
            hourlyChart.data.datasets[0].data = data.counts;
            hourlyChart.data.datasets[0].backgroundColor = bgColors;
            hourlyChart.options.plugins.avgLine.value = avg;
            hourlyChart.update();
        } else {
            // First render — create chart with avgLine plugin
            hourlyChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.hours,
                    datasets: [dataset]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        avgLine: { value: avg }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(0,0,0,0.04)' },
                            border: { display: false },
                            ticks: { font: { size: 10 } }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { size: 10 } }
                        }
                    }
                },
                plugins: [{
                    // Average reference line — inline afterDraw hook
                    // Do NOT use any annotation plugin
                    id: 'avgLine',
                    afterDraw(chart) {
                        const avgVal = chart.config.options.plugins.avgLine.value;
                        if (!avgVal) return;
                        const { ctx, chartArea, scales } = chart;
                        const y = scales.y.getPixelForValue(avgVal);
                        ctx.save();
                        ctx.setLineDash([6, 4]);
                        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(chartArea.left, y);
                        ctx.lineTo(chartArea.right, y);
                        ctx.stroke();
                        ctx.fillStyle = 'rgba(0,0,0,0.35)';
                        ctx.font = "bold 10px 'Plus Jakarta Sans'";
                        ctx.fillText('Avg', chartArea.right + 4, y + 4);
                        ctx.restore();
                    }
                }]
            });
        }

        // Quick-stats calculated from API data
        const maxCount = Math.max(...data.counts);
        const peakIdx = data.counts.indexOf(maxCount);

        const nonZeroCounts = data.counts.filter(c => c > 0);
        const minNonZero = Math.min(...nonZeroCounts);
        const quietIdx = data.counts.indexOf(minNonZero);

        document.getElementById('peakStat').textContent = `🔥 Peak so far: ${data.hours[peakIdx]} (${maxCount} orders)`;
        document.getElementById('quietStat').textContent = `📦 Quiet period: ${data.hours[quietIdx]} (${minNonZero} orders)`;

    } catch (e) {
        console.error('loadHourlyChart failed:', e);
    }
}

// ═══════════════════════════════════════
// loadSalesChart(period)
// GET /api/admin/analytics/sales?period={period}
// ═══════════════════════════════════════
async function loadSalesChart(period) {
    try {
        // Destroy existing salesChart instance if exists
        if (salesChart) {
            salesChart.destroy();
            salesChart = null;
        }

        const data = await HealthBite.apiFetch(`/analytics/sales?period=${period}`);

        const ctx = document.getElementById('salesChart').getContext('2d');

        // Gradient for revenue bars
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, '#11d41b');
        gradient.addColorStop(1, 'rgba(17, 212, 27, 0.15)');

        salesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        // Dataset 1: Revenue per day — Bar type
                        type: 'bar',
                        label: 'Revenue (₹)',
                        data: data.revenue,
                        backgroundColor: gradient,
                        borderRadius: 8,
                        barThickness: 32,
                        yAxisID: 'y',
                        hoverBackgroundColor: '#0e9f15'
                    },
                    {
                        // Dataset 2: Orders per day — Line type, dashed, no fill
                        type: 'line',
                        label: 'Orders',
                        data: data.orders,
                        borderColor: '#7c3aed',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 3,
                        pointBackgroundColor: '#7c3aed',
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    y: {
                        // Left Y-axis: Revenue (₹)
                        type: 'linear',
                        position: 'left',
                        grid: { color: 'rgba(0,0,0,0.04)' },
                        border: { display: false },
                        ticks: {
                            font: { size: 10 },
                            callback: val => '₹' + (val / 1000) + 'k'
                        }
                    },
                    y1: {
                        // Right Y-axis: Orders count
                        type: 'linear',
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        border: { display: false },
                        ticks: { font: { size: 10 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 10 } }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 6,
                            font: { size: 11, weight: '600' }
                        }
                    },
                    tooltip: {
                        // Shows both Revenue + Orders values on hover
                        callbacks: {
                            label: function (ctx) {
                                if (ctx.dataset.label.includes('Revenue')) {
                                    return ' Revenue: ₹' + ctx.parsed.y.toLocaleString();
                                }
                                return ' Orders: ' + ctx.parsed.y;
                            }
                        }
                    }
                }
            }
        });
    } catch (e) {
        console.error('loadSalesChart failed:', e);
    }
}

// ═══════════════════════════════════════
// switchSalesPeriod(btn, period)
// ═══════════════════════════════════════
function switchSalesPeriod(btn, period) {
    // Remove 'active' class from all period pills
    document.querySelectorAll('.period-pill').forEach(b => b.classList.remove('active'));
    // Add 'active' class to clicked pill
    btn.classList.add('active');
    // Store current period
    currentPeriod = period;
    // Re-fetch only this chart
    loadSalesChart(period);
}

// ═══════════════════════════════════════
// loadTopItems()
// GET /api/admin/analytics/top-items
// ═══════════════════════════════════════
async function loadTopItems() {
    try {
        // Show shimmer skeleton rows first
        const tbody = document.getElementById('topItemsBody');
        tbody.innerHTML = Array(5).fill(0).map(() => `
            <tr class="h-12">
                <td class="px-2 py-2"><div class="shimmer w-6 h-6 rounded-full"></div></td>
                <td class="px-2 py-2"><div class="shimmer h-4 w-28 rounded"></div></td>
                <td class="px-2 py-2"><div class="shimmer h-5 w-16 rounded-full"></div></td>
                <td class="px-2 py-2"><div class="shimmer h-4 w-10 rounded"></div></td>
                <td class="px-2 py-2"><div class="shimmer h-4 w-16 rounded"></div></td>
                <td class="px-2 py-2"><div class="shimmer h-3 w-24 rounded"></div></td>
            </tr>
        `).join('');

        const data = await HealthBite.apiFetch('/analytics/top-items');

        // Render 5 table rows
        tbody.innerHTML = data.items.map(item => {
            let rankClass = 'rank-default';
            if (item.rank === 1) rankClass = 'rank-gold';
            if (item.rank === 2) rankClass = 'rank-silver';
            if (item.rank === 3) rankClass = 'rank-bronze';

            return `
                <tr class="hover:bg-white/50 transition-colors border-b border-black/5">
                    <td class="py-3.5 px-2">
                        <span class="inline-flex w-7 h-7 rounded-full items-center justify-center text-[10px] font-black ${rankClass}">${item.rank}</span>
                    </td>
                    <td class="py-3.5 px-2 font-bold text-sm text-text-main">${item.name}</td>
                    <td class="py-3.5 px-2">
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white border border-black/10 text-text-muted">${item.category}</span>
                    </td>
                    <td class="py-3.5 px-2 text-right text-sm font-medium">${item.sold}</td>
                    <td class="py-3.5 px-2 text-right text-sm font-bold text-forest">₹${item.revenue.toLocaleString()}</td>
                    <td class="py-3.5 px-2">
                        <div class="flex items-center gap-2">
                            <div class="flex-1 h-1.5 bg-black/5 rounded-full overflow-hidden">
                                <div class="h-full bg-primary rounded-full" style="width: ${item.share}%"></div>
                            </div>
                            <span class="text-[10px] font-bold text-text-muted w-8 text-right">${item.share}%</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error('loadTopItems failed:', e);
    }
}

// ═══════════════════════════════════════
// loadAlerts()
// GET /api/admin/alerts
// ═══════════════════════════════════════
async function loadAlerts() {
    try {
        const data = await HealthBite.apiFetch('/alerts');

        const container = document.getElementById('alertsContainer');

        if (data.alerts.length === 0) {
            // Show centered "No alerts right now ✓"
            container.innerHTML = `
                <div class="flex-1 flex flex-col items-center justify-center text-text-muted">
                    <span class="material-symbols-outlined text-[48px] opacity-30">verified</span>
                    <p class="text-sm font-bold mt-2 opacity-60">No alerts right now ✓</p>
                </div>`;
        } else {
            container.innerHTML = data.alerts.map(alert => {
                // Colored dot per type with glow
                let dotClass = 'bg-primary shadow-[0_0_6px_rgba(17,212,27,0.5)]';  // info = accent
                if (alert.type === 'error') dotClass = 'bg-danger-red shadow-[0_0_6px_rgba(229,57,53,0.5)]';
                if (alert.type === 'warn') dotClass = 'bg-accent-orange shadow-[0_0_6px_rgba(251,140,0,0.5)]';

                return `
                    <div class="flex gap-3.5 p-3 rounded-lg hover:bg-white/50 transition-all border border-transparent hover:border-black/5">
                        <div class="mt-1.5 w-2 h-2 rounded-full ${dotClass} shrink-0"></div>
                        <div>
                            <p class="text-sm font-medium text-text-main leading-snug">${alert.message}</p>
                            <p class="text-[10px] text-text-muted mt-1 font-bold">${alert.time}</p>
                        </div>
                    </div>`;
            }).join('');
        }
    } catch (e) {
        console.error('loadAlerts failed:', e);
    }
}

// ═══════════════════════════════════════
// startHourlyAutoRefresh()
// Silently refresh hourly chart every 5 minutes
// ═══════════════════════════════════════
function startHourlyAutoRefresh() {
    hourlyRefreshInterval = setInterval(() => {
        // No skeleton flash on refresh — silent update
        loadHourlyChart();
    }, 5 * 60 * 1000);
}
