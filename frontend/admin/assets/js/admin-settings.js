/**
 * HealthBite Admin — Settings & Theme Management
 */

document.addEventListener('DOMContentLoaded', () => {
    initSettings();
});

function initSettings() {
    loadSavedSettings();

    // Dark Mode Toggle
    const dmToggle = document.getElementById('darkModeToggle');
    if (dmToggle) {
        dmToggle.addEventListener('change', (e) => {
            const label = e.target.nextElementSibling;
            if (e.target.checked) {
                label.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#11d41b';
                document.documentElement.classList.add('dark');
            } else {
                label.style.backgroundColor = '#cbd5e1';
                document.documentElement.classList.remove('dark');
            }
        });
    }

    // Color Picker
    const colorRadios = document.querySelectorAll('.color-radio');
    colorRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                applyThemeColor(e.target);
            }
        });
    });

    // Other toggles
    ['compactModeToggle', 'animationToggle'].forEach(id => {
        const toggle = document.getElementById(id);
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                const label = e.target.nextElementSibling;
                if (e.target.checked) label.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#11d41b';
                else label.style.backgroundColor = '#cbd5e1';

                if (id === 'compactModeToggle') document.body.classList.toggle('compact-table', e.target.checked);
                if (id === 'animationToggle') document.body.classList.toggle('no-animations', !e.target.checked);
            });
        }
    });
}

function applyThemeColor(radioEl) {
    const root = document.documentElement;
    const primary = radioEl.getAttribute('data-primary');
    const dark = radioEl.getAttribute('data-dark');
    const forest = radioEl.getAttribute('data-forest');
    const blob = radioEl.getAttribute('data-blob');

    root.style.setProperty('--color-primary', primary);
    root.style.setProperty('--color-primary-dark', dark);
    root.style.setProperty('--color-forest', forest);

    // Update active toggles
    document.querySelectorAll('.toggle-checkbox:checked + .toggle-label').forEach(lbl => {
        lbl.style.backgroundColor = primary;
    });

    // Update background blob
    const blobs = document.querySelectorAll('.bg-blob-1');
    blobs.forEach(b => b.style.background = blob);
}

function saveSettings() {
    const btn = document.getElementById('saveBtn');
    const icon = document.getElementById('saveIcon');
    const text = document.getElementById('saveText');

    if (!btn) return;

    btn.disabled = true;
    icon.textContent = 'progress_activity';
    icon.classList.add('animate-spin');
    text.textContent = 'Saving...';

    // Gather settings
    const settings = {
        darkMode: document.getElementById('darkModeToggle')?.checked || false,
        themeColor: document.querySelector('.color-radio:checked')?.value || 'green',
        compactMode: document.getElementById('compactModeToggle')?.checked || false,
        animations: document.getElementById('animationToggle')?.checked ?? true
    };

    // Simulate API Call
    setTimeout(() => {
        localStorage.setItem('healthbite_admin_settings', JSON.stringify(settings));

        icon.classList.remove('animate-spin');
        icon.textContent = 'check';
        text.textContent = 'Saved!';

        if (window.HealthBite) HealthBite.showToast('Settings saved successfully', 'success');

        setTimeout(() => {
            btn.disabled = false;
            icon.textContent = 'save';
            text.textContent = 'Save Changes';
        }, 2000);

    }, 800);
}

function loadSavedSettings() {
    try {
        const stored = localStorage.getItem('healthbite_admin_settings');
        if (!stored) return;

        const settings = JSON.parse(stored);

        // Dark Mode
        if (settings.darkMode) {
            const dm = document.getElementById('darkModeToggle');
            if (dm) { dm.checked = true; dm.dispatchEvent(new Event('change')); }
        }

        // Theme Color
        if (settings.themeColor) {
            const radio = document.querySelector(`.color-radio[value="${settings.themeColor}"]`);
            if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
        }

        // Toggles
        if (settings.compactMode) {
            const cm = document.getElementById('compactModeToggle');
            if (cm) { cm.checked = true; cm.dispatchEvent(new Event('change')); }
        }

        if (settings.animations === false) {
            const am = document.getElementById('animationToggle');
            if (am) { am.checked = false; am.dispatchEvent(new Event('change')); }
        }

    } catch (e) { console.error('Failed to load settings', e); }
}

function resetSettings() {
    if (confirm('Reset all settings to default?')) {
        localStorage.removeItem('healthbite_admin_settings');
        // Reset inputs
        const dm = document.getElementById('darkModeToggle'); if (dm) { dm.checked = false; dm.dispatchEvent(new Event('change')); }
        const r = document.querySelector(`.color-radio[value="green"]`); if (r) { r.checked = true; r.dispatchEvent(new Event('change')); }
        const cm = document.getElementById('compactModeToggle'); if (cm) { cm.checked = false; cm.dispatchEvent(new Event('change')); }
        const am = document.getElementById('animationToggle'); if (am) { am.checked = true; am.dispatchEvent(new Event('change')); }

        if (window.HealthBite) HealthBite.showToast('Settings reset to defaults', 'success');

        // Refresh page to apply defaults globally
        setTimeout(() => location.reload(), 500);
    }
}

// Tab Switching Logic
function switchSettingsTab(tabId) {
    // 1. Hide all tabs
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.add('hidden', 'opacity-0');
        tab.classList.remove('block', 'opacity-100');
    });

    // 2. Show selected tab
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) {
        targetTab.classList.remove('hidden');
        // slight delay to allow display block to apply before animating opacity
        setTimeout(() => {
            targetTab.classList.remove('opacity-0');
            targetTab.classList.add('opacity-100');
            targetTab.classList.add('block');
        }, 10);
    }

    // 3. Reset all buttons visually
    const classInactive = ['text-text-muted', 'hover:bg-white/50', 'hover:text-forest', 'font-medium'];
    const classActive = ['bg-white', 'shadow-sm', 'shadow-primary/10', 'text-forest', 'font-bold', 'border', 'border-white/50'];

    document.querySelectorAll('[id^="tab-btn-"]').forEach(btn => {
        btn.classList.remove(...classActive);
        btn.classList.add(...classInactive);
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.classList.remove('filled');
    });

    // 4. Activate selected button
    const activeBtn = document.getElementById(`tab-btn-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.remove(...classInactive);
        activeBtn.classList.add(...classActive);
        const icon = activeBtn.querySelector('.material-symbols-outlined');
        if (icon) icon.classList.add('filled');
    }
}
