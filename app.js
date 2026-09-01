const API_URL = "/api"; 
let roomsInterval = null;

function getToken() {
    return localStorage.getItem('valotakim_token');
}

function switchPage(pageId) {
    if (pageId === 'admin') {
        const loggedUser = localStorage.getItem('valotakim_logged');
        if (loggedUser !== 'admin') {
            alert('Bu sayfaya sadece admin yetkilisi erişebilir!');
            return;
        }
        loadAdminRooms();
    }

    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const target = document.getElementById('page-' + pageId);
    if (target) { target.classList.add('active'); window.scrollTo(0, 0); }
    if (pageId === 'create-room') initAgentPicker();
    if (pageId === 'profile') loadProfileData();
    if (pageId === 'rooms') { loadRooms(); if(!roomsInterval) roomsInterval = setInterval(loadRooms, 3000); } 
    else { if(roomsInterval) { clearInterval(roomsInterval); roomsInterval = null; } }
    if (pageId === 'matchmaking') loadMatchmaking();
}

// === STANDART KAYIT OL (ÇİFT ŞİFRE ONAYLI) ===
async function registerUser(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    if (data.password !== data.passwordConfirm) {
        alert('Şifreler birbiriyle uyuşmuyor!');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert('Kayıt başarıyla oluşturuldu! Şimdi giriş yapabilirsiniz.');
            switchPage('login');
        } else {
            alert(result.message || 'Kayıt başarısız.');
        }
    } catch (err) {
        alert('Sunucu bağlantı hatası.');
    }
}

// === STANDART GİRİŞ YAP ===
async function loginUser(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            localStorage.setItem('valotakim_token', result.token);
            localStorage.setItem('valotakim_logged', result.user.username);
            checkAuthState();
            switchPage('home');
            alert('Başarıyla giriş yapıldı: ' + result.user.username);
        } else {
            alert(result.message || 'Hatalı kullanıcı adı veya şifre.');
        }
    } catch (err) {
        alert('Sunucu bağlantı hatası.');
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
    const adminBtn = document.getElementById('admin-panel-btn');

    if (loggedUser) {
        if (authButtons) authButtons.style.display = 'none';
        if (userMenu) userMenu.style.display = 'flex';
        if (usernameSpan) usernameSpan.textContent = loggedUser;
        
        if (adminBtn) {
            adminBtn.style.display = (loggedUser === 'admin') ? 'inline-block' : 'none';
        }
    } else {
        if (authButtons) authButtons.style.display = 'flex';
        if (userMenu) userMenu.style.display = 'none';
    }
}

function checkAuthAndOpenCreateRoom() {
    if (!getToken()) { alert('İlan oluşturmak için giriş yapmalısınız!'); switchPage('login'); return; }
    switchPage('create-room');
}

// === PROFİL İŞLEMLERİ ===
async function loadProfileData() {
    const token = getToken();
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
        const result = await res.json();
        if (result.success && result.user) {
            document.getElementById('prof-username').value = result.user.username;
            document.getElementById('prof-valorant').value = result.user.valorant_id || '';
            document.getElementById('prof-rank').value = result.user.rank || 'Gümüş 1';
            document.getElementById('prof-role').value = result.user.role || 'Flex';
        }
    } catch(err) { console.error(err); }
}

async function updateProfile(event) {
    event.preventDefault();
    const token = getToken();
    const data = {
        valorant_id: document.getElementById('prof-valorant').value,
        rank: document.getElementById('prof-rank').value,
        role: document.getElementById('prof-role').value
    };
    await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data)
    });
    alert('Profil güncellendi!');
    switchPage('home');
}

