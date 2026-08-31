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
}

// Kullanıcı Kayıt Olma
function registerUser(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    let users = JSON.parse(localStorage.getItem('valotakim_users') || '[]');
    if(users.some(u => u.username === data.username)) {
        alert('Bu kullanıcı adı zaten alınmış!');
        return;
    }
    
    users.push(data);
    localStorage.setItem('valotakim_users', JSON.stringify(users));
    alert('Kayıt başarıyla oluşturuldu! Şimdi giriş yapabilirsiniz.');
    switchPage('login');
}

// Kullanıcı Giriş Yapma
function loginUser(event) {
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
    
    let users = JSON.parse(localStorage.getItem('valotakim_users') || '[]');
    let found = users.find(u => u.username === data.username && u.password === data.password);
    
    if(found) {
        localStorage.setItem('valotakim_logged', data.username);
        checkAuthState();
        switchPage('home');
        alert('Başarıyla giriş yapıldı: ' + data.username);
    } else {
        alert('Hatalı kullanıcı adı veya şifre!');
    }
}

// Çıkış Yapma
function logout() {
    localStorage.removeItem('valotakim_logged');
    checkAuthState();
    switchPage('home');
    alert('Çıkış yapıldı.');
}

// Kullanıcı Durumunu ve Admin Butonunu Kontrol Etme
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
function loadProfileData() {
    const loggedUser = localStorage.getItem('valotakim_logged');
    if (!loggedUser || loggedUser === 'admin') return;
    let users = JSON.parse(localStorage.getItem('valotakim_users') || '[]');
    let user = users.find(u => u.username === loggedUser);
    if(user) {
        document.getElementById('prof-username').value = user.username;
        document.getElementById('prof-valorant').value = user.valorant_id || '';
        document.getElementById('prof-rank').value = user.rank || 'Gümüş 1';
        document.getElementById('prof-role').value = user.role || 'Flex';
    }
}

function updateProfile(event) {
    event.preventDefault();
    const loggedUser = localStorage.getItem('valotakim_logged');
    let users = JSON.parse(localStorage.getItem('valotakim_users') || '[]');
    let index = users.findIndex(u => u.username === loggedUser);
    if(index !== -1) {
        users[index].valorant_id = document.getElementById('prof-valorant').value;
        users[index].rank = document.getElementById('prof-rank').value;
        users[index].role = document.getElementById('prof-role').value;
        localStorage.setItem('valotakim_users', JSON.stringify(users));
        alert('Profil güncellendi!');
        switchPage('home');
    }
}

