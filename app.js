const API_URL = "http://localhost:3000/api";

function getToken() {
    return localStorage.getItem('valotakim_token');
}

// Sayfa Değiştirme Fonksiyonu
function switchPage(pageId) {
    if (pageId === 'admin') {
        const loggedUser = localStorage.getItem('valotakim_logged');
        if (loggedUser !== 'admin') {
            alert('Bu sayfaya sadece admin yetkilisi erişebilir!');
            return;
        }
        loadAdminData();
    }

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
    }
    if (pageId === 'matchmaking') {
        loadMatchmaking();
    }
}

// Kullanıcı Kayıt Olma (API)
async function registerUser(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
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
            alert(result.message || 'Kayıt başarısız!');
        }
    } catch (err) {
        alert('Sunucuya bağlanılamadı!');
    }
}

// Kullanıcı Giriş Yapma (API)
async function loginUser(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    if(data.username === "admin" && data.password === "admin123") {
        localStorage.setItem('valotakim_logged', 'admin');
        checkAuthState();
        switchPage('home');
        alert('Admin olarak giriş yapıldı!');
        return;
    }
    
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
            alert(result.message || 'Hatalı kullanıcı adı veya şifre!');
        }
    } catch (err) {
        alert('Sunucu bağlantı hatası!');
    }
}

// Çıkış Yapma
function logout() {
    localStorage.removeItem('valotakim_token');
    localStorage.removeItem('valotakim_logged');
    checkAuthState();
    switchPage('home');
    alert('Çıkış yapıldı.');
}

// Kullanıcı Durumunu Kontrol Etme
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
        
        if (loggedUser === 'admin') {
            if (adminBtn) adminBtn.style.display = 'inline-block';
        } else {
            if (adminBtn) adminBtn.style.display = 'none';
        }
    } else {
        if (authButtons) authButtons.style.display = 'flex';
        if (userMenu) userMenu.style.display = 'none';
    }
}

function checkAuthAndOpenCreateRoom() {
    const loggedUser = localStorage.getItem('valotakim_logged');
    if (!loggedUser) {
        alert('İlan oluşturmak için giriş yapmalısınız!');
        switchPage('login');
        return;
    }
    switchPage('create-room');
}

// Profil Verilerini Yükleme
async function loadProfileData() {
    const token = getToken();
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.success) {
            const user = result.user;
            document.getElementById('prof-username').value = user.username;
            document.getElementById('prof-valorant').value = user.valorant_id || '';
            document.getElementById('prof-rank').value = user.rank || 'Gümüş 1';
            document.getElementById('prof-role').value = user.role || 'Flex';
        }
    } catch (err) {
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
        const res = await fetch(`${API_URL}/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert('Profil güncellendi!');
            switchPage('home');
        }
    } catch (err) {
        alert('Güncelleme başarısız.');
    }
}

// Ajan Seçim Mantığı
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
    
    let html = `
        <div class="agent-pick-box farketmez-box" id="agent-box-farketmez" onclick="toggleFarketmez()">
            <span class="farketmez-text">FARKETMEZ</span>
            <span class="pick-badge" id="pick-badge-farketmez"></span>
        </div>
    `;

    for(let i=1; i<=26; i++) {
        let name = agentNames[i-1] || `AJAN ${i}`;
        html += `
            <div class="agent-pick-box" id="agent-box-${i}" onclick="toggleAgent(${i})">
                <img src="images/agent${i}.png" alt="${name}" onerror="this.src='images/logo.png'">
                <span class="agent-name-label">${name}</span>
                <span class="pick-badge" id="pick-badge-${i}"></span>
            </div>
        `;
    }
    container.innerHTML = html;
}

function toggleFarketmez() {
    const idx = selectedAgents.indexOf('farketmez');
    if(idx > -1) { selectedAgents.splice(idx, 1); } 
    else { selectedAgents = ['farketmez']; }
    updateAgentPickerUI();
}

function toggleAgent(id) {
    if(selectedAgents.includes('farketmez')) { selectedAgents = []; }
    const index = selectedAgents.indexOf(id);
    if(index > -1) {
        selectedAgents.splice(index, 1);
    } else {
        if(selectedAgents.length >= 3) { alert('En fazla 3 ajan seçebilirsiniz!'); return; }
        selectedAgents.push(id);
    }
    updateAgentPickerUI();
}

function updateAgentPickerUI() {
    const fBox = document.getElementById('agent-box-farketmez');
    const fBadge = document.getElementById('pick-badge-farketmez');
    if(selectedAgents.includes('farketmez')) {
        fBox.classList.add('selected'); fBadge.textContent = '1';
    } else {
        fBox.classList.remove('selected'); fBadge.textContent = '';
    }

    for(let i=1; i<=26; i++) {
        const box = document.getElementById(`agent-box-${i}`);
        const badge = document.getElementById(`pick-badge-${i}`);
        if(!box) continue;
        const pos = selectedAgents.indexOf(i);
        if(pos > -1) {
            box.classList.add('selected'); badge.textContent = pos + 1;
        } else {
            box.classList.remove('selected'); badge.textContent = '';
        }
    }
    document.getElementById('selected-agents-input').value = JSON.stringify(selectedAgents);
}

// İlan Oluşturma (API)
async function createRoom(event) {
    event.preventDefault();
    if(selectedAgents.length === 0) { alert('Lütfen en az 1 ajan seçin!'); return; }
    
    const token = getToken();
    const formData = new FormData(event.target);
    const data = {
        role: formData.get('role') || 'Flex',
        mode: formData.get('mode'),
        age: formData.get('age'),
        microphone: formData.get('microphone') ? 1 : 0,
        description: formData.get('description'),
        agents: selectedAgents
    };

    try {
        const res = await fetch(`${API_URL}/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert('İlan başarıyla yayınlandı!');
            switchPage('rooms');
            loadRooms();
        } else {
            alert(result.message);
        }
    } catch (err) {
        alert('İlan oluşturulamadı.');
    }
}

