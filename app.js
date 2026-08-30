/* =====================================================
   VALO TAKIM - FRONTEND
===================================================== */

// Canlı ortamda ve localde sorunsuz çalışması için dinamik API kök yolu
const API_BASE = "/api";


/* =====================================================
   GLOBAL
===================================================== */

let currentUser = null;
let authToken = localStorage.getItem("valo_token") || "";

let currentRoomId = null;


/* =====================================================
   API
===================================================== */

async function apiRequest(
    endpoint,
    options = {}
) {

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (authToken) {

        headers.Authorization =
            `Bearer ${authToken}`;

    }

    const response =
        await fetch(
            `${API_BASE}${endpoint}`,
            {
                ...options,
                headers
            }
        );

    let data;

    try {

        data =
            await response.json();

    }

    catch {

        data = {
            success: false,
            message: "Sunucudan geçersiz cevap geldi."
        };

    }

    if (!response.ok) {

        throw new Error(
            data.message ||
            `HTTP ${response.status}`
        );

    }

    return data;
}


/* =====================================================
   SAYFA
===================================================== */

function showPage(pageId) {

    document
        .querySelectorAll(".page")
        .forEach(page => {

            page.classList.remove("active");

        });

    const page =
        document.getElementById(pageId);

    if (page) {

        page.classList.add("active");

    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    if (pageId === "one") {

        loadRooms();

    }

    if (pageId === "profile") {

        loadProfile();

    }

}


/* =====================================================
   LOGIN GEREKLİ
===================================================== */

function requireLogin(page) {

    if (!authToken) {

        localStorage.setItem(
            "valo_after_login",
            page
        );

        showPage("login");

        alert(
            "Bu bölümü kullanmak için önce giriş yapmalısın."
        );

        return;

    }

    showPage(page);

}


/* =====================================================
   UI AUTH
===================================================== */

function updateAuthUI() {

    const loginNav =
        document.getElementById("loginNav");

    const registerNav =
        document.getElementById("registerNav");

    const logoutNav =
        document.getElementById("logoutNav");

    const profileNav =
        document.getElementById("profileNav");

    if (authToken) {

        if (loginNav)
            loginNav.style.display = "none";

        if (registerNav)
            registerNav.style.display = "none";

        if (logoutNav)
            logoutNav.style.display = "";

        if (profileNav)
            profileNav.style.display = "";

    }

    else {

        if (loginNav)
            loginNav.style.display = "";

        if (registerNav)
            registerNav.style.display = "";

        if (logoutNav)
            logoutNav.style.display = "none";

        if (profileNav)
            profileNav.style.display = "none";

    }

}


/* =====================================================
   REGISTER
===================================================== */

async function register() {

    const username =
        document.getElementById("regUser")
            ?.value
            .trim();

    const valorant_id =
        document.getElementById("regId")
            ?.value
            .trim();

    const rank =
        document.getElementById("regRank")
            ?.value;

    const role =
        document.getElementById("regRole")
            ?.value;

    const password =
        document.getElementById("regPassword")
            ?.value;

    const password2 =
        document.getElementById("regPass2")
            ?.value;

    const terms =
        document.getElementById("regTerms")
            ?.checked;

    if (
        !username ||
        !valorant_id ||
        !rank ||
        !role ||
        !password
    ) {

        alert(
            "Lütfen tüm alanları doldur."
        );

        return;

    }

    if (password !== password2) {

        alert(
            "Şifreler aynı değil."
        );

        return;

    }

    if (password.length < 6) {

        alert(
            "Şifre en az 6 karakter olmalı."
        );

        return;

    }

    if (!terms) {

        alert(
            "Kullanım şartlarını kabul etmelisin."
        );

        return;

    }

    try {

        const data =
            await apiRequest(
                "/register",
                {
                    method: "POST",

                    body: JSON.stringify({

                        username,

                        valorant_id,

                        rank,

                        role,

                        password

                    })
                }
            );

        alert(
            data.message ||
            "Kayıt başarılı!"
        );

        document.getElementById(
            "regPassword"
        ).value = "";

        document.getElementById(
            "regPass2"
        ).value = "";

        showPage("login");

    }

    catch (error) {

        alert(
            error.message
        );

    }

}


/* =====================================================
   LOGIN
===================================================== */

async function login() {

    const username =
        document.getElementById("loginUser")
            ?.value
            .trim();

    const password =
        document.getElementById("loginPassword")
            ?.value;

    if (!username || !password) {

        alert(
            "Kullanıcı adı ve şifre gerekli."
        );

        return;

    }

    try {

        const data =
            await apiRequest(
                "/login",
                {
                    method: "POST",

                    body: JSON.stringify({

                        username,

                        password

                    })
                }
            );

        authToken =
            data.token;

        currentUser =
            data.user;

        localStorage.setItem(
            "valo_token",
            authToken
        );

        localStorage.setItem(
            "valo_user",
            JSON.stringify(currentUser)
        );

        updateAuthUI();

        alert(
            "Giriş başarılı!"
        );

        document.getElementById(
            "loginPassword"
        ).value = "";

        const afterLogin =
            localStorage.getItem(
                "valo_after_login"
            );

        localStorage.removeItem(
            "valo_after_login"
        );

        if (afterLogin) {

            showPage(afterLogin);

        }

        else {

            showPage("home");

        }

    }

    catch (error) {

        alert(
            error.message
        );

    }

}


/* =====================================================
   LOGOUT
===================================================== */

function logout() {

    authToken = "";
    currentUser = null;

    localStorage.removeItem(
        "valo_token"
    );

    localStorage.removeItem(
        "valo_user"
    );

    updateAuthUI();

    showPage("home");

}


/* =====================================================
   PROFİL
===================================================== */

async function loadProfile() {

    if (!authToken) {

        showPage("login");

        return;

    }

    try {

        const data =
            await apiRequest(
                "/profile"
            );

        currentUser =
            data.user;

        localStorage.setItem(
            "valo_user",
            JSON.stringify(currentUser)
        );

        fillProfile(
            currentUser
        );

    }

    catch (error) {

        console.error(
            error
        );

        if (
            error.message.includes(
                "Oturum"
            )
        ) {

            logout();

        }

    }

}


/* =====================================================
   PROFİL FORMU DOLDUR
===================================================== */

function fillProfile(user) {

    const username =
        document.getElementById(
            "profileUsername"
        );

    const profileUser =
        document.getElementById(
            "profileUser"
        );

    const valorantId =
        document.getElementById(
            "profileValorantId"
        );

    const rank =
        document.getElementById(
            "profileRank"
        );

    const role =
        document.getElementById(
            "profileRole"
        );

    const letter =
        document.getElementById(
            "profileLetter"
        );

    if (username)
        username.textContent =
            user.username;

    if (profileUser)
        profileUser.value =
            user.username;

    if (valorantId)
        valorantId.value =
            user.valorant_id || "";

    if (rank)
        rank.value =
            user.rank;

    if (role)
        role.value =
            user.role;

    if (letter)
        letter.textContent =
            user.username
                ?.charAt(0)
                ?.toUpperCase() || "?";

}


/* =====================================================
   PROFİL GÜNCELLE
===================================================== */

async function updateProfile() {

    const valorant_id =
        document.getElementById(
            "profileValorantId"
        )
        ?.value
        .trim();

    const rank =
        document.getElementById(
            "profileRank"
        )
        ?.value;

    const role =
        document.getElementById(
            "profileRole"
        )
        ?.value;

    const password =
        document.getElementById(
            "profilePassword"
        )
        ?.value;

    const password2 =
        document.getElementById(
            "profilePassword2"
        )
        ?.value;

    const status =
        document.getElementById(
            "profileStatus"
        );

    if (!valorant_id) {

        if (status)
            status.textContent =
                "Valorant ID gerekli.";

        return;

    }

    if (
        password &&
        password !== password2
    ) {

        if (status)
            status.textContent =
                "Şifreler aynı değil.";

        return;

    }

    try {

        const data =
            await apiRequest(
                "/profile",
                {
                    method: "PUT",

                    body: JSON.stringify({

                        valorant_id,

                        rank,

                        role,

                        password

                    })
                }
            );

        currentUser =
            data.user;

        localStorage.setItem(
            "valo_user",
            JSON.stringify(currentUser)
        );

        fillProfile(
            currentUser
        );

        document.getElementById(
            "profilePassword"
        ).value = "";

        document.getElementById(
            "profilePassword2"
        ).value = "";

        if (status)
            status.textContent =
                "Profil başarıyla güncellendi.";

        loadRooms();

    }

    catch (error) {

        if (status)
            status.textContent =
                error.message;

    }

}


/* =====================================================
   1 KİŞİ LAZIM
===================================================== */

async function loadRooms() {

    if (!authToken) {

        return;

    }

    const roomsElement =
        document.getElementById(
            "rooms"
        );

    if (!roomsElement) {

        return;

    }

    roomsElement.innerHTML = `
        <div class="form-card">
            İlanlar yükleniyor...
        </div>
    `;

    try {

        const profile =
            await apiRequest(
                "/profile"
            );

        currentUser =
            profile.user;

        const role =
            document.getElementById(
                "filterRole"
            )?.value || "";

        const mode =
            document.getElementById(
                "filterMode"
            )?.value || "";

        const params =
            new URLSearchParams();

        if (role)
            params.set(
                "role",
                role
            );

        if (mode)
            params.set(
                "mode",
                mode
            );

        const query =
            params.toString()
                ? `?${params.toString()}`
                : "";

        const data =
            await apiRequest(
                `/rooms${query}`
            );

        renderRooms(
            data
        );

    }

    catch (error) {

        console.error(
            error
        );

        roomsElement.innerHTML = `
            <div class="form-card">
                <h3>İlanlar alınamadı</h3>
                <p>${escapeHtml(error.message)}</p>
                <button
                    class="secondary"
                    onclick="loadRooms()">
                    Tekrar Dene
                </button>
            </div>
        `;

    }

}


/* =====================================================
   İLANLARI GÖSTER
===================================================== */

function renderRooms(data) {

    const roomsElement =
        document.getElementById(
            "rooms"
        );

    if (!roomsElement)
        return;

    if (
        !data.rooms ||
        data.rooms.length === 0
    ) {

        roomsElement.innerHTML = `

            <div class="form-card">

                <h3>
                    Uygun ilan bulunamadı.
                </h3>

                <p class="muted">

                    Profil rankın:
                    <strong>
                        ${escapeHtml(
                            data.searchRank || "-"
                        )}
                    </strong>

                    <br>

                    Aranan ranklar:
                    <strong>
                        ${escapeHtml(
                            (data.compatibleRanks || [])
                                .join(" • ")
                        )}
                    </strong>

                </p>

            </div>

        `;

        return;

    }

    roomsElement.innerHTML =
        data.rooms
            .map(room => {

                return `

                <div class="room-card">

                    <div class="room-card-head">

                        <div>

                            <h3>
                                ${escapeHtml(
                                    room.username
                                )}
                            </h3>

                            <p class="muted">

                                ${escapeHtml(
                                    room.rank
                                )}
                                •
                                ${escapeHtml(
                                    room.role
                                )}

                            </p>

                        </div>

                        <span class="status">

                            <i></i>

                            Açık

                        </span>

                    </div>


                    <div class="room-info">

                        <span>
                            🎮 ${escapeHtml(
                                room.mode
                            )}
                        </span>

                        <span>
                            🎤 ${
                                room.microphone
                                    ? "Mikrofon"
                                    : "Mikrofonsuz"
                            }
                        </span>

                        <span>
                            👤 ${escapeHtml(
                                room.age
                            )}
                        </span>

                    </div>


                    <p>

                        ${escapeHtml(
                            room.description ||
                            "Açıklama yok."
                        )}

                    </p>


                    <div>

                        <button
                            class="primary"
                            onclick="joinRoom(${room.id})">

                            Takıma Katıl

                        </button>

                    </div>

                </div>

                `;

            })
            .join("");

}


/* =====================================================
   İLAN OLUŞTUR
===================================================== */

async function createRoom() {

    if (!authToken) {

        showPage("login");

        return;

    }

    const rank =
        document.getElementById(
            "roomRank"
        )?.value;

    const role =
        document.getElementById(
            "roomRole"
        )?.value;

    const mode =
        document.getElementById(
            "roomMode"
        )?.value;

    const age =
        document.getElementById(
            "roomAge"
        )?.value;

    const microphone =
        document.getElementById(
            "roomMic"
        )?.checked;

    const description =
        document.getElementById(
            "roomDescription"
        )?.value
        .trim();

    try {

        const data =
            await apiRequest(
                "/rooms",
                {
                    method: "POST",

                    body: JSON.stringify({

                        rank,

                        role,

                        mode,

                        age,

                        microphone,

                        description

                    })
                }
            );

        alert(
            data.message ||
            "İlan oluşturuldu."
        );

        showPage("one");

        loadRooms();

    }

    catch (error) {

        alert(
            error.message
        );

    }

}


/* =====================================================
   ODAYA KATIL
===================================================== */

function joinRoom(roomId) {

    currentRoomId =
        roomId;

    showPage("room");

    const messages =
        document.getElementById(
            "messages"
        );

    if (messages) {

        messages.innerHTML = `

            <div>

                <b>Sistem</b>

                <span>
                    Odaya hoş geldiniz.
                </span>

            </div>

        `;

    }

}


/* =====================================================
   5'Lİ TAKIM EŞLEŞTİR
===================================================== */

async function startMatch() {

    if (!authToken) {

        showPage("login");

        return;

    }

    const status =
        document.getElementById(
            "matchStatus"
        );

    if (status) {

        status.innerHTML = `
            <p>
                🔎 Profil rankına göre oyuncu aranıyor...
            </p>
        `;

    }

    try {

        const data =
            await apiRequest(
                "/matchmaking"
            );

        if (!status)
            return;

        let playersHtml = "";

        if (
            data.players &&
            data.players.length
        ) {

            playersHtml =
                data.players
                    .map(player => `

                        <div class="member">

                            <b>
                                ${escapeHtml(
                                    player.username
                                )}
                            </b>

                            <small>

                                ${escapeHtml(
                                    player.rank
                                )}
                                •
                                ${escapeHtml(
                                    player.role
                                )}

                            </small>

                            <em>

                                Valorant ID:
                                ${escapeHtml(
                                    player.valorant_id
                                )}

                            </em>

                        </div>

                    `)
                    .join("");

        }

        else {

            playersHtml = `
                <p class="muted">
                    Henüz uygun oyuncu bulunamadı.
                </p>
            `;

        }

        status.innerHTML = `

            <div>

                <h3>
                    ${data.teamReady
                        ? "🎉 5 Kişilik Takım Hazır!"
                        : "Oyuncu Aranıyor"}
                </h3>

                <p>

                    Senin rankın:
                    <strong>
                        ${escapeHtml(
                            data.searchRank
                        )}
                    </strong>

                </p>

                <p>

                    Aranan ranklar:
                    <strong>
                        ${escapeHtml(
                            data.compatibleRanks.join(
                                " • "
                            )
                        )}
                    </strong>

                </p>

                <p>

                    Takım:
                    <strong>
                        ${data.playerCount} / 5
                    </strong>

                </p>

                <div class="team">

                    ${playersHtml}

                </div>

            </div>

        `;

    }

    catch (error) {

        console.error(
            error
        );

        if (status) {

            status.innerHTML = `

                <p>
                    ❌ ${escapeHtml(
                        error.message
                    )}
                </p>

            `;

        }

    }

}


/* =====================================================
   MESAJ
===================================================== */

function sendMsg() {

    const input =
        document.getElementById(
            "msg"
        );

    const messages =
        document.getElementById(
            "messages"
        );

    if (!input || !messages)
        return;

    const text =
        input.value.trim();

    if (!text)
        return;

    const username =
        currentUser?.username ||
        "Sen";

    const div =
        document.createElement(
            "div"
        );

    div.innerHTML = `

        <b>
            ${escapeHtml(username)}
        </b>

        <span>
            ${escapeHtml(text)}
        </span>

    `;

    messages.appendChild(
        div
    );

    input.value = "";

    messages.scrollTop =
        messages.scrollHeight;

}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHtml(value) {

    if (value === null || value === undefined) {

        return "";

    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* =====================================================
   BAŞLANGIÇ
===================================================== */

async function init() {

    updateAuthUI();

    if (authToken) {

        try {

            const data =
                await apiRequest(
                    "/profile"
                );

            currentUser =
                data.user;

            localStorage.setItem(
                "valo_user",
                JSON.stringify(
                    currentUser
                )
            );

            updateAuthUI();

        }

        catch {

            logout();

        }

    }

}


/* =====================================================
   START
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        init();

    }
);