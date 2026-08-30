/* =====================================================
   VALO TAKIM - FRONTEND
===================================================== */

const API_BASE = "/api";

let currentUser = null;
let authToken = localStorage.getItem("valo_token") || "";
let currentRoomId = null;

async function apiRequest(endpoint, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    let data;
    try {
        data = await response.json();
    } catch {
        data = { success: false, message: "Sunucudan geçersiz cevap geldi." };
    }

    if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
    }
    return data;
}

function showPage(pageId) {
    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
    });
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.add("active");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (pageId === "one") loadRooms();
    if (pageId === "profile") loadProfile();
}

function requireLogin(page) {
    if (!authToken) {
        localStorage.setItem("valo_after_login", page);
        showPage("login");
        alert("Bu bölümü kullanmak için önce giriş yapmalısın.");
        return;
    }
    showPage(page);
}

function updateAuthUI() {
    const loginNav = document.getElementById("loginNav");
    const registerNav = document.getElementById("registerNav");
    const logoutNav = document.getElementById("logoutNav");
    const profileNav = document.getElementById("profileNav");

    if (authToken) {
        if (loginNav) loginNav.style.display = "none";
        if (registerNav) registerNav.style.display = "none";
        if (logoutNav) logoutNav.style.display = "";
        if (profileNav) profileNav.style.display = "";
    } else {
        if (loginNav) loginNav.style.display = "";
        if (registerNav) registerNav.style.display = "";
        if (logoutNav) logoutNav.style.display = "none";
        if (profileNav) profileNav.style.display = "none";
    }
}

/* Maç Geçmişi Renklendirme (G: Yeşil, B: Sarı, M: Kırmızı) */
function renderMatchBadges(matchesStr) {
    if (!matchesStr) return "-";
    return matchesStr.split('').map(char => {
        let colorClass = 'match-green'; // G
        if (char === 'B') colorClass = 'match-yellow';
        if (char === 'M') colorClass = 'match-red';
        return `<span class="match-badge ${colorClass}">${char}</span>`;
    }).join(' ');
}

/* REGISTER */
async function register() {
    const username = document.getElementById("regUser")?.value.trim();
    const valorant_id = document.getElementById("regId")?.value.trim();
    const rank = document.getElementById("regRank")?.value;
    const role = document.getElementById("regRole")?.value;
    const password = document.getElementById("regPassword")?.value;
    const password2 = document.getElementById("regPass2")?.value;
    const terms = document.getElementById("regTerms")?.checked;

    if (!username || !valorant_id || !rank || !role || !password) {
        alert("Lütfen tüm alanları doldur.");
        return;
    }
    if (password !== password2) {
        alert("Şifreler aynı değil.");
        return;
    }
    if (!terms) {
        alert("Kullanım şartlarını kabul etmelisin.");
        return;
    }

    try {
        const data = await apiRequest("/register", {
            method: "POST",
            body: JSON.stringify({ username, valorant_id, rank, role, password, agent: "Jett" })
        });
        alert(data.message || "Kayıt başarılı!");
        showPage("login");
    } catch (error) {
        alert(error.message);
    }
}

/* LOGIN */
async function login() {
    const username = document.getElementById("loginUser")?.value.trim();
    const password = document.getElementById("loginPassword")?.value;

    if (!username || !password) {
        alert("Kullanıcı adı ve şifre gerekli.");
        return;
    }

    try {
        const data = await apiRequest("/login", {
            method: "POST",
            body: JSON.stringify({ username, password })
        });

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem("valo_token", authToken);
        localStorage.setItem("valo_user", JSON.stringify(currentUser));

        updateAuthUI();
        alert("Giriş başarılı!");

        const afterLogin = localStorage.getItem("valo_after_login");
        localStorage.removeItem("valo_after_login");
        showPage(afterLogin || "home");
    } catch (error) {
        alert(error.message);
    }
}

function logout() {
    authToken = "";
    currentUser = null;
    localStorage.removeItem("valo_token");
    localStorage.removeItem("valo_user");
    updateAuthUI();
    showPage("home");
}

/* PROFİL */
async function loadProfile() {
    if (!authToken) {
        showPage("login");
        return;
    }
    try {
        const data = await apiRequest("/profile");
        currentUser = data.user;
        fillProfile(currentUser);
    } catch (error) {
        if (error.message.includes("Oturum")) logout();
    }
}

function fillProfile(user) {
    const username = document.getElementById("profileUsername");
    const profileUser = document.getElementById("profileUser");
    const valorantId = document.getElementById("profileValorantId");
    const rank = document.getElementById("profileRank");
    const role = document.getElementById("profileRole");
    const letter = document.getElementById("profileLetter");

    if (username) username.textContent = user.username;
    if (profileUser) profileUser.value = user.username;
    if (valorantId) valorantId.value = user.valorant_id || "";
    if (rank) rank.value = user.rank;
    if (role) role.value = user.role;
    if (letter) letter.textContent = user.username?.charAt(0)?.toUpperCase() || "?";
}