// İlanları Listeleme (API)
async function loadRooms() {
    const roomsList = document.getElementById('rooms-list');
    if (!roomsList) return;
    const token = getToken();
    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/rooms`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        
        let html = '';
        if(!result.success || result.rooms.length === 0) {
            html = `<p class="muted" style="text-align:center; padding:40px;">Henüz aktif ilan bulunmuyor.</p>`;
        } else {
            const loggedUser = localStorage.getItem('valotakim_logged');
            result.rooms.forEach((room) => {
                let agentImgs = '';
                if(room.agents && room.agents.includes('farketmez')) {
                    agentImgs = `<span class="badge" style="background:#a855f7; color:#fff;">FARKETMEZ</span>`;
                } else if(room.agents) {
                    agentImgs = room.agents.map(aId => `<img src="images/agent${aId}.png" class="mini-agent-img" onerror="this.src='images/logo.png'">`).join('');
                }

                let isOwner = (loggedUser === room.username);
                let participants = room.participants || [];
                let messages = room.messages || [];
                let lockedUser = room.lockedUser || null;

                let chatHtml = `
                    <div class="room-chat-box">
                        <div style="font-weight: bold; color: #a855f7; display:flex; justify-content:space-between; align-items:center;">
                            <span>💬 Oda Sohbeti ve Katılımcı Yönetimi</span>
                            <span style="font-size:12px; color:#94a3b8;">Mod: ${room.mode} | Yaş: ${room.age}</span>
                        </div>
                `;

                if (lockedUser) {
                    if (isOwner || loggedUser === lockedUser) {
                        chatHtml += `
                            <div style="background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.4); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                                <strong style="color: #4ade80;">🔒 Oda Kilitlendi! Eşleşen Oyuncular:</strong>
                                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 13px; color: #fff;">
                                    <span>👤 ${room.username}: <strong>${room.owner_valorant_id}</strong></span>
                                    <span>👤 ${lockedUser}: <strong>${room.locked_valorant_id}</strong></span>
                                </div>
                                <div style="display: flex; gap: 10px; margin-top: 12px; justify-content: flex-end;">
                                    ${isOwner ? 
                                        `<button class="btn-added-check ${room.ownerAdded ? 'checked' : ''}" onclick="markAsAdded(${room.id}, 'owner')">${room.ownerAdded ? '✓ Ekledim' : 'Ekledim'}</button>` : 
                                        `<button class="btn-added-check ${room.guestAdded ? 'checked' : ''}" onclick="markAsAdded(${room.id}, 'guest')">${room.guestAdded ? '✓ Ekledim' : 'Ekledim'}</button>`
                                    }
                                </div>
                            </div>
                        `;
                    }
                }

                if (isOwner && !lockedUser) {
                    chatHtml += `<div style="font-size:12px; font-weight:bold; color:#cbd5e1; margin-top:5px;">Odaya Girenler:</div><div class="participants-management-list">`;
                    if (participants.length === 0) {
                        chatHtml += `<span style="font-size:12px; color:#666e7b;">Henüz odaya giren kimse yok.</span>`;
                    } else {
                        participants.forEach(pUser => {
                            chatHtml += `
                                <div class="participant-row">
                                    <div class="participant-info">
                                        <div class="participant-avatar"><img src="images/logo.png" style="width:100%; height:100%; object-fit:cover;"></div>
                                        <div><span style="font-weight:bold; font-size:13px; color:#fff;">${pUser}</span></div>
                                    </div>
                                    <div class="participant-actions">
                                        <button class="btn-green-accept" onclick="handleParticipantAction(${room.id}, '${pUser}', 'accept')">+</button>
                                        <button class="btn-red-reject" onclick="handleParticipantAction(${room.id}, '${pUser}', 'reject')">-</button>
                                    </div>
                                </div>
                            `;
                        });
                    }
                    chatHtml += `</div>`;
                }

                chatHtml += `<div class="chat-messages-area">`;
                if (messages.length === 0) {
                    chatHtml += `<span style="font-size:12px; color:#666e7b; text-align:center; margin:auto;">Sohbet odası aktif. Konuşmaya başlayın!</span>`;
                } else {
                    messages.forEach(m => {
                        chatHtml += `<div class="chat-msg-item"><strong>${m.user}:</strong> ${m.text}</div>`;
                    });
                }
                chatHtml += `</div>
                    <div class="chat-input-row">
                        <input type="text" id="chat-input-${room.id}" placeholder="Mesaj yaz..." onkeypress="if(event.key==='Enter') sendRoomMessage(${room.id})">
                        <button class="primary small" onclick="sendRoomMessage(${room.id})">Gönder</button>
                    </div>
                </div>`;

                html += `
                    <div class="room-card-custom" style="flex-direction: column; align-items: stretch; gap: 12px;">
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
                                <button class="primary small" onclick="joinRoom(${room.id})">${participants.includes(loggedUser) || isOwner ? 'Odadasın' : 'Odaya Katıl'}</button>
                            </div>
                        </div>
                        ${participants.includes(loggedUser) || isOwner ? chatHtml : ''}
                    </div>
                `;
            });
        }
        roomsList.innerHTML = html;
    } catch (err) {
        console.error(err);
    }
}

async function joinRoom(roomId) {
    const token = getToken();
    try {
        const res = await fetch(`${API_URL}/rooms/${roomId}/join`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadRooms();
    } catch (err) { console.error(err); }
}

async function sendRoomMessage(roomId) {
    const input = document.getElementById(`chat-input-${roomId}`);
    if (!input || !input.value.trim()) return;
    const token = getToken();
    try {
        await fetch(`${API_URL}/rooms/${roomId}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text: input.value.trim() })
        });
        loadRooms();
    } catch (err) { console.error(err); }
}