// 26 Ajan ve İsimleri
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
    
    let html = '';
    html += `
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
    if(idx > -1) {
        selectedAgents.splice(idx, 1);
    } else {
        selectedAgents = ['farketmez'];
    }
    updateAgentPickerUI();
}

function toggleAgent(id) {
    if(selectedAgents.includes('farketmez')) {
        selectedAgents = [];
    }

    const index = selectedAgents.indexOf(id);
    if(index > -1) {
        selectedAgents.splice(index, 1);
    } else {
        if(selectedAgents.length >= 3) {
            alert('En fazla 3 ajan seçebilirsiniz!');
            return;
        }
        selectedAgents.push(id);
    }
    updateAgentPickerUI();
}

function updateAgentPickerUI() {
    const fBox = document.getElementById('agent-box-farketmez');
    const fBadge = document.getElementById('pick-badge-farketmez');
    if(selectedAgents.includes('farketmez')) {
        fBox.classList.add('selected');
        fBadge.textContent = '1';
    } else {
        fBox.classList.remove('selected');
        fBadge.textContent = '';
    }

    for(let i=1; i<=26; i++) {
        const box = document.getElementById(`agent-box-${i}`);
        const badge = document.getElementById(`pick-badge-${i}`);
        if(!box) continue;
        
        const pos = selectedAgents.indexOf(i);
        if(pos > -1) {
            box.classList.add('selected');
            badge.textContent = pos + 1;
        } else {
            box.classList.remove('selected');
            badge.textContent = '';
        }
    }
    document.getElementById('selected-agents-input').value = JSON.stringify(selectedAgents);
}

// İlan Oluşturma
function createRoom(event) {
    event.preventDefault();
    if(selectedAgents.length === 0) {
        alert('Lütfen en az 1 ajan veya "Farketmez" seçin!');
        return;
    }
    
    const formData = new FormData(event.target);
    const loggedUser = localStorage.getItem('valotakim_logged') || 'Misafir';
    
    let users = JSON.parse(localStorage.getItem('valotakim_users') || '[]');
    let user = users.find(u => u.username === loggedUser);
    let userRank = user ? user.rank : 'Gümüş 1';

    const newRoom = {
        id: Date.now(),
        user: loggedUser,
        rank: userRank,
        mode: formData.get('mode'),
        age: formData.get('age'),
        microphone: formData.get('microphone') ? 'Mikrofon Var' : 'Mikrofon Yok',
        description: formData.get('description'),
        agents: selectedAgents,
        participants: [],
        messages: [],
        lockedUser: null,
        ownerAdded: false,
        guestAdded: false
    };

    let rooms = JSON.parse(localStorage.getItem('valotakim_rooms') || '[]');
    rooms.unshift(newRoom);
    localStorage.setItem('valotakim_rooms', JSON.stringify(rooms));

    alert('İlan başarıyla yayınlandı!');
    switchPage('rooms');
}

// Odaya Katılma
function joinRoom(roomId) {
    const loggedUser = localStorage.getItem('valotakim_logged');
    if (!loggedUser) {
        alert('Odaya katılmak için giriş yapmalısınız!');
        switchPage('login');
        return;
    }

    let rooms = JSON.parse(localStorage.getItem('valotakim_rooms') || '[]');
    let room = rooms.find(r => r.id === roomId);
    if (!room) return;

    if (room.lockedUser) {
        alert('Bu oda kilitlenmiş, yeni katılımcı kabul edilemiyor!');
        return;
    }

    if (!room.participants) room.participants = [];
    if (!room.messages) room.messages = [];

    if (!room.participants.includes(loggedUser) && room.user !== loggedUser) {
        room.participants.push(loggedUser);
        localStorage.setItem('valotakim_rooms', JSON.stringify(rooms));
    }

    loadRooms();
}

// Sohbet Mesajı Gönderme
function sendRoomMessage(roomId) {
    const input = document.getElementById(`chat-input-${roomId}`);
    if (!input || !input.value.trim()) return;

    const loggedUser = localStorage.getItem('valotakim_logged');
    let rooms = JSON.parse(localStorage.getItem('valotakim_rooms') || '[]');
    let room = rooms.find(r => r.id === roomId);
    if (!room) return;

    if (!room.messages) room.messages = [];
    room.messages.push({ user: loggedUser, text: input.value.trim() });
    localStorage.setItem('valotakim_rooms', JSON.stringify(rooms));
    loadRooms();
}

// Artı (+) ve Eksi (-) İşlemleri Yönetimi
function handleParticipantAction(roomId, username, action) {
    let rooms = JSON.parse(localStorage.getItem('valotakim_rooms') || '[]');
    let room = rooms.find(r => r.id === roomId);
    if (!room) return;

    if (action === 'reject') {
        // (-) İşlemi: Kişi odadan atılır ve oda tamamen silinir
        rooms = rooms.filter(r => r.id !== roomId);
        localStorage.setItem('valotakim_rooms', JSON.stringify(rooms));
        alert(`${username} odadan çıkarıldı ve ilan kapatıldı.`);
        loadRooms();
        return;
    } else if (action === 'accept') {
        // (+) İşlemi: Oda kilitlenir, seçilen kullanıcı atanır
        room.lockedUser = username;
        room.ownerAdded = false;
        room.guestAdded = false;
    }

    localStorage.setItem('valotakim_rooms', JSON.stringify(rooms));
    loadRooms();
}

// "Ekledim" Butonuna Basılması
function markAsAdded(roomId, userType) {
    let rooms = JSON.parse(localStorage.getItem('valotakim_rooms') || '[]');
    let room = rooms.find(r => r.id === roomId);
    if (!room) return;

    if (userType === 'owner') {
        room.ownerAdded = true;
    } else if (userType === 'guest') {
        room.guestAdded = true;
    }

    // İki taraf da ekledim derse oda tamamen silinir
    if (room.ownerAdded && room.guestAdded) {
        rooms = rooms.filter(r => r.id !== roomId);
        localStorage.setItem('valotakim_rooms', JSON.stringify(rooms));
        alert('İki taraf da birbirini ekledi! Oda kapatıldı.');
        loadRooms();
        return;
    }

    localStorage.setItem('valotakim_rooms', JSON.stringify(rooms));
    loadRooms();
}

// İlanları Listeleme ve Dinamik Oda Arayüzü
function loadRooms() {
    const roomsList = document.getElementById('rooms-list');
    if (!roomsList) return;
    
    let rooms = JSON.parse(localStorage.getItem('valotakim_rooms') || '[]');
    let loggedUser = localStorage.getItem('valotakim_logged');
    let allUsers = JSON.parse(localStorage.getItem('valotakim_users') || '[]');
    
    let html = '';
    if(rooms.length === 0) {
        html = `<p class="muted" style="text-align:center; padding:40px;">Henüz aktif ilan bulunmuyor.</p>`;
    } else {
        rooms.forEach((room) => {
            let agentImgs = '';
            if(room.agents.includes('farketmez')) {
                agentImgs = `<span class="badge" style="background:#a855f7; color:#fff;">FARKETMEZ</span>`;
            } else {
                agentImgs = room.agents.map(aId => `<img src="images/agent${aId}.png" class="mini-agent-img" onerror="this.src='images/logo.png'">`).join('');
            }

            let isOwner = (loggedUser === room.user);
            let participants = room.participants || [];
            let messages = room.messages || [];
            let lockedUser = room.lockedUser || null;

            let ownerObj = allUsers.find(u => u.username === room.user);
            let ownerValorantId = ownerObj ? ownerObj.valorant_id : 'Bulunamadı';

            let chatHtml = `
                <div class="room-chat-box">
                    <div style="font-weight: bold; color: #a855f7; display:flex; justify-content:space-between; align-items:center;">
                        <span>💬 Oda Sohbeti ve Katılımcı Yönetimi</span>
                        <span style="font-size:12px; color:#94a3b8;">Mod: ${room.mode} | Yaş: ${room.age}</span>
                    </div>
            `;

            // Oda kilitlenmişse iki tarafın ID'lerini göster ve "Ekledim" butonlarını ekle
            if (lockedUser) {
                let guestObj = allUsers.find(u => u.username === lockedUser);
                let guestValorantId = guestObj ? guestObj.valorant_id : 'Bulunamadı';

                if (isOwner || loggedUser === lockedUser) {
                    chatHtml += `
                        <div style="background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.4); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                            <strong style="color: #4ade80;">🔒 Oda Kilitlendi! Eşleşen Oyuncular:</strong>
                            <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 13px; color: #fff;">
                                <span>👤 ${room.user}: <strong>${ownerValorantId}</strong></span>
                                <span>👤 ${lockedUser}: <strong>${guestValorantId}</strong></span>
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

            // İlan Sahibi İçin: Giren Kişiler, Profilleri, İsimleri ve Yeşil (+) / Kırmızı (-) Butonlar
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
                                    <div>
                                        <span style="font-weight:bold; font-size:13px; color:#fff;">${pUser}</span>
                                    </div>
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

            // Sohbet Alanı
            chatHtml += `
                <div class="chat-messages-area" id="chat-messages-${room.id}">
            `;
            if (messages.length === 0) {
                chatHtml += `<span style="font-size:12px; color:#666e7b; text-align:center; margin:auto;">Sohbet odası aktif. Konuşmaya başlayın!</span>`;
            } else {
                messages.forEach(m => {
                    chatHtml += `<div class="chat-msg-item"><strong>${m.user}:</strong> ${m.text}</div>`;
                });
            }
            chatHtml += `
                </div>
                <div class="chat-input-row">
                    <input type="text" id="chat-input-${room.id}" placeholder="Mesaj yaz..." onkeypress="if(event.key==='Enter') sendRoomMessage(${room.id})">
                    <button class="primary small" onclick="sendRoomMessage(${room.id})">Gönder</button>
                </div>
            </div>`;

            html += `
                <div class="room-card-custom" style="flex-direction: column; align-items: stretch; gap: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <div class="room-left-info">
                            <div class="room-user-avatar">
                                <img src="images/logo.png" alt="Logo">
                            </div>
                            <div>
                                <span class="room-username-txt">${room.user}</span>
                                <span class="room-rank-txt">Rank: ${room.rank} | Not: ${room.description || 'Yok'}</span>
                            </div>
                        </div>
                        
                        <div class="room-middle-agents">
                            ${agentImgs}
                        </div>

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
}

// ADMIN PANELİ
function loadAdminData() {
    const adminRoomsList = document.getElementById('admin-rooms-list');
    let rooms = JSON.parse(localStorage.getItem('valotakim_rooms') || '[]');
    if(adminRoomsList) {
        if(rooms.length === 0) {
            adminRoomsList.innerHTML = `<p class="muted">Hiç ilan yok.</p>`;
        } else {
            let html = '';
            rooms.forEach(room => {
                html += `
                    <div class="room-card-custom" style="margin-bottom: 10px; padding: 10px 15px;">
                        <div>
                            <strong>${room.user}</strong> (${room.mode}) - Rank: ${room.rank}
                            <p class="muted" style="margin: 2px 0 0 0; font-size:12px;">Not: ${room.description || 'Yok'}</p>
                        </div>
                        <button class="primary small" style="background: #ef4444;" onclick="adminDeleteRoom(${room.id})">İlanı Kaldır</button>
                    </div>
                `;
            });
            adminRoomsList.innerHTML = html;
        }
    }

    const adminUsersList = document.getElementById('admin-users-list');
    let users = JSON.parse(localStorage.getItem('valotakim_users') || '[]');
    if(adminUsersList) {
        if(users.length === 0) {
            adminUsersList.innerHTML = `<p class="muted">Kayıtlı normal kullanıcı yok.</p>`;
        } else {
            let html = '';
            users.forEach((u, index) => {
                html += `
                    <div class="room-card-custom" style="margin-bottom: 10px; padding: 10px 15px;">
                        <div>
                            <strong>${u.username}</strong> - Rank: ${u.rank} | Valorant ID: ${u.valorant_id}
                        </div>
                        <button class="primary small" style="background: #ef4444;" onclick="adminDeleteUser(${index})">Üyeyi Sil</button>
                    </div>
                `;
            });
            adminUsersList.innerHTML = html;
        }
    }
}

function adminDeleteRoom(roomId) {
    let rooms = JSON.parse(localStorage.getItem('valotakim_rooms') || '[]');
    rooms = rooms.filter(r => r.id !== roomId);
    localStorage.setItem('valotakim_rooms', JSON.stringify(rooms));
    loadAdminData();
    alert('İlan kaldırıldı.');
}

function adminDeleteUser(userIndex) {
    let users = JSON.parse(localStorage.getItem('valotakim_users') || '[]');
    users.splice(userIndex, 1);
    localStorage.setItem('valotakim_users', JSON.stringify(users));
    loadAdminData();
    alert('Kullanıcı silindi.');
}

const rankList = [
    "Demir 1", "Demir 2", "Demir 3",
    "Bronz 1", "Bronz 2", "Bronz 3",
    "Gümüş 1", "Gümüş 2", "Gümüş 3",
    "Altın 1", "Altın 2", "Altın 3",
    "Platin 1", "Platin 2", "Platin 3",
    "Elmas 1", "Elmas 2", "Elmas 3",
    "Yücelik 1", "Yücelik 2", "Yücelik 3",
    "Ölümsüzlük 1", "Ölümsüzlük 2", "Ölümsüzlük 3",
    "Radiant"
];

function loadMatchmaking() {
    const results = document.getElementById('matchmaking-results');
    if (!results) return;

    const loggedUser = localStorage.getItem('valotakim_logged');
    let users = JSON.parse(localStorage.getItem('valotakim_users') || '[]');
    let currentUser = users.find(u => u.username === loggedUser);
    let myRank = currentUser ? currentUser.rank : 'Gümüş 1';
    
    let myRankIndex = rankList.indexOf(myRank);
    let maxRankIndex = Math.min(rankList.length - 1, myRankIndex + 3);
    let minRankIndex = Math.max(0, myRankIndex - 3);

    let matchingUsers = users.filter(u => {
        if(u.username === loggedUser) return false;
        let uRankIdx = rankList.indexOf(u.rank || 'Gümüş 1');
        return uRankIdx >= minRankIndex && uRankIdx <= maxRankIndex;
    });

    let html = `<h3>Senin Rankın: ${myRank} (Eşleşme Aralığı: ${rankList[minRankIndex]} - ${rankList[maxRankIndex]})</h3><div class="rooms" style="margin-top:15px;">`;
    
    if(matchingUsers.length === 0) {
        html += `<p class="muted">Kriterlerine uygun aktif oyuncu bulunamadı.</p>`;
    } else {
        matchingUsers.forEach(u => {
            html += `
                <div class="room-card-custom">
                    <div class="room-left-info">
                        <div class="room-user-avatar"><img src="images/logo.png"></div>
                        <div>
                            <span class="room-username-txt">${u.username} (${u.valorant_id || 'Valorant ID yok'})</span>
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
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    loadRooms();
});