// === ODA (İLAN) İŞLEMLERİ ===
const agentNames = ["ASTRA", "BREACH", "BRIMSTONE", "CHAMBER", "KILLJOY", "OMEN", "CYPHER", "GEKKO", "JETT", "KAYO", "DEADLOCK", "NEON", "PHOENIX", "RAZE", "REYNA", "SAGE", "SKYE", "SOVA", "VIPER", "YORU", "ISO", "CLOVE", "VYSE", "TEJO", "VETO", "AJAN 26"];
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
    for(let i=1; i<=26; i++) document.getElementById(`agent-box-${i}`)?.classList.toggle('selected', selectedAgents.includes(i));
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

    const res = await fetch(`${API_URL}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(data)
    });
    if ((await res.json()).success) { alert('İlan yayınlandı!'); switchPage('rooms'); }
}

async function loadRooms() {
    const roomsList = document.getElementById('rooms-list');
    if (!roomsList) return;
    const token = getToken();
    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/rooms`, { headers: { 'Authorization': `Bearer ${token}` } });
        if(!res.ok) return;
        const result = await res.json();
        
        let html = '';
        if(!result.success || result.rooms.length === 0) {
            html = `<p class="muted" style="text-align:center; padding:40px;">Aktif ilan bulunmuyor.</p>`;
        } else {
            const loggedUser = localStorage.getItem('valotakim_logged');
            result.rooms.forEach((room) => {
                let agentImgs = room.agents.includes('farketmez') ? 
                    `<span class="badge" style="background:#a855f7; color:#fff;">FARKETMEZ</span>` : 
                    room.agents.map(aId => `<img src="images/agent${aId}.png" class="mini-agent-img" onerror="this.src='images/logo.png'">`).join('');

                let isOwner = (loggedUser === room.username);
                let inRoom = (room.participants || []).includes(loggedUser) || isOwner;

                let messagesHtml = (room.messages || []).map(m => `<div class="chat-msg-item"><strong>${m.sender}:</strong> ${m.text} <span style="font-size:10px; color:#aaa; margin-left:5px;">${m.time}</span></div>`).join('');

                html += `
                    <div class="room-card-custom">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div class="room-left-info">
                                <div class="room-user-avatar"><img src="images/logo.png" alt="Logo"></div>
                                <div>
                                    <span class="room-username-txt">${room.username}</span>
                                    <span class="room-rank-txt">Rank: ${room.rank} | Not: ${room.description || 'Yok'}</span>
                                </div>
                            </div>
                            <div class="room-middle-agents">${agentImgs}</div>
                            <div class="room-right-action">
                                <span class="badge red">${room.mode}</span>
                                <button class="primary small" onclick="joinRoom(${room.id})">${inRoom ? 'Odadasın' : 'Odaya Katıl'}</button>
                            </div>
                        </div>

                        ${inRoom ? `
                            <div class="room-chat-box" style="margin-top: 10px;">
                                <div class="chat-messages-area" id="chat-box-${room.id}">${messagesHtml || '<p class="muted" style="font-size:12px;">Sohbet henüz boş...</p>'}</div>
                                <div class="chat-input-row">
                                    <input type="text" id="chat-input-${room.id}" placeholder="Mesaj yaz..." onkeypress="if(event.key==='Enter') sendRoomMessage(${room.id})">
                                    <button class="primary small" onclick="sendRoomMessage(${room.id})">Gönder</button>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            });
        }
        roomsList.innerHTML = html;
    } catch (err) { console.error(err); }
}

async function joinRoom(roomId) {
    await fetch(`${API_URL}/rooms/${roomId}/join`, { method: 'POST', headers: { 'Authorization': `Bearer ${getToken()}` } });
    loadRooms();
}

async function sendRoomMessage(roomId) {
    const input = document.getElementById(`chat-input-${roomId}`);
    const text = input.value.trim();
    if(!text) return;
    
    await fetch(`${API_URL}/rooms/${roomId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ message: text })
    });
    input.value = '';
    loadRooms();
}

// === ADMIN İŞLEMLERİ ===
async function loadAdminRooms() {
    const list = document.getElementById('admin-rooms-list');
    if(!list) return;
    try {
        const res = await fetch(`${API_URL}/admin/rooms`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
        const result = await res.json();
        if(result.success) {
            let html = '';
            result.rooms.forEach(r => {
                html += `
                    <div style="background:#131722; padding:12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <div><strong>${r.username}</strong> - Mod: ${r.mode} | Not: ${r.description || 'Yok'}</div>
                        <button class="primary small" style="background:#ef4444;" onclick="adminDeleteRoom(${r.id})">Kaldır</button>
                    </div>
                `;
            });
            list.innerHTML = html || '<p class="muted">Hiç ilan yok.</p>';
        }
    } catch(err) { console.error(err); }
}

async function adminDeleteRoom(roomId) {
    await fetch(`${API_URL}/admin/rooms/${roomId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` } });
    loadAdminRooms();
}

// === 5'Lİ TAKIM BUL (RANK ARALIĞI FİLTRESİ) ===
const rankList = [
    "Demir 1", "Demir 2", "Demir 3", "Bronz 1", "Bronz 2", "Bronz 3",
    "Gümüş 1", "Gümüş 2", "Gümüş 3", "Altın 1", "Altın 2", "Altın 3",
    "Platin 1", "Platin 2", "Platin 3", "Elmas 1", "Elmas 2", "Elmas 3",
    "Yücelik 1", "Yücelik 2", "Yücelik 3", "Ölümsüzlük 1", "Ölümsüzlük 2", "Ölümsüzlük 3", "Radiant"
];

async function loadMatchmaking() {
    const results = document.getElementById('matchmaking-results');
    if (!results) return;
    try {
        const res = await fetch(`${API_URL}/profile`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
        const result = await res.json();
        if(!result.success) { results.innerHTML = '<p class="muted">Önce giriş yapmalısınız.</p>'; return; }
        
        let myRank = result.user.rank || 'Gümüş 1';
        let myRankIndex = rankList.indexOf(myRank);
        let maxRankIndex = Math.min(rankList.length - 1, myRankIndex + 3);
        let minRankIndex = Math.max(0, myRankIndex - 3);

        results.innerHTML = `<h3>Senin Rankın: ${myRank} (Eşleşme Aralığı: ${rankList[minRankIndex]} - ${rankList[maxRankIndex]})</h3><p class="muted">Bu aralıktaki oyuncular yakında listelenecektir.</p>`;
    } catch(err) { console.error(err); }
}

document.addEventListener('DOMContentLoaded', () => { checkAuthState(); if(document.getElementById('rooms-list')) loadRooms(); });