// Render için en güvenli ve kesin API yolu
const API_URL = "/api"; 

let roomsInterval = null;

function getToken() {
    return localStorage.getItem('valotakim_token');
}

function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const target = document.getElementById('page-' + pageId);
    if (target) {
        target.classList.add('active');
        window.scrollTo(0, 0);
    }
    if (pageId === 'create-room') {
        initAgentPicker();
    }
    if (pageId === 'profile') {
        loadProfileData();
    }
    if (pageId === 'rooms') {
        loadRooms();
        if(!roomsInterval) roomsInterval = setInterval(loadRooms, 3000);
    } else {
        if(roomsInterval) { clearInterval(roomsInterval); roomsInterval = null; }
    }
    if (pageId === 'matchmaking') {
        loadMatchmaking();
    }
}

// Riot veya Google ile Sosyal Giriş
async function socialLogin(provider) {
    try {
        const res = await fetch(`${API_URL}/social-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider })
        });
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Sunucu Yanıtı: ${res.status} -${errText}`);
        }

        const result = await res.json();
        if (result.success) {
            localStorage.setItem('valotakim_token', result.token);
            localStorage.setItem('valotakim_logged', result.user.username);
            checkAuthState();
            switchPage('home');
            alert(`${provider} ile başarıyla giriş yapıldı!`);
        } else {
            alert('Giriş başarısız!');
        }
    } catch (err) {
        console.error("Giriş Detayı:", err);
        alert(`Bağlantı hatası! Tarayıcı önbelleğini temizleyin.\nDetay: ${err.message}`);
    }
}

function logout() {
    localStorage.removeItem('valotakim_token');
    localStorage.removeItem('valotakim_logged');
    checkAuthState();
    switchPage('home');
}

function checkAuthState() {
    const loggedUser = localStorage.getItem('valotakim_logged');
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    const usernameSpan = document.getElementById('topbar-username');

    if (loggedUser) {
        if (authButtons) authButtons.style.display = 'none';
        if (userMenu) userMenu.style.display = 'flex';
        if (usernameSpan) usernameSpan.textContent = loggedUser;
    } else {
        if (authButtons) authButtons.style.display = 'flex';
        if (userMenu) userMenu.style.display = 'none';
    }
}

function checkAuthAndOpenCreateRoom() {
    if (!getToken()) {
        alert('İlan oluşturmak için Riot veya Google ile giriş yapmalısınız!');
        return;
    }
    switchPage('create-room');
}

async function loadProfileData() {
    const token = getToken();
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
        const result = await res.json();
        if (result.success) {
            document.getElementById('prof-username').value = result.user.username;
            document.getElementById('prof-valorant').value = result.user.valorant_id || '';
            document.getElementById('prof-rank').value = result.user.rank || 'Gümüş 1';
            document.getElementById('prof-role').value = result.user.role || 'Flex';
        }
    } catch(err) {
        console.error(err);
    }
}

