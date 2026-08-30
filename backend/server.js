const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "5litakim-gizli-anahtar-2026";

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.use(express.static(path.join(__dirname, "../")));

const db = new Database(path.join(__dirname, "5litakim.db"));
db.pragma("foreign_keys = ON");

/* =====================================================
  TABLOLAR
===================================================== */
db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    valorant_id TEXT NOT NULL,
    rank TEXT NOT NULL,
    role TEXT NOT NULL,
    agent TEXT DEFAULT 'Jett',
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    rank TEXT NOT NULL,
    role TEXT NOT NULL,
    mode TEXT NOT NULL,
    age TEXT NOT NULL,
    microphone INTEGER DEFAULT 1,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS room_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    requester_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, accepted, rejected
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rank_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    result TEXT NOT NULL, -- G (Galibiyet), B (Beraberlik), M (Mağlubiyet)
    agent TEXT,
    map TEXT,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

/* Örnek maç verisi yoksa kullanıcılar için son 5 maç ekle */
const userCount = db.prepare(`SELECT COUNT(*) as c FROM users`).get().c;
if (userCount > 0) {
    const matchCheck = db.prepare(`SELECT COUNT(*) as c FROM rank_matches`).get().c;
    if (matchCheck === 0) {
        const users = db.prepare(`SELECT id FROM users`).all();
        const results = ['G', 'G', 'M', 'B', 'G'];
        const insertMatch = db.prepare(`INSERT INTO rank_matches (user_id, result, agent, map) VALUES (?, ?, 'Jett', 'Ascent')`);
        users.forEach(u => {
            results.forEach(res => {
                insertMatch.run(u.id, res);
            });
        });
    }
}

const RANK_ORDER = [
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

function normalizeRank(rank) {
    if (!rank) return "Gümüş 1";
    let value = String(rank).trim();
    return RANK_ORDER.find(r => r.toLowerCase() === value.toLowerCase()) || value;
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Oturum süreniz dolmuş, lütfen tekrar giriş yapın." });
    }
    const token = authHeader.substring(7).trim();
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: "Oturum geçersiz." });
        req.user = user;
        next();
    });
}

function getUserMatches(userId) {
    const matches = db.prepare(`SELECT result FROM rank_matches WHERE user_id = ? ORDER BY id DESC LIMIT 5`).all(userId);
    return matches.map(m => m.result).join('');
}

/* =====================================================
  API ENDPOINTS
===================================================== */
app.post("/api/register", async (req, res) => {
    try {
        const { username, valorant_id, rank, role, password, agent } = req.body || {};
        if (!username || !valorant_id || !password) {
            return res.status(400).json({ success: false, message: "Tüm alanları doldurun." });
        }
        const hashed = await bcrypt.hash(password, 10);
        const result = db.prepare(`
            INSERT INTO users (username, valorant_id, rank, role, agent, password)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(username.trim(), valorant_id.trim(), normalizeRank(rank), role || "Flex", agent || "Jett", hashed);

        // Varsayılan son 5 maç ekle
        const results = ['G', 'G', 'M', 'B', 'G'];
        results.forEach(resType => {
            db.prepare(`INSERT INTO rank_matches (user_id, result, agent, map) VALUES (?, ?, ?, ?)`).run(result.lastInsertRowid, resType, agent || 'Jett', 'Ascent');
        });

        return res.status(201).json({ success: true, message: "Kayıt başarılı!" });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Kullanıcı adı zaten kullanımda." });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const user = db.prepare(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`).get(username?.trim());
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, message: "Kullanıcı adı veya şifre hatalı." });
        }
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
        return res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                valorant_id: user.valorant_id,
                rank: normalizeRank(user.rank),
                role: user.role,
                agent: user.agent || 'Jett',
                matches: getUserMatches(user.id)
            }
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

app.get("/api/profile", authenticateToken, (req, res) => {
    const user = db.prepare(`SELECT id, username, valorant_id, rank, role, agent FROM users WHERE id = ?`).get(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
    user.matches = getUserMatches(user.id);
    res.json({ success: true, user });
});

app.put("/api/profile", authenticateToken, async (req, res) => {
    try {
        const { valorant_id, rank, role, agent, password } = req.body || {};
        const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });

        let newPass = user.password;
        if (password && password.trim().length >= 6) {
            newPass = await bcrypt.hash(password.trim(), 10);
        }

        db.prepare(`
            UPDATE users SET valorant_id = ?, rank = ?, role = ?, agent = ?, password = ? WHERE id = ?
        `).run(valorant_id || user.valorant_id, normalizeRank(rank || user.rank), role || user.role, agent || user.agent, newPass, user.id);

        const updatedUser = db.prepare(`SELECT id, username, valorant_id, rank, role, agent FROM users WHERE id = ?`).get(user.id);
        updatedUser.matches = getUserMatches(user.id);

        res.json({ success: true, message: "Profil güncellendi.", user: updatedUser });
    } catch (e) {
        res.status(500).json({ success: false, message: "Profil güncellenirken hata oluştu." });
    }
});

/* İLANLAR */
app.get("/api/rooms", authenticateToken, (req, res) => {
    const user = db.prepare(`SELECT rank FROM users WHERE id = ?`).get(req.user.id);
    const searchRank = user ? user.rank : "Gümüş 1";

    const rooms = db.prepare(`
        SELECT rooms.*, users.username, users.valorant_id, users.agent, users.id as owner_id
        FROM rooms 
        INNER JOIN users ON rooms.user_id = users.id
        ORDER BY rooms.id DESC
    `).all();

    const formattedRooms = rooms.map(room => ({
        ...room,
        matches: getUserMatches(room.owner_id)
    }));

    res.json({ success: true, rooms: formattedRooms, searchRank, compatibleRanks: [searchRank] });
});

app.post("/api/rooms", authenticateToken, (req, res) => {
    try {
        const { role, mode, age, microphone, description } = req.body || {};
        const user = db.prepare(`SELECT rank FROM users WHERE id = ?`).get(req.user.id);
        
        const result = db.prepare(`
            INSERT INTO rooms (user_id, rank, role, mode, age, microphone, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(req.user.id, user.rank, role || "Flex", mode || "Dereceli", age || "Yok", microphone ? 1 : 0, description || "");

        res.status(201).json({ success: true, message: "İlan başarıyla oluşturuldu.", roomId: result.lastInsertRowid });
    } catch (e) {
        res.status(500).json({ success: false, message: "İlan oluşturulamadı." });
    }
});

/* 5'Lİ TAKIM EŞLEŞTİRME */
app.get("/api/matchmaking", authenticateToken, (req, res) => {
    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
    const otherUsers = db.prepare(`SELECT id, username, valorant_id, rank, role, agent FROM users WHERE id != ? LIMIT 4`).all(req.user.id);

    const players = [
        { username: user.username, valorant_id: user.valorant_id, rank: user.rank, role: user.role, agent: user.agent || 'Jett' },
        ...otherUsers
    ];

    res.json({
        success: true,
        teamReady: players.length >= 5,
        searchRank: user.rank,
        compatibleRanks: [user.rank],
        playerCount: players.length,
        players
    });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../index.html"));
});

app.listen(PORT, () => {
    console.log(`Sunucu aktif: http://localhost:${PORT}`);
});