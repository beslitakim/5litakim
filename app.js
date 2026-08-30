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
    
    // Varsayılan admin hesabı kontrolü
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
        
        // Eğer giriş yapan admin ise admin panel butonunu göster
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
        agents: selectedAgents
    };

    let rooms = JSON.parse(localStorage.getItem('valotakim_rooms') || '[]');
    rooms.unshift(newRoom);
    localStorage.setItem('valotakim_rooms', JSON.stringify(rooms));

    alert('İlan başarıyla yayınlandı!');
    switchPage('rooms');
    loadRooms();
}

// İlanları Listeleme
function loadRooms() {
    const roomsList = document.getElementById('rooms-list');
    if (!roomsList) return;
    
    let rooms = JSON.parse(localStorage.getItem('valotakim_rooms') || '[]');
    
    let html = '';
    if(rooms.length === 0) {
        html = `<p class="muted" style="text-align:center; padding:20px;">Henüz aktif ilan bulunmuyor.</p>`;
    } else {
        rooms.forEach((room) => {
            let agentImgs = '';
            if(room.agents.includes('farketmez')) {
                agentImgs = `<span class="badge" style="background:#a855f7; color:#fff;">FARKETMEZ</span>`;
            } else {
                agentImgs = room.agents.map(aId => `<img src="images/agent${aId}.png" class="mini-agent-img" onerror="this.src='images/logo.png'">`).join('');
            }
            
            html += `
                <div class="room-card-custom">
                    <div class="room-left-info">
                        <div class="room-user-avatar">
                            <img src="images/logo.png" alt="Logo">
                        </div>
                        <div>
                            <span class="room-username-txt">${room.user}</span>
                            <span class="room-rank-txt">Rank: ${room.rank}</span>
                        </div>
                    </div>
                    
                    <div class="room-middle-agents">
                        ${agentImgs}
                    </div>

                    <div class="room-right-action">
                        <span class="badge red">${room.mode}</span>
                        <button class="primary small" onclick="alert('${room.user} adlı kullanıcının odasına katılma isteği gönderildi!')">Odaya Katıl</button>
                    </div>
                </div>
            `;
        });
    }
    roomsList.innerHTML = html;
}

// ADMIN PANELİ VERİLERİNİ YÜKLEME VE SİLME FONKSİYONLARI
function loadAdminData() {
    // İlanlar
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

    // Kullanıcılar
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

// Rank Sıralaması Listesi
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

// 5'li Takım Bul
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