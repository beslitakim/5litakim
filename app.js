const API_URL = "/api"; 
let roomsInterval = null;

function getToken() { return localStorage.getItem('valotakim_token'); }

function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const target = document.getElementById('page-' + pageId);
    if (target) { target.classList.add('active'); window.scrollTo(0, 0); }
    if (pageId === 'create-room') initAgentPicker();
    if (pageId === 'profile') loadProfileData();
    if (pageId === 'rooms') { loadRooms(); if(!roomsInterval) roomsInterval = setInterval(loadRooms, 3000); } 
    else { if(roomsInterval) { clearInterval(roomsInterval); roomsInterval = null; } }
}

async function socialLogin(provider) {
    try {
        const res = await fetch(`${API_URL}/social-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider })
        });
        
        if (!res.ok) throw new Error("Sunucu bağlantısı kurulamadı.");
        
        const result = await res.json();
        if (result.success) {
            localStorage.setItem('valotakim_token', result.token);
            localStorage.setItem('valotakim_logged', result.user.username);
            checkAuthState();
            switchPage('home');
            alert(`${provider} ile başarıyla giriş yapıldı!`);
        }
    } catch (err) { alert(`Bağlantı Hatası. Sayfayı yenileyin.`); }
}

function logout() {
    localStorage.removeItem('valotakim_token');
    localStorage.removeItem('valotakim_logged');
    checkAuthState();
    switchPage('home');
}

function checkAuthState() {
    const loggedUser = localStorage.getItem('valotakim_logged');
    if (loggedUser) {
        document.getElementById('auth-buttons').style.display = 'none';
        document.getElementById('user-menu').style.display = 'flex';
        document.getElementById('topbar-username').textContent = loggedUser;
    } else {
        document.getElementById('auth-buttons').style.display = 'flex';
        document.getElementById('user-menu').style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => { checkAuthState(); });