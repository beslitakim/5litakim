const API_URL = window.location.origin + "/api";
let currentUser = null;
let selectedAgents = [];

const AGENTS = [
  { name: "Jett", img: "https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png" },
  { name: "Reyna", img: "https://media.valorant-api.com/agents/a3b2d30d-40b0-4d04-b801-6c3c70c2769e/displayicon.png" },
  { name: "Phoenix", img: "https://media.valorant-api.com/agents/eb93336a-449b-8c1c-0577-4c8b8e1a8c3e/displayicon.png" },
  { name: "Raze", img: "https://media.valorant-api.com/agents/f94c3b30-42be-e959-889c-5ab3e1c8e1c0/displayicon.png" },
  { name: "Yoru", img: "https://media.valorant-api.com/agents/7f94d92c-4234-0a36-9646-3a87eb8b5c89/displayicon.png" },
  { name: "Neon", img: "https://media.valorant-api.com/agents/bb2a4828-46eb-8cd1-e765-15848195b751/displayicon.png" },
  { name: "Omen", img: "https://media.valorant-api.com/agents/8e253930-4c05-31dd-1b0c-9c8b8e1a8c3e/displayicon.png" },
  { name: "Viper", img: "https://media.valorant-api.com/agents/707eab51-4836-f488-047c-9c8b8e1a8c3e/displayicon.png" },
  { name: "Astra", img: "https://media.valorant-api.com/agents/41fb69c1-4189-7b37-f117-bcaf1e9c8e1c/displayicon.png" },
  { name: "Harbor", img: "https://media.valorant-api.com/agents/95b78ed7-4637-86d9-7e41-da0c8b8e1a8c/displayicon.png" },
  { name: "Clove", img: "https://media.valorant-api.com/agents/1e58de9c-4950-5125-8c8b-8c8b8e1a8c3e/displayicon.png" },
  { name: "Sova", img: "https://media.valorant-api.com/agents/320b2a48-4d9b-a075-30f1-1f9c8b8e1a8c/displayicon.png" },
  { name: "Breach", img: "https://media.valorant-api.com/agents/5f8d3a7f-467b-7f35-8c8b-8c8b8e1a8c3e/displayicon.png" },
  { name: "Skye", img: "https://media.valorant-api.com/agents/6f2a04ca-43e0-be8c-0e0c-8c8b8e1a8c3e/displayicon.png" },
  { name: "KAY/O", img: "https://media.valorant-api.com/agents/601dbbe7-4b67-4c05-8c8b-8c8b8e1a8c3e/displayicon.png" },
  { name: "Fade", img: "https://media.valorant-api.com/agents/dadfe7c7-4950-5125-8c8b-8c8b8e1a8c3e/displayicon.png" },
  { name: "Gekko", img: "https://media.valorant-api.com/agents/e370fa57-4757-3604-3648-8c8b8e1a8c3e/displayicon.png" },
  { name: "Killjoy", img: "https://media.valorant-api.com/agents/1e58de9c-4950-5125-8c8b-8c8b8e1a8c3e/displayicon.png" },
  { name: "Cypher", img: "https://media.valorant-api.com/agents/117ed9e3-49f3-6512-3ccf-0cada8e1a8c3/displayicon.png" },
  { name: "Sage", img: "https://media.valorant-api.com/agents/569fdd95-4d10-43ab-ca70-79becc718b46/displayicon.png" },
  { name: "Chamber", img: "https://media.valorant-api.com/agents/22697a3d-45bf-8dd7-4fec-8c8b8e1a8c3e/displayicon.png" },
  { name: "Deadlock", img: "https://media.valorant-api.com/agents/cc8b8e1a-4950-5125-8c8b-8c8b8e1a8c3e/displayicon.png" },
];

const RANKS = [
  "Demir 1","Demir 2","Demir 3","Bronz 1","Bronz 2","Bronz 3",
  "Gümüş 1","Gümüş 2","Gümüş 3","Altın 1","Altın 2","Altın 3",
  "Platin 1","Platin 2","Platin 3","Elmas 1","Elmas 2","Elmas 3",
  "Yücelik 1","Yücelik 2","Yücelik 3","Ölümsüzlük 1","Ölümsüzlük 2","Ölümsüzlük 3","Radiant"
];

