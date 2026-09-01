// Çekiliş Sayfası Kontrolü ve Katılımcı Listeleme
function loadGiveawayParticipants() {
    const container = document.getElementById('giveaway-participants-list');
    if (!container) return;

    let participants = JSON.parse(localStorage.getItem('valotakim_giveaway_users') || '[]');
    
    if (participants.length === 0) {
        container.innerHTML = `<p class="muted" style="font-size: 14px;">Henüz kimse katılmadı. İlk katılan sen ol!</p>`;
        return;
    }

    let html = '';
    participants.forEach((user, index) => {
        html += `
            <div style="background: #131722; padding: 10px 15px; border-radius: 8px; border: 1px solid #303642; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 700; color: #a855f7;">#${index + 1} - ${user}</span>
                <span style="font-size: 12px; color: #4ade80;">Katıldı ✓</span>
            </div>
        `;
    });
    container.innerHTML = html;
}

async function joinGiveaway() {
    const token = getToken();
    if (!token) {
        alert('Çekilişe katılabilmek için önce giriş yapmalısınız!');
        switchPage('login');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
        const result = await res.json();
        
        if (result.success && result.user) {
            let username = result.user.username;
            let participants = JSON.parse(localStorage.getItem('valotakim_giveaway_users') || '[]');
            
            if (participants.includes(username)) {
                alert('Zaten bu çekilişe katıldınız!');
                return;
            }

            participants.push(username);
            localStorage.setItem('valotakim_giveaway_users', JSON.stringify(participants));
            alert('Tebrikler! Çekilişe başarıyla katıldınız.');
            loadGiveawayParticipants();
        }
    } catch (err) {
        alert('Katılım sırasında bir hata oluştu.');
    }
}

// switchPage fonksiyonunun içine şu kontrolü eklediğinden emin ol:
// if (pageId === 'giveaway') loadGiveawayParticipants();// === ÇEKİLİŞ (ANA SAYFA SAĞ PANEL) ===
function loadHomeGiveawayParticipants() {
    const container = document.getElementById('home-giveaway-participants');
    if (!container) return;

    let participants = JSON.parse(localStorage.getItem('valotakim_giveaway_users') || '[]');
    
    if (participants.length === 0) {
        container.innerHTML = `<p class="muted" style="font-size: 12px; text-align: center; padding: 10px;">Henüz katılan yok.</p>`;
        return;
    }

    let html = '';
    participants.forEach((user, index) => {
        html += `
            <div class="participant-item-row">
                <span>#${index + 1} - ${user}</span>
                <span style="color: #4ade80; font-size: 11px;">Katıldı ✓</span>
            </div>
        `;
    });
    container.innerHTML = html;
}

async function joinGiveaway() {
    const token = getToken();
    if (!token) {
        alert('Çekilişe katılabilmek için önce giriş yapmalısınız!');
        switchPage('login');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
        const result = await res.json();
        
        if (result.success && result.user) {
            let username = result.user.username;
            let participants = JSON.parse(localStorage.getItem('valotakim_giveaway_users') || '[]');
            
            if (participants.includes(username)) {
                alert('Zaten bu çekilişe katıldınız!');
                return;
            }

            participants.push(username);
            localStorage.setItem('valotakim_giveaway_users', JSON.stringify(participants));
            alert('Tebrikler! Çekilişe başarıyla katıldınız.');
            loadHomeGiveawayParticipants();
        }
    } catch (err) {
        alert('Katılım sırasında bir hata oluştu.');
    }
}

// DOM Yüklendiğinde listeyi çağır
document.addEventListener('DOMContentLoaded', () => { 
    checkAuthState(); 
    loadHomeGiveawayParticipants();
    if(document.getElementById('rooms-list')) loadRooms(); 
});