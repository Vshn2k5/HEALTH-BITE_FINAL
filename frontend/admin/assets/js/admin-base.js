/**
 * HealthBite Admin Base Utilities
 */

window.HealthBite = {
    // Global Theme Loader
    applyGlobalTheme: function () {
        try {
            const stored = localStorage.getItem('healthbite_admin_settings');
            if (!stored) return;
            const settings = JSON.parse(stored);

            const root = document.documentElement;

            // Apply Dark Mode
            if (settings.darkMode) root.classList.add('dark');
            else root.classList.remove('dark');

            // Apply Colors
            if (settings.themeColor) {
                const maps = {
                    green: { p: '#11d41b', d: '#0e9f15', f: '#2E7D32', b: 'rgba(17,212,27,0.06)' },
                    blue: { p: '#3b82f6', d: '#2563eb', f: '#1e40af', b: 'rgba(59,130,246,0.06)' },
                    orange: { p: '#f97316', d: '#ea580c', f: '#9a3412', b: 'rgba(249,115,22,0.06)' },
                    purple: { p: '#a855f7', d: '#9333ea', f: '#581c87', b: 'rgba(168,85,247,0.06)' },
                    rose: { p: '#f43f5e', d: '#e11d48', f: '#9f1239', b: 'rgba(244,63,94,0.06)' }
                };
                const c = maps[settings.themeColor] || maps.green;
                root.style.setProperty('--color-primary', c.p);
                root.style.setProperty('--color-primary-dark', c.d);
                root.style.setProperty('--color-forest', c.f);

                // Set the blob if it exists on the page
                const blobs = document.querySelectorAll('.bg-blob-1');
                blobs.forEach(blob => blob.style.background = c.b);

                // Inject a dynamic style block to ensure blobs loaded *after* this script still get colored
                let styleEl = document.getElementById('dynamic-theme-style');
                if (!styleEl) {
                    styleEl = document.createElement('style');
                    styleEl.id = 'dynamic-theme-style';
                    document.head.appendChild(styleEl);
                }
                styleEl.textContent = `
                    .bg-blob-1 { background: ${c.b} !important; }
                    html.dark .bg-blob-1 { background: ${c.b.replace('0.06', '0.03')} !important; }
                `;
            }

            // Apply Preferences
            if (settings.compactMode) document.body.classList.add('compact-table');
            if (settings.animations === false) document.body.classList.add('no-animations');

        } catch (e) {
            console.error('Failed to apply global theme:', e);
        }
    },

    // Auth Guard
    authGuard: function () {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        if (!token || role !== 'ADMIN') {
            window.location.href = '../../index.html';
        }
    },

    // Unified API Fetcher
    apiFetch: async function (endpoint, options = {}) {
        const token = localStorage.getItem('token');
        const API_HOSTNAME = window.location.hostname || '127.0.0.1';
        const BASE_URL = `http://${API_HOSTNAME}:8000/api/admin`;

        const defaultHeaders = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        };

        try {
            const response = await fetch(`${BASE_URL}${endpoint}`, config);
            let data = {};

            if (response.status !== 204) {
                const text = await response.text();
                if (text) {
                    try {
                        data = JSON.parse(text);
                    } catch (err) {
                        data = { error: 'Invalid JSON response', raw: text };
                    }
                }
            }

            if (!response.ok) {
                console.error("API Error details:", data);
                let errMsg = data.error || data.message || `Request failed with status ${response.status}`;
                if (data.errors && Array.isArray(data.errors)) {
                    errMsg += ': ' + data.errors.map(e => `${e.field} - ${e.message}`).join(', ');
                } else if (data.errors && typeof data.errors === 'object') {
                    errMsg += ': ' + JSON.stringify(data.errors);
                }

                this.showToast(errMsg, 'error');
                throw new Error(errMsg);
            }
            return data;
        } catch (error) {
            console.error("Fetch caught error:", error);
            this.showToast(error.message, 'error');
            throw error;
        }
    },

    // Toast System
    showToast: function (message, type = 'success', duration = 3500) {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl glass-panel border border-white/60 pointer-events-auto transform transition-all duration-300 translate-y-20 opacity-0';

        // Icon and Colors
        let icon = 'info';
        let iconColor = 'text-forest';
        if (type === 'success') { icon = 'check_circle'; iconColor = 'text-primary-dark'; }
        if (type === 'error') { icon = 'error'; iconColor = 'text-danger-red'; }
        if (type === 'warn') { icon = 'warning'; iconColor = 'text-accent-orange'; }

        toast.innerHTML = `
            <span class="material-symbols-outlined ${iconColor}">${icon}</span>
            <span class="text-sm font-bold text-text-main">${message}</span>
        `;

        container.appendChild(toast);

        // Animate In
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-20', 'opacity-0');
        });

        // Auto-Remove
        setTimeout(() => {
            toast.classList.add('translate-y-4', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // Clock System
    startClock: function (elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const update = () => {
            const now = new Date();
            el.textContent = now.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        };

        update();
        setInterval(update, 1000);
    },

    // Identity Loader
    loadAdminIdentity: function () {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const name = localStorage.getItem('username') || 'Admin';
                const role = localStorage.getItem('role') || 'ADMIN';

                const nameEls = document.querySelectorAll('.admin-name');
                const roleEls = document.querySelectorAll('.admin-role');
                const initialEls = document.querySelectorAll('.admin-initial');

                nameEls.forEach(el => el.textContent = name);
                roleEls.forEach(el => el.textContent = role);
                initialEls.forEach(el => el.textContent = name.charAt(0).toUpperCase());
            }
        } catch (e) {
            console.error('Identity load failed', e);
        }
    }
};

// Auto-apply theme as soon as this script loads to prevent FOUC
if (typeof document !== 'undefined') {
    HealthBite.applyGlobalTheme();
}