function getToken() { return localStorage.getItem('valotakim_token'); }
function setToken(t) { localStorage.setItem('valotakim_token', t); }
function clearToken() { localStorage.removeItem('valotakim_token'); }

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

async function apiFetch(url, options = {}) {
  const res = await fetch(API_URL + url, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  return await res.json();
}

// ============ SAYFA GEÇİŞİ ============
function switchPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');
  window.scrollTo(0, 0);

  if (pageId === 'rooms') loadRooms();
  if (pageId === 'profile') loadProfile();
  if (pageId === 'giveaway') loadGiveawayParticipants();
  if (pageId === 'admin') loadAdminRooms();
  if (pageId === 'home') loadHomeGiveawayParticipants();
}

// ============ AUTH ============
async function checkAuthState() {
  const token = getToken();
  if (!token) { showLoggedOut(); return; }
  try {
    const res = await fetch(API_URL + '/profile', { headers: { 'Authorization': `Bearer ${token}` } });
    const result = await res.json();
    if (result.success) {
      currentUser = result.user;
      showLoggedIn();
    } else {
      clearToken();
      showLoggedOut();
    }
  } catch (e) { showLoggedOut(); }
}

function showLoggedIn() {
  document.getElementById('nav-login-btn').style.display = 'none';
  document.getElementById('nav-register-btn').style.display = 'none';
  document.getElementById('nav-profile-btn').style.display = 'inline-block';
  document.getElementById('nav-logout-btn').style.display = 'inline-block';
  document.getElementById('nav-admin-btn').style.display = currentUser?.is_admin ? 'inline-block' : 'none';
}

function showLoggedOut() {
  document.getElementById('nav-login-btn').style.display = 'inline-block';
  document.getElementById('nav-register-btn').style.display = 'inline-block';
  document.getElementById('nav-profile-btn').style.display = 'none';
  document.getElementById('nav-logout-btn').style.display = 'none';
  document.getElementById('nav-admin-btn').style.display = 'none';
}

function logout() {
  clearToken();
  currentUser = null;
  showLoggedOut();
  switchPage('home');
}

// ============ KAYIT ============
async function register() {
  const username = document.getElementById('reg-user').value.trim();
  const valName = document.getElementById('reg-valname').value.trim();
  const valTag = document.getElementById('reg-valtag').value.trim();
  const rank = document.getElementById('reg-rank').value;
  const role = document.getElementById('reg-role').value;
  const password = document.getElementById('reg-pass').value;
  const passwordConfirm = document.getElementById('reg-pass2').value;

  if (!username || !valName || !valTag || !password) {
    alert('Tüm alanları doldurun!'); return;
  }

  try {
    const res = await fetch(API_URL + '/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, valName, valTag, rank, role, password, passwordConfirm })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Kayıt başarılı! Kullanıcı adınız: ${data.username}`);
      switchPage('login');
    } else {
      alert(data.message || 'Kayıt hatası');
    }
  } catch (e) {
    alert('Sunucuya bağlanılamadı: ' + e.message);
  }
}

// ============ GİRİŞ ============
async function login() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  if (!username || !password) { alert('Tüm alanları doldurun!'); return; }

  try {
    const res = await fetch(API_URL + '/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      setToken(data.token);
      currentUser = data.user;
      showLoggedIn();
      alert('Giriş başarılı!');
      switchPage('home');
    } else {
      alert(data.message || 'Giriş hatası');
    }
  } catch (e) {
    alert('Sunucuya bağlanılamadı: ' + e.message);
  }
}

// ============ PROFİL ============
async function loadProfile() {
  if (!getToken()) { switchPage('login'); return; }
  const data = await apiFetch('/profile');
  if (data.success) {
    currentUser = data.user;
    document.getElementById('prof-username').value = data.user.username;
    document.getElementById('prof-valorant').value = data.user.valorant_id;
    document.getElementById('prof-rank').value = data.user.rank;
    document.getElementById('prof-role').value = data.user.role;
  }
}

