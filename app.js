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

// TEST AŞAMALI SOSYAL GİRİŞ (HATA TESPİTİ İÇİN)
async function socialLogin(provider) {
    alert("Bağlantı başlatılıyor... Lütfen bekleyin."); // 1. Aşama Testi
    try {
        const res = await fetch(`/api/social-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider })
        });
        
        alert("Sunucudan cevap geldi! Durum kodu: " + res.status); // 2. Aşama Testi

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Sunucu Hatası: ${res.status} - ${errText}`);
        }

        const result = await res.json();
        if (result.success) {
            localStorage.setItem('valotakim_token', result.token);
            localStorage.setItem('valotakim_logged', result.user.username);
            checkAuthState();
            switchPage('home');
            alert(`Giriş Başarılı! Hoş geldin, ${result.user.username}`); // Başarı
        } else {
            alert('Giriş reddedildi!');
        }
    } catch (err) {
        alert(`Sistem Hatası:\n${err.message}`); // Hata Yakalama
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
                                        <button class="btn-green-accept" onclick="handleParticipantAction(${room.id}, '${pUser}', 'accept')" title="Kabul Et">+</button>
                                        <button class="btn-red-reject" onclick="handleParticipantAction(${room.id}, '${pUser}', 'reject')" title="Reddet">-</button>
                                    </div>
                                </div>
                            `;
                        });
                    }
                    chatHtml += `</div>`;
                }

                chatHtml += `<div class="chat-messages-area">`;
                if (messages.length === 0) {
                    chatHtml += `<span style="font-size:12px; color:#666e7b; text-align:center; margin:auto;">Sohbet aktif. Konuşmaya başlayın!</span>`;
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
                                <button class="primary small" onclick="joinRoom(${room.id})">${inRoom ? 'Odadasın' : 'Odaya Katıl'}</button>
                            </div>
                        </div>
                        ${inRoom ? chatHtml : ''}
                    </div>
                `;
            });
        }
        roomsList.innerHTML = html;
    } catch (err) { 
        console.error("Oda yükleme hatası:", err);
    }
}

async function joinRoom(roomId) {
    try {
        await fetch(`${API_URL}/rooms/${roomId}/join`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        loadRooms();
    } catch(err) { console.error(err); }
}

async function sendRoomMessage(roomId) {
    const input = document.getElementById(`chat-input-${roomId}`);
    if (!input || !input.value.trim()) return;
    try {
        await fetch(`${API_URL}/rooms/${roomId}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ text: input.value.trim() })
        });
        input.value = '';
        loadRooms();
    } catch(err) { console.error(err); }
}

async function handleParticipantAction(roomId, username, action) {
    try {
        await fetch(`${API_URL}/rooms/${roomId}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ username, action })
        });
        loadRooms();
    } catch(err) { console.error(err); }
}

async function markAsAdded(roomId, userType) {
    try {
        await fetch(`${API_URL}/rooms/${roomId}/added`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ userType })
        });
        loadRooms();
    } catch(err) { console.error(err); }
}

async function loadMatchmaking() {
    const results = document.getElementById('matchmaking-results');
    if (!results) return;
    const token = getToken();

    try {
        const res = await fetch(`${API_URL}/matchmaking`, { headers: { 'Authorization': `Bearer ${token}` } });
        if(!res.ok) throw new Error("Sunucu yanıt vermedi.");
        const result = await res.json();
        
        if (!result.success) {
            results.innerHTML = `<p class="muted">Eşleşme yapılamadı.</p>`;
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
        console.error("Eşleşme hatası:", err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    if(document.getElementById('rooms-list')) loadRooms();
});