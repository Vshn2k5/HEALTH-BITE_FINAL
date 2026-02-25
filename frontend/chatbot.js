/* Floating Chatbot Widget Logic */
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    // User must be logged in
    if (!token) return;

    // For non-admins, ensure they have a health profile created before showing chatbot
    if (role !== 'ADMIN') {
        try {
            const apiHost = window.location.hostname || "127.0.0.1";
            const res = await fetch(`http://${apiHost}:8000/api/health/check`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const info = await res.json();
            if (!info || !info.has_profile) return;
        } catch (e) {
            return; // Don't show if check fails
        }
    }

    // Create Widget HTML
    const widget = document.createElement('div');
    widget.id = 'health-chatbot-widget';
    widget.innerHTML = `
        <button class="chatbot-fab" id="chatbot-fab" title="AI Health Assistant">
            <i class="fas fa-robot"></i>
        </button>
        <div class="chatbot-window" id="chatbot-window">
            <header class="chatbot-header">
                <div class="bot-info">
                    <div class="bot-avatar">🤖</div>
                    <div class="bot-status">
                        <h3>Health AI</h3>
                        <span>Online</span>
                    </div>
                </div>
                <button id="close-chatbot" style="background:none; border:none; color:white; cursor:pointer;"><i class="fas fa-times"></i></button>
            </header>
            <div class="chatbot-messages" id="widget-messages">
                <div class="msg msg-bot">Hi! I'm your AI Health Assistant. Ask me anything about today's menu!</div>
            </div>
            <div class="chatbot-input-area">
                <input type="text" id="widget-input" class="chatbot-input" placeholder="Type a message..." onkeypress="if(event.key==='Enter') sendWidgetMessage()">
                <button class="send-btn" onclick="sendWidgetMessage()"><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>
    `;
    document.body.appendChild(widget);

    const fab = document.getElementById('chatbot-fab');
    const windowEl = document.getElementById('chatbot-window');
    const closeBtn = document.getElementById('close-chatbot');

    fab.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            window.location.href = 'health-assistant.html';
        } else {
            windowEl.classList.toggle('active');
        }
    });

    closeBtn.addEventListener('click', () => {
        windowEl.classList.remove('active');
    });
});

function sendWidgetMessage() {
    const input = document.getElementById('widget-input');
    const messages = document.getElementById('widget-messages');
    const text = input.value.trim();
    if (!text) return;

    // User message
    const userMsg = document.createElement('div');
    userMsg.className = 'msg msg-user';
    userMsg.textContent = text;
    messages.appendChild(userMsg);
    input.value = '';
    messages.scrollTop = messages.scrollHeight;

    const token = localStorage.getItem('token');

    // API Call
    const apiHost = window.location.hostname || "127.0.0.1";
    fetch(`http://${apiHost}:8000/api/chatbot/query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: text })
    })
        .then(res => res.json())
        .then(data => {
            const botMsg = document.createElement('div');
            botMsg.className = 'msg msg-bot';

            let content = `<p>${data.text || "I'm having a bit of trouble. Could you ask that again?"}</p>`;

            if (data.explanation_card) {
                content += `
                <div class="explain-card">
                    <div class="explain-header">${data.explanation_card.title}</div>
                    <div class="explain-body">
                        ${data.explanation_card.chips.map(chip => `
                            <div class="insight-item">
                                <div class="insight-icon" style="background:${chip.color === 'green' ? '#d1fae5' : (chip.color === 'orange' ? '#ffedd5' : '#fee2e2')}; color:${chip.color === 'green' ? '#059669' : (chip.color === 'orange' ? '#d97706' : '#dc2626')}">
                                    <i class="fas fa-${chip.icon}"></i>
                                </div>
                                <div class="insight-text">
                                    <h4>${chip.label}</h4>
                                    <p>${chip.value}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            }

            if (data.chips && data.chips.length > 0) {
                content += `<div style="display:flex; flex-wrap:wrap; gap:5px; margin-top:10px;">
                    ${data.chips.map(chip => `<span class="tag-pill" style="cursor:pointer; background:#eef2ff; color:#6366f1;" onclick="document.getElementById('widget-input').value='${chip}'; sendWidgetMessage();">${chip}</span>`).join('')}
                </div>`;
            }

            botMsg.innerHTML = content;
            messages.appendChild(botMsg);
            messages.scrollTop = messages.scrollHeight;
        })
        .catch(err => {
            const errorMsg = document.createElement('div');
            errorMsg.className = 'msg msg-bot';
            errorMsg.textContent = "Server busy. Try again later.";
            messages.appendChild(errorMsg);
        });
}

window.toggleChatbot = function () {
    const windowEl = document.getElementById('chatbot-window');
    if (windowEl) windowEl.classList.toggle('active');
};
