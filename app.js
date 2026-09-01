// ============ GERİ SAYIM SİSTEMİ ============
let countdownIntervals = {};

function startCountdown(roomId, expiresAt) {
  if (countdownIntervals[roomId]) clearInterval(countdownIntervals[roomId]);
  const el = document.getElementById(`countdown-${roomId}`);
  if (!el) return;

  const update = () => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) {
      el.innerHTML = '<span style="color:#ef4444;">⌛ Süre doldu</span>';
      clearInterval(countdownIntervals[roomId]);
      setTimeout(() => loadRooms(), 2000);
      return;
    }
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.innerHTML = `<span style="color:${m < 2 ? '#ef4444' : '#4ade80'}; font-weight:700;">⏱ ${m}:${s.toString().padStart(2, '0')}</span>`;
  };
  update();
  countdownIntervals[roomId] = setInterval(update, 1000);
}

// ============ İLAN KARTI (renderRoomCard) ============
function renderRoomCard(room) {
  const isOwner = currentUser && room.user_id === currentUser.id;
  const isAdmin = currentUser?.is_admin;
  const isJoined = currentUser && room.participants.includes(currentUser.username);
  const agentsHtml = room.agents.map(a => {
    const ag = AGENTS.find(x => x.name === a);
    return ag ? `<img src="${ag.img}" class="mini-agent-img" title="${a}" onerror="this.style.display='none'">` : '';
  }).join('');
  const chatHtml = room.messages.map(m =>
    `<div class="chat-msg-item"><b>${m.sender}</b> (${new Date(m.time).toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'})}): ${m.text}</div>`
  ).join('');
  const participantsHtml = room.participants.map(p =>
    `<div class="participant-row"><div class="participant-info"><div class="participant-avatar">${p[0].toUpperCase()}</div><span>${p}</span></div></div>`
  ).join('');

  setTimeout(() => startCountdown(room.id, room.expires_at), 50);

  return `
  <div class="room-card-custom">
    <div class="room-left-info">
      <div class="room-user-avatar">${room.username[0].toUpperCase()}</div>
      <div>
        <span class="room-username-txt">${room.username}</span>
        <span class="room-rank-txt">${room.rank} • ${room.owner_valorant_id}</span>
      </div>
    </div>
    <div id="countdown-${room.id}" style="font-size:14px; margin:6px 0;">⏱ --:--</div>
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
      ${!isOwner && !isJoined ? `<button class="btn-green-accept" onclick="joinRoom(${room.id})">+ Katıl</button>` : ''}
      ${isJoined ? `<span class="badge" style="background:#1a3a2a; color:#4ade80;">✓ Katıldın</span>` : ''}
      ${(isOwner || isAdmin) ? `<button class="btn-red-reject" onclick="deleteRoom(${room.id})">🗑️ Sil</button>` : ''}
    </div>
    <div class="room-chat-box" style="margin-top:10px;">
      <h4 style="font-size:13px; color:#a855f7;">💬 Sohbet</h4>
      <div class="chat-messages-area" id="chat-${room.id}">${chatHtml || '<p style="color:#666e7b; font-size:12px;">Henüz mesaj yok</p>'}</div>
      <div class="chat-input-row">
        <input type="text" id="msg-${room.id}" placeholder="Mesaj yaz..." onkeypress="if(event.key==='Enter') sendMessage(${room.id})">
        <button class="btn-green-accept" onclick="sendMessage(${room.id})">Gönder</button>
      </div>
    </div>
  </div>`;
}

// ============ ADMIN KULLANICI YÖNETİMİ ============
async function loadAdminUsers() {
  if (!currentUser?.is_admin) { alert('Admin değilsiniz!'); switchPage('home'); return; }
  const data = await apiFetch('/admin/users');
  const container = document.getElementById('admin-users-list');
  if (!container) return;
  if (!data.success || data.users.length === 0) {
    container.innerHTML = '<p style="color:#94a3b8;">Kayıtlı kullanıcı yok.</p>';
    return;
  }
  container.innerHTML = data.users.map(u => `
    <div style="background:#131722; padding:12px; border-radius:8px; margin-bottom:8px; border:1px solid ${u.is_banned ? '#ef4444' : '#303642'}; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <div>
        <b style="color:#a855f7;">${u.username}</b>
        ${u.is_admin ? '<span style="background:#fbbf24; color:#000; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:4px;">ADMIN</span>' : ''}
        ${u.is_banned ? `<span style="background:#ef4444; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:4px;">BANLI</span>` : ''}
        <div style="font-size:12px; color:#94a3b8;">${u.valorant_id || '-'} • ${u.rank} • ${u.role}</div>
        ${u.ban_reason ? `<div style="font-size:11px; color:#ef4444;">Sebep: ${u.ban_reason}</div>` : ''}
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        ${u.is_banned
          ? `<button class="btn-green-accept" onclick="unbanUser(${u.id})">✓ Ban Kaldır</button>`
          : `<button class="btn-red-reject" onclick="banUser(${u.id})">🚫 Banla</button>`}
        ${!u.is_admin ? `<button class="badge" style="background:#1e3a8a; color:#60a5fa; cursor:pointer;" onclick="toggleAdmin(${u.id})">⭐ Admin Yap/Al</button>` : ''}
      </div>
    </div>
  `).join('');
}

async function banUser(id) {
  const reason = prompt('Ban sebebi (boş bırakılabilir):');
  if (reason === null) return;
  const data = await apiFetch(`/admin/users/${id}/ban`, {
    method: 'POST', body: JSON.stringify({ reason })
  });
  if (data.success) { alert('✅ Kullanıcı banlandı'); loadAdminUsers(); loadRooms(); }
  else alert('❌ ' + data.message);
}

async function unbanUser(id) {
  if (!confirm('Banı kaldırmak istediğinize emin misiniz?')) return;
  const data = await apiFetch(`/admin/users/${id}/unban`, { method: 'POST' });
  if (data.success) { alert('✅ Ban kaldırıldı'); loadAdminUsers(); }
  else alert('❌ ' + data.message);
}

async function toggleAdmin(id) {
  if (!confirm('Admin yetkisini değiştirmek istediğinize emin misiniz?')) return;
  const data = await apiFetch(`/admin/users/${id}/toggle-admin`, { method: 'POST' });
  if (data.success) { alert('✅ Güncellendi'); loadAdminUsers(); }
  else alert('❌ ' + data.message);
}

// ============ SAYFA GEÇİŞİ GÜNCELLE ============
function switchPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');
  window.scrollTo(0, 0);
  if (pageId === 'rooms') loadRooms();
  if (pageId === 'profile') loadProfile();
  if (pageId === 'giveaway') loadGiveawayParticipants();
  if (pageId === 'admin') { loadAdminRooms(); loadAdminUsers(); }
  if (pageId === 'home') loadHomeGiveawayParticipants();
}

// ============ GİRİŞ HATASI BAN KONTROLÜ ============
async function login() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  if (!username || !password) { alert('Kullanıcı adı ve şifre gerekli!'); return; }
  const data = await fetch(API_URL + '/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  }).then(r => r.json());
  if (data.success) {
    setToken(data.token);
    currentUser = data.user;
    showLoggedIn();
    alert('✅ Giriş başarılı! Hoş geldin, ' + data.user.username);
    switchPage('home');
  } else {
    alert('❌ ' + (data.message || 'Giriş hatası'));
  }
}