async function updateProfile() {
    const valorant_id = document.getElementById("profileValorantId")?.value.trim();
    const rank = document.getElementById("profileRank")?.value;
    const role = document.getElementById("profileRole")?.value;
    const password = document.getElementById("profilePassword")?.value;
    const status = document.getElementById("profileStatus");

    try {
        const data = await apiRequest("/profile", {
            method: "PUT",
            body: JSON.stringify({ valorant_id, rank, role, password })
        });
        currentUser = data.user;
        localStorage.setItem("valo_user", JSON.stringify(currentUser));
        if (status) status.textContent = "Profil başarıyla güncellendi.";
        loadRooms();
    } catch (error) {
        if (status) status.textContent = error.message;
    }
}

/* 1 KİŞİ LAZIM & İLANLAR */
async function loadRooms() {
    if (!authToken) return;
    const roomsElement = document.getElementById("rooms");
    if (!roomsElement) return;

    roomsElement.innerHTML = `<div class="form-card">İlanlar yükleniyor...</div>`;

    try {
        const data = await apiRequest("/rooms");
        renderRooms(data);
    } catch (error) {
        roomsElement.innerHTML = `<div class="form-card"><h3>İlanlar alınamadı</h3><p>${escapeHtml(error.message)}</p></div>`;
    }
}

function renderRooms(data) {
    const roomsElement = document.getElementById("rooms");
    if (!roomsElement) return;

    if (!data.rooms || data.rooms.length === 0) {
        roomsElement.innerHTML = `<div class="form-card"><h3>Uygun ilan bulunamadı.</h3></div>`;
        return;
    }

    roomsElement.innerHTML = data.rooms.map(room => `
        <div class="room-card" style="background:#18181b; padding:15px; border-radius:8px; margin-bottom:15px; border:1px solid #27272a;">
            <div class="room-card-head" style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h3>${escapeHtml(room.username)}</h3>
                    <p class="muted">${escapeHtml(room.rank)} • ${escapeHtml(room.role)}</p>
                    <p style="margin-top:5px;">Son 5 Maç: ${renderMatchBadges(room.matches)}</p>
                </div>
                <button class="primary" onclick="joinRoom(${room.id})">Takıma Katıl</button>
            </div>
            <p style="margin-top:10px;">${escapeHtml(room.description || "Açıklama yok.")}</p>
        </div>
    `).join("");
}

async function createRoom() {
    if (!authToken) { showPage("login"); return; }
    const role = document.getElementById("roomRole")?.value;
    const mode = document.getElementById("roomMode")?.value;
    const age = document.getElementById("roomAge")?.value;
    const microphone = document.getElementById("roomMic")?.checked;
    const description = document.getElementById("roomDescription")?.value.trim();

    try {
        await apiRequest("/rooms", {
            method: "POST",
            body: JSON.stringify({ role, mode, age, microphone, description })
        });
        alert("İlan oluşturuldu.");
        showPage("one");
        loadRooms();
    } catch (error) {
        alert(error.message);
    }
}

function joinRoom(roomId) {
    currentRoomId = roomId;
    showPage("room");
    const messages = document.getElementById("messages");
    if (messages) {
        messages.innerHTML = `<div><b>Sistem</b><span>Odaya hoş geldiniz. Karşılaştırmalı analiz aktif.</span></div>`;
    }
}

/* 5'Lİ TAKIM */
async function startMatch() {
    if (!authToken) { showPage("login"); return; }
    const status = document.getElementById("matchStatus");
    if (status) status.innerHTML = `<p>🔎 Oyuncular aranıyor...</p>`;

    try {
        const data = await apiRequest("/matchmaking");
        let playersHtml = data.players.map(p => `
            <div class="member" style="margin-bottom:10px;">
                <b>${escapeHtml(p.username)}</b>
                <small>${escapeHtml(p.rank)} • ${escapeHtml(p.role)}</small>
                <em>Valorant ID: ${escapeHtml(p.valorant_id)}</em>
            </div>
        `).join("");

        status.innerHTML = `
            <div>
                <h3>${data.teamReady ? "🎉 5 Kişilik Takım Hazır!" : "Oyuncu Aranıyor"}</h3>
                <div class="team" style="margin-top:15px;">${playersHtml}</div>
            </div>
        `;
    } catch (error) {
        if (status) status.innerHTML = `<p>❌ ${escapeHtml(error.message)}</p>`;
    }
}

function sendMsg() {
    const input = document.getElementById("msg");
    const messages = document.getElementById("messages");
    if (!input || !messages) return;
    const text = input.value.trim();
    if (!text) return;

    const username = currentUser?.username || "Sen";
    const div = document.createElement("div");
    div.innerHTML = `<b>${escapeHtml(username)}</b> <span>${escapeHtml(text)}</span>`;
    messages.appendChild(div);
    input.value = "";
    messages.scrollTop = messages.scrollHeight;
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function init() {
    updateAuthUI();
    if (authToken) {
        try {
            const data = await apiRequest("/profile");
            currentUser = data.user;
            localStorage.setItem("valo_user", JSON.stringify(currentUser));
            updateAuthUI();
        } catch {
            logout();
        }
    }
}

document.addEventListener("DOMContentLoaded", () => { init(); });