async function updateProfile() {
  const valorant_id = document.getElementById('prof-valorant').value.trim();
  const rank = document.getElementById('prof-rank').value;
  const role = document.getElementById('prof-role').value;
  const data = await apiFetch('/profile', {
    method: 'PUT',
    body: JSON.stringify({ valorant_id, rank, role })
  });
  if (data.success) {
    alert('Profil güncellendi!');
    loadProfile();
  }
}

// ============ İLANLAR ============
async function loadRooms() {
  const data = await apiFetch('/rooms');
  const container = document.getElementById('rooms-list');
  if (!container) return;
  if (!data.success || !data.rooms) { container.innerHTML = '<p>Yüklenemedi</p>'; return; }

  const filter = document.getElementById('room-filter')?.value || 'all';
  let rooms = data.rooms;
  if (filter !== 'all') rooms = rooms.filter(r => r.owner_role === filter);

  if (rooms.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:40px;">Henüz ilan yok. İlk ilan sen oluştur!</p>';
    return;
  }
  container.innerHTML = rooms.map(r => renderRoomCard(r)).join('');
}

function renderRoomCard(room) {
  const isOwner = currentUser && room.user_id === currentUser.id;
  const isJoined = currentUser && room.participants.includes(currentUser.username);
  const agentsHtml = room.agents.map(a => {
    const ag = AGENTS.find(x => x.name === a);
    return ag ? `<img src="${ag.img}" class="mini-agent-img" title="${a}" onerror="this.style.display='none'">` : '';
  }).join('');

  const chatHtml = room.messages.map(m =>
    `<div class="chat-msg-item"><b>${m.sender}</b> (${m.time}): ${m.text}</div>`
  ).join('');

  const participantsHtml = room.participants.map(p =>
    `<div class="participant-row"><div class="participant-info"><div class="participant-avatar">${p[0].toUpperCase()}</div><span>${p}</span></div></div>`
  ).join('');

  return `
    <div class="room-card-custom">
      <div class="room-left-info">
        <div class="room-user-avatar">${room.username[0].toUpperCase()}</div>
        <div>
          <span class="room-username-txt">${room.username}</span>
          <span class="room-rank-txt">${room.rank} • ${room.owner_valorant_id}</span>
        </div>
      </div>
      <div class="room-middle-agents">${agentsHtml || '<span style="color:#666e7b; font-size:12px;">Ajan seçilmedi</span>'}</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <span class="badge">${room.mode}</span>
        <span class="badge">${room.age}</span>
        <span class="badge ${room.microphone ? 'green' : 'red'}">${room.microphone ? '🎤 Mikrofon: EVET' : '🔇 Mikrofon: HAYIR'}</span>
      </div>
      ${room.description ? `<p style="color:#cbd5e1; font-size:13px; background:#090b10; padding:10px; border-radius:8px;">${room.description}</p>` : ''}
      <div style="border-top:1px solid #262c37; padding-top:12px;">
        <h4 style="font-size:13px; margin-bottom:8px; color:#a855f7;">👥 Katılımcılar (${room.participants.length + 1}/5)</h4>
        <div class="participants-management-list">
          <div class="participant-row">
            <div class="participant-info">
              <div class="participant-avatar" style="background:#ef4444;">${room.username[0].toUpperCase()}</div>
              <span><b>${room.username}</b> (Kurucu)</span>
            </div>
          </div>
          ${participantsHtml}
        </div>
      </div>
      <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
        ${!isOwner && !isJoined ? `<button class="btn-join" onclick="joinRoom(${room.id})">+ Katıl</button>` : ''}
        ${isJoined ? `<span class="badge green">✓ Katıldın</span>` : ''}
      </div>
      <div class="room-chat-box" style="margin-top:10px;">
        <h4 style="font-size:13px; color:#a855f7;">💬 Sohbet</h4>
        <div class="chat-messages-area" id="chat-${room.id}">${chatHtml || '<p style="color:#666e7b; font-size:12px;">Henüz mesaj yok</p>'}</div>
        <div class="chat-input-row">
          <input type="text" id="msg-${room.id}" placeholder="Mesaj yaz..." onkeypress="if(event.key==='Enter') sendMessage(${room.id})">
          <button class="btn-join" onclick="sendMessage(${room.id})">Gönder</button>
        </div>
      </div>
    </div>
  `;
}