async function handleParticipantAction(roomId, username, action) {
    const token = getToken();
    try {
        await fetch(`${API_URL}/rooms/${roomId}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ username, action })
        });
        loadRooms();
    } catch (err) { console.error(err); }
}

async function markAsAdded(roomId, userType) {
    const token = getToken();
    try {
        await fetch(`${API_URL}/rooms/${roomId}/added`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ userType })
        });
        loadRooms();
    } catch (err) { console.error(err); }
}

// 5'li Takım Bul (Eşleşme Sistemi)
async function loadMatchmaking() {
    const results = document.getElementById('matchmaking-results');
    if (!results) return;
    const token = getToken();

    try {
        const res = await fetch(`${API_URL}/matchmaking`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        
        if (!result.success) {
            results.innerHTML = `<p class="muted">Eşleşme sağlanamadı.</p>`;
            return;
        }

        let html = `<h3>Senin Rankın: ${result.searchRank} (Akıllı Eşleşme Aralığı)</h3><div class="rooms" style="margin-top:15px;">`;
        
        if(result.players.length === 0) {
            html += `<p class="muted">Kriterlerine uygun aktif oyuncu bulunamadı.</p>`;
        } else {
            result.players.forEach(u => {
                html += `
                    <div class="room-card-custom">
                        <div class="room-left-info">
                            <div class="room-user-avatar"><img src="images/logo.png"></div>
                            <div>
                                <span class="room-username-txt">${u.username} (${u.valorant_id})</span>
                                <span class="room-rank-txt">Rank: ${u.rank} | Rol: ${u.role}</span>
                            </div>
                        </div>
                        <div class="room-right-action">
                            <button class="primary small" onclick="alert('${u.username} adlı kullanıcıya davet gönderildi!')">Davet Gönder</button>
                        </div>
                    </div>
                `;
            });
        }
        html += `</div>`;
        results.innerHTML = html;
    } catch (err) {
        console.error(err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    if(document.getElementById('rooms-list')) loadRooms();
});