async function updateProfile(event) {
    event.preventDefault();
    const token = getToken();
    const data = {
        valorant_id: document.getElementById('prof-valorant').value,
        rank: document.getElementById('prof-rank').value,
        role: document.getElementById('prof-role').value
    };
    try {
        await fetch(`${API_URL}/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        alert('Profil güncellendi!');
        switchPage('home');
    } catch(err) {
        alert("Güncelleme hatası!");
    }
}

const agentNames = [
    "ASTRA", "BREACH", "BRIMSTONE", "CHAMBER", "KILLJOY", 
    "OMEN", "CYPHER", "GEKKO", "JETT", "KAYO", 
    "DEADLOCK", "NEON", "PHOENIX", "RAZE", "REYNA", 
    "SAGE", "SKYE", "SOVA", "VIPER", "YORU", 
    "ISO", "CLOVE", "VYSE", "TEJO", "VETO", "AJAN 26"
];

let selectedAgents = [];
function initAgentPicker() {
    const container = document.getElementById('agent-picker-container');
    if (!container) return;
    selectedAgents = [];
    document.getElementById('selected-agents-input').value = '';
    
    let html = `<div class="agent-pick-box farketmez-box" id="agent-box-farketmez" onclick="toggleFarketmez()"><span class="farketmez-text">FARKETMEZ</span></div>`;
    for(let i=1; i<=26; i++) {
        let name = agentNames[i-1] || `AJAN ${i}`;
        html += `<div class="agent-pick-box" id="agent-box-${i}" onclick="toggleAgent(${i})"><img src="images/agent${i}.png"><span class="agent-name-label">${name}</span></div>`;
    }
    container.innerHTML = html;
}

function toggleFarketmez() {
    selectedAgents = selectedAgents.includes('farketmez') ? [] : ['farketmez'];
    updateAgentPickerUI();
}

function toggleAgent(id) {
    if(selectedAgents.includes('farketmez')) selectedAgents = [];
    const index = selectedAgents.indexOf(id);
    if(index > -1) selectedAgents.splice(index, 1);
    else {
        if(selectedAgents.length >= 3) { alert('En fazla 3 ajan seçebilirsiniz!'); return; }
        selectedAgents.push(id);
    }
    updateAgentPickerUI();
}

function updateAgentPickerUI() {
    document.getElementById('agent-box-farketmez')?.classList.toggle('selected', selectedAgents.includes('farketmez'));
    for(let i=1; i<=26; i++) {
        document.getElementById(`agent-box-${i}`)?.classList.toggle('selected', selectedAgents.includes(i));
    }
    document.getElementById('selected-agents-input').value = JSON.stringify(selectedAgents);
}

async function createRoom(event) {
    event.preventDefault();
    if(selectedAgents.length === 0) { alert('Lütfen en az 1 ajan seçin!'); return; }
    
    const formData = new FormData(event.target);
    const data = {
        mode: formData.get('mode'),
        age: formData.get('age'),
        microphone: formData.get('microphone') ? 1 : 0,
        description: formData.get('description'),
        agents: selectedAgents
    };

    try {
        const res = await fetch(`${API_URL}/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert('İlan başarıyla yayınlandı!');
            switchPage('rooms');
        }
    } catch(err) {
        alert('İlan açılırken hata oluştu!');
    }
}

async function loadRooms() {
    const roomsList = document.getElementById('rooms-list');
    if (!roomsList) return;
    const token = getToken();
    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/rooms`, { headers: { 'Authorization': `Bearer ${token}` } });
        if(!res.ok) throw new Error("Sunucu yanıt vermedi.");
        const result = await res.json();
        
        let html = '';
        if(!result.success || result.rooms.length === 0) {
            html = `<p class="muted" style="text-align:center; padding:40px;">Henüz aktif ilan bulunmuyor.</p>`;
        } else {
            const loggedUser = localStorage.getItem('valotakim_logged');
            result.rooms.forEach((room) => {
                let agentImgs = room.agents.includes('farketmez') ? 
                    `<span class="badge" style="background:#a855f7; color:#fff;">FARKETMEZ</span>` : 
                    room.agents.map(aId => `<img src="images/agent${aId}.png" class="mini-agent-img" onerror="this.src='images/logo.png'">`).join('');

                let isOwner = (loggedUser === room.username);
                let participants = room.participants || [];
                let messages = room.messages || [];
                let lockedUser = room.lockedUser || null;
                let inRoom = participants.includes(loggedUser) || isOwner;

                let minutes = Math.floor(room.remaining_seconds / 60);
                let seconds = room.remaining_seconds % 60;
                let timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

                let chatHtml = `
                    <div class="room-chat-box">
                        <div style="font-weight: bold; color: #a855f7; display:flex; justify-content:space-between; align-items:center;">
                            <span>💬 Oda Sohbeti ve Yönetim</span>
                            <span style="font-size:12px; color:#ef4444; background:rgba(239,68,68,0.1); padding:4px 8px; border-radius:6px;">⏳ Kalan Süre: ${timeFormatted}</span>
                        </div>
                `;

                if (lockedUser) {
                    if (isOwner || loggedUser === lockedUser) {
                        chatHtml += `
                            <div style="background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.4); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                                <strong style="color: #4ade80;">🔒 Oda Kilitlendi! Eşleşen Oyuncular:</strong>
                                <div style="display: flex; justify-content: space-between; margin-top: 8px;