function openCreateRoom() {
  if (!getToken()) { alert('Önce giriş yapın!'); switchPage('login'); return; }
  selectedAgents = [];
  renderAgentPicker();
  document.getElementById('create-room-modal').classList.add('active');
}

function closeCreateRoom() {
  document.getElementById('create-room-modal').classList.remove('active');
}

function renderAgentPicker() {
  const container = document.getElementById('agent-picker');
  if (!container) return;
  container.innerHTML = AGENTS.map((a, i) => {
    const selected = selectedAgents.includes(a.name);
    const idx = selectedAgents.indexOf(a.name);
    return `
      <div class="agent-pick-box ${selected ? 'selected' : ''}" onclick="toggleAgent('${a.name}')">
        <img src="${a.img}" onerror="this.style.display='none'">
        <span class="agent-name-label">${a.name}</span>
        ${selected ? `<span class="pick-badge">${idx + 1}</span>` : ''}
      </div>
    `;
  }).join('');
}

function toggleAgent(name) {
  const idx = selectedAgents.indexOf(name);
  if (idx > -1) {
    selectedAgents.splice(idx, 1);
  } else {
    if (selectedAgents.length >= 3) { alert('En fazla 3 ajan seçebilirsiniz!'); return; }
    selectedAgents.push(name);
  }
  renderAgentPicker();
}

async function createRoom() {
  const mode = document.getElementById('room-mode').value;
  const age = document.getElementById('room-age').value;
  const description = document.getElementById('room-desc').value;
  const microphone = document.getElementById('room-mic').checked;

  const data = await apiFetch('/rooms', {
    method: 'POST',
    body: JSON.stringify({ mode, age, description, agents: selectedAgents, microphone })
  });

  if (data.success) {
    alert('İlan oluşturuldu!');
    closeCreateRoom();
    document.getElementById('room-desc').value = '';
    loadRooms();
  }
}

async function joinRoom(id) {
  const data = await apiFetch(`/rooms/${id}/join`, { method: 'POST' });
  if (data.success) { alert('İlana katıldın!'); loadRooms(); }
}

async function sendMessage(roomId) {
  const input = document.getElementById(`msg-${roomId}`);
  const message = input.value.trim();
  if (!message) return;
  const data = await apiFetch(`/rooms/${roomId}/message`, {
    method: 'POST', body: JSON.stringify({ message })
  });
  if (data.success) {
    input.value = '';
    loadRooms();
  }
}

// ============ 5'Lİ TAKIM ============
let matchmakingInterval = null;

async function startMatchmaking() {
  if (!getToken()) { alert('Önce giriş yapın!'); switchPage('login'); return; }
  
  const btn = document.getElementById('match-btn');
  const status = document.getElementById('match-status');
  const result = document.getElementById('match-result');
  
  btn.disabled = true;
  btn.textContent = '⏳ Aranıyor...';
  result.innerHTML = '';
  status.innerHTML = '<p style="margin-top:15px; color:#a855f7;">Rankına uygun takım arkadaşları aranıyor...</p>';

  const tryMatch = async () => {
    const data = await apiFetch('/matchmaking/join', { method: 'POST' });
    if (data.matched) {
      clearInterval(matchmakingInterval);
      btn.disabled = false;
      btn.textContent = '🔎 Eşleşme Ara';
      status.innerHTML = '<p style="color:#4ade80; font-weight:800;">✅ TAKIM BULUNDU!</p>';
      result.innerHTML = `
        <div class="match-team-card">
          <h3 style="color:#a855f7; margin-bottom:15px;">🎉 5'li Takımın Hazır!</h3>
          ${data.team.map(t => `
            <div class="match-team-member">
              <span><b>${t.username}</b></span>
              <span style="color:#a855f7;">${t.rank} • ${t.role}</span>
            </div>
          `).join('')}
          <button class="primary wide" style="margin-top:15px;" onclick="switchPage('rooms')">📋 Takım İlanını Gör</button>
        </div>
      `;
    } else {
      status.innerHTML = `<p style="margin-top:15px; color:#a855f7;">Kuyrukta ${data.waiting}/5 kişi bekliyor...</p>`;
    }
  };

  await tryMatch();
  matchmakingInterval = setInterval(tryMatch, 3000);
}

