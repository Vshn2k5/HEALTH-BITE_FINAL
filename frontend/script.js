const API_HOSTNAME = window.location.hostname || "127.0.0.1";
const BASE_URL = `http://${API_HOSTNAME}:8000/api/auth`;
const API_ROOT = `http://${API_HOSTNAME}:8000/api`;

// ===== SESSION MANAGEMENT =====
function checkSession() {
    const token = localStorage.getItem("token");
    const email = localStorage.getItem("email");
    const role = localStorage.getItem("role");
    return (token && email && role) ? { token, email, role } : null;
}

function initializeUserSession() {
    const session = checkSession();
    if (!session) {
        window.location.href = "index.html";
        return null;
    }
    const userDisplay = document.getElementById("user-display");
    if (userDisplay) userDisplay.textContent = session.email;
    return session;
}

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

async function checkProfileCompletion() {
    const token = localStorage.getItem("token");
    if (!token) return false;

    try {
        const response = await fetch(`${API_ROOT}/health/check`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await response.json();
        return data.has_profile;
    } catch (error) {
        console.error("Profile check failed:", error);
        return false;
    }
}


// ===== AUTHENTICATION FLOW =====

function login() {
    const emailElement = document.getElementById("login-email");
    const passwordElement = document.getElementById("login-password");
    const errorContainer = document.getElementById("form-error-login");

    if (!emailElement || !passwordElement) return;

    const email = emailElement.value.trim();
    const password = passwordElement.value.trim();
    const role = typeof currentRole !== 'undefined' ? currentRole : 'USER';

    // Clear previous errors
    if (errorContainer) {
        errorContainer.textContent = "";
        errorContainer.style.display = "none";
    }

    if (!email || !password) {
        showError(errorContainer, "Please fill in all fields.");
        return;
    }

    fetch(`${BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role })
    })
        .then(async res => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.detail || data.message || "Login failed");
            return data;
        })
        .then(data => {
            localStorage.setItem("token", data.token);
            localStorage.setItem("email", data.email);
            localStorage.setItem("username", data.name || "User");
            localStorage.setItem("hb_user_name", data.name || "User");
            localStorage.setItem("role", data.role);

            if (data.role === "ADMIN") {
                window.location.href = "admin.html";
            } else {
                if (data.profile_completed) {
                    window.location.href = 'user.html'; // Or health-report if that's preferred
                } else {
                    window.location.href = 'health.html';
                }
            }
        })
        .catch(error => {
            showError(errorContainer, error.message);
        });
}

function register() {
    const nameElement = document.getElementById("reg-name");
    const emailElement = document.getElementById("reg-email");
    const passwordElement = document.getElementById("reg-password");
    const ageElement = document.getElementById("reg-age");
    const genderElement = document.getElementById("reg-gender");
    const errorContainer = document.getElementById("form-error-register");

    if (!nameElement || !emailElement || !passwordElement) return;

    const name = nameElement.value.trim();
    const email = emailElement.value.trim();
    const password = passwordElement.value.trim();
    const role = typeof currentRole !== 'undefined' ? currentRole : 'USER';

    if (errorContainer) {
        errorContainer.textContent = "";
        errorContainer.style.display = "none";
    }

    if (!name || !email || !password) {
        showError(errorContainer, "Please fill in all fields.");
        return;
    }

    fetch(`${BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role })
    })
        .then(async res => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.detail || data.message || "Registration failed");
            return data;
        })
        .then(data => {
            localStorage.setItem("token", data.token);
            localStorage.setItem("email", data.email);
            localStorage.setItem("username", data.name || "User");
            localStorage.setItem("hb_user_name", data.name || "User");
            localStorage.setItem("role", data.role);

            // Redirect based on role
            if (data.role === "ADMIN") {
                window.location.href = "admin.html";
            } else {
                window.location.href = "health.html";
            }
        })
        .catch(error => {
            showError(errorContainer, error.message);
        });
}

function showError(container, message) {
    let friendlyMessage = message;

    // Provide a more helpful message for network errors
    if (message === "Failed to fetch" || message.includes("NetworkError")) {
        friendlyMessage = "Cannot connect to the backend server. Please ensure the backend is running on port 8000.";
    }

    if (container) {
        container.textContent = friendlyMessage;
        container.style.display = "block";
        // Auto-scroll to error
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        alert(friendlyMessage);
    }
}

// ===== LOGOUT BUTTON HANDLER =====
document.addEventListener('DOMContentLoaded', function () {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            logout();
        });
    }
});
