// Component Fetcher
window.AdminLayout = {
    loadComponents: async function () {
        try {
            // Ensure Base JS is loaded if not already
            if (!window.HealthBite) {
                const baseScript = document.createElement('script');
                baseScript.src = '../assets/js/admin-base.js';
                document.head.appendChild(baseScript);
                await new Promise(r => baseScript.onload = r);
            }

            // Load Sidebar
            const sidebarHtml = await fetch('../components/sidebar.html').then(res => res.text());
            const sidebarContainer = document.getElementById('sidebar-container');
            if (sidebarContainer) {
                sidebarContainer.innerHTML = sidebarHtml;
            }

            // Load Topbar
            const topbarHtml = await fetch('../components/topbar.html').then(res => res.text());
            const topbarContainer = document.getElementById('topbar-container');
            if (topbarContainer) {
                topbarContainer.innerHTML = topbarHtml;
            }

            // Initialize Systems
            HealthBite.applyGlobalTheme();
            HealthBite.authGuard();
            HealthBite.startClock('liveClock');
            HealthBite.loadAdminIdentity();
            this.highlightActiveNav();

        } catch (error) {
            console.error('Failed to load components:', error);
        }
    },

    highlightActiveNav: function () {
        const path = window.location.pathname;
        const page = path.split("/").pop();
        const navMap = {
            'admin-dashboard.html': { id: 'nav-dashboard', title: 'Dashboard' },
            'dashboard.html': { id: 'nav-dashboard', title: 'Dashboard' },
            'admin-food.html': { id: 'nav-food', title: 'Food Management' },
            'admin-inventory.html': { id: 'nav-inventory', title: 'Inventory Control' },
            'admin-orders.html': { id: 'nav-orders', title: 'Order Management' },
            'admin-users.html': { id: 'nav-users', title: 'User Administration' },
            'admin-analytics.html': { id: 'nav-analytics', title: 'Analytics' },
            'admin-ml-monitor.html': { id: 'nav-ml-monitor', title: 'AI Monitoring' },
            'admin-reports.html': { id: 'nav-reports', title: 'Reports & Export' },
            'admin-audit.html': { id: 'nav-audit', title: 'Audit Logs' },
            'admin-settings.html': { id: 'nav-settings', title: 'Settings' }
        };

        const activeObj = navMap[page] || { id: 'nav-dashboard', title: 'Dashboard' };

        // Highlight active sidebar item
        const el = document.getElementById(activeObj.id);
        if (el) {
            el.classList.remove('text-text-muted', 'hover:bg-white/50', 'hover:text-forest');
            el.classList.add('bg-white', 'shadow-sm', 'shadow-primary/10', 'text-forest', 'font-semibold', 'border', 'white/50');
            const icon = el.querySelector('.material-symbols-outlined');
            if (icon) icon.classList.add('filled');
        }

        // Set topbar title dynamically
        const titleEl = document.getElementById('topbarTitle');
        if (titleEl) {
            titleEl.textContent = activeObj.title;
        }
    }
};

window.handleLogout = function () {
    if (confirm('Sign out of Admin Panel?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('role');
        window.location.href = '../../index.html';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.AdminLayout.loadComponents();
});