// ============ ÇEKİLİŞ ============
async function loadGiveawayParticipants() {
  const container = document.getElementById('giveaway-participants-list');
  if (!container) return;
  const data = await fetch(API_URL + '/giveaway').then(r => r.json());
  if (!data.success || data.participants.length === 0) {
    container.innerHTML = `<p style="color:#94a3b8; text-align:center; padding:20px;">Henüz kimse katılmadı. İlk katılan sen ol!</p>`;
    return;
  }
  container.innerHTML = data.participants.map((p, i) => `
    <div style="background:#131722; padding:10px 15px; border-radius:8px; border:1px solid #303642; display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <span style="font-weight:700; color:#a855f7;">#${i + 1} - ${p.username}</span>
      <span style="font-size:12px; color:#4ade80;">Katıldı ✓</span>
    </div>
  `).join('');
}

async function loadHomeGiveawayParticipants() {
  const container = document.getElementById('home-giveaway-participants');
  if (!container) return;
  const data = await fetch(API_URL + '/giveaway').then(r => r.json());
  if (!data.success || data.participants.length === 0) {
    container.innerHTML = `<p style="color:#94a3b8; font-size:12px; text-align:center; padding:10px;">Henüz katılan yok.</p>`;
    return;
  }
  container.innerHTML = data.participants.slice(0, 10).map((p, i) => `
    <div class="participant-item-row">
      <span>#${i + 1} - ${p.username}</span>
      <span style="color:#4ade80; font-size:11px;">✓</span>
    </div>
  `).join('');
}

async function joinGiveaway() {
  if (!getToken()) {
    alert('Çekilişe katılabilmek için önce giriş yapmalısınız!');
    switchPage('login');
    return;
  }
  const res = await fetch(API_URL + '/giveaway/join', { method: 'POST', headers: authHeaders() });
  const data = await res.json();
  if (data.success) {
    alert('Tebrikler! Çekilişe başarıyla katıldınız. 🎉');
    loadGiveawayParticipants();
    loadHomeGiveawayParticipants();
  } else {
    alert(data.message || 'Zaten katıldınız veya hata oluştu.');
  }
}

// ============ ADMIN ============
async function loadAdminRooms() {
  if (!currentUser?.is_admin) { alert('Admin değilsiniz!'); switchPage('home'); return; }
  const data = await apiFetch('/admin/rooms');
  const container = document.getElementById('admin-rooms-list');
  if (!data.success || data.rooms.length === 0) {
    container.innerHTML = '<p style="color:#94a3b8;">Aktif ilan yok.</p>';
    return;
  }
  container.innerHTML = data.rooms.map(r => `
    <div style="background:#131722; padding:12px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; border:1px solid #303642;">
      <div>
        <b style="color:#a855f7;">#${r.id}</b> - ${r.username} • ${r.mode} • ${r.age}
      </div>
      <button class="btn-delete" onclick="adminDeleteRoom(${r.id})">🗑️ Sil</button>
    </div>
  `).join('');
}

async function adminDeleteRoom(id) {
  if (!confirm('İlanı silmek istediğinize emin misiniz?')) return;
  const data = await apiFetch(`/admin/rooms/${id}`, { method: 'DELETE' });
  if (data.success) loadAdminRooms();
}

// ============ RANK SELECT ============
function fillRankSelects() {
  ['reg-rank', 'prof-rank'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = RANKS.map(r => `<option value="${r}">${r}</option>`).join('');
  });
}

// ============ BAŞLAT ============
document.addEventListener('DOMContentLoaded', () => {
  fillRankSelects();
  checkAuthState();
  loadHomeGiveawayParticipants();
});