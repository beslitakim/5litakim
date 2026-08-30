const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "5litakim-gizli-anahtar-2026";
const ROOM_LIFETIME_SECONDS = 180;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "../")));

const db = new Database(path.join(__dirname, "5litakim.db"));
db.pragma("foreign_keys = ON");

/* TABLOLAR */
db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    valorant_id TEXT NOT NULL,
    rank TEXT NOT NULL,
    role TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS rank_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    result TEXT NOT NULL,
    agent TEXT,
    map TEXT,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

function getUserMatches(userId) {
    const matches = db.prepare(`SELECT result FROM rank_matches WHERE user_id = ? ORDER BY id DESC LIMIT 5`).all(userId);
    return matches.map(m => m.result).join('');
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Oturum süreniz dolmuş." });
    }
    const token = authHeader.substring(7).trim();
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: "Oturum geçersiz." });
        req.user = user;
        next();
    });
}

app.post("/api/register", async (req, res) => {
    try {
        const { username, valorant_id, rank, role, password } = req.body || {};
        if (!username || !valorant_id || !rank || !role || !password) {
            return res.status(400).json({ success: false, message: "Tüm alanları doldurun." });
        }

        const cleanUsername = String(username).trim();
        const existing = db.prepare(`SELECT id FROM users WHERE LOWER(username) = LOWER(?)`).get(cleanUsername);
        if (existing) {
            return res.status(400).json({ success: false, message: "Bu kullanıcı adı zaten kullanımda." });
        }

        const hashed = await bcrypt.hash(String(password), 10);
        const result = db.prepare(`
            INSERT INTO users (username, valorant_id, rank, role, password)
            VALUES (?, ?, ?, ?, ?)
        `).run(cleanUsername, String(valorant_id).trim(), String(rank).trim(), String(role).trim(), hashed);

        const insertMatch = db.prepare(`INSERT INTO rank_matches (user_id, result, agent, map) VALUES (?, ?, 'Jett', 'Ascent')`);
        ['G', 'G', 'M', 'B', 'G'].forEach(resType => {
            insertMatch.run(result.lastInsertRowid, resType);
        });

        return res.status(201).json({ success: true, message: "Kayıt başarılı!" });
    } catch (err) {
        console.error("REGISTER ERROR:", err);
        return res.status(500).json({ success: false, message: "Sunucu hatası: " + err.message });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const user = db.prepare(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`).get(String(username || "").trim());
        if (!user || !(await bcrypt.compare(String(password || ""), user.password))) {
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
                rank: user.rank,
                role: user.role,
                matches: getUserMatches(user.id)
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

app.get("/api/profile", authenticateToken, (req, res) => {
    try {
        const user = db.prepare(`SELECT id, username, valorant_id, rank, role FROM users WHERE id = ?`).get(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
        user.matches = getUserMatches(user.id);
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: "Profil alınamadı." });
    }
});

app.put("/api/profile", authenticateToken, async (req, res) => {
    try {
        const { valorant_id, rank, role, password } = req.body || {};
        const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });

        let newPass = user.password;
        if (password && String(password).trim().length >= 6) {
            newPass = await bcrypt.hash(String(password).trim(), 10);
        }

        db.prepare(`
            UPDATE users SET valorant_id = ?, rank = ?, role = ?, password = ? WHERE id = ?
        `).run(valorant_id || user.valorant_id, rank || user.rank, role || user.role, newPass, user.id);

        const updatedUser = db.prepare(`SELECT id, username, valorant_id, rank, role FROM users WHERE id = ?`).get(user.id);
        updatedUser.matches = getUserMatches(user.id);

        res.json({ success: true, message: "Profil güncellendi.", user: updatedUser });
    } catch (err) {
        res.status(500).json({ success: false, message: "Profil güncellenemedi." });
    }
});

app.get("/api/rooms", authenticateToken, (req, res) => {
    try {
        const user = db.prepare(`SELECT rank FROM users WHERE id = ?`).get(req.user.id);
        const searchRank = user ? user.rank : "Gümüş 1";

        const rooms = db.prepare(`
            SELECT rooms.*, users.username, users.valorant_id, users.id as owner_id
            FROM rooms 
            INNER JOIN users ON rooms.user_id = users.id
            ORDER BY rooms.id DESC
        `).all();

        const formattedRooms = rooms.map(room => ({
            ...room,
            matches: getUserMatches(room.owner_id),
            remaining_seconds: ROOM_LIFETIME_SECONDS,
            max_seconds: ROOM_LIFETIME_SECONDS
        }));

        res.json({ success: true, rooms: formattedRooms, searchRank, compatibleRanks: [searchRank] });
    } catch (err) {
        res.status(500).json({ success: false, message: "İlanlar alınamadı." });
    }
});

app.post("/api/rooms", authenticateToken, (req, res) => {
    try {
        const { role, mode, age, microphone, description } = req.body || {};
        const user = db.prepare(`SELECT rank FROM users WHERE id = ?`).get(req.user.id);
        
        db.prepare(`DELETE FROM rooms WHERE user_id = ?`).run(req.user.id);

        const result = db.prepare(`
            INSERT INTO rooms (user_id, rank, role, mode, age, microphone, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(req.user.id, user.rank, role || "Flex", mode || "Dereceli", age || "Yok", microphone ? 1 : 0, description || "");

        res.status(201).json({ success: true, message: "İlan başarıyla oluşturuldu.", roomId: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ success: false, message: "İlan oluşturulamadı." });
    }
});

app.get("/api/matchmaking", authenticateToken, (req, res) => {
    try {
        const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
        const otherUsers = db.prepare(`SELECT id, username, valorant_id, rank, role FROM users WHERE id != ? LIMIT 4`).all(req.user.id);

        const players = [
            { id: user.id, username: user.username, valorant_id: user.valorant_id, rank: user.rank, role: user.role, matches: getUserMatches(user.id) },
            ...otherUsers.map(u => ({ ...u, matches: getUserMatches(u.id) }))
        ];

        res.json({
            success: true,
            teamReady: players.length >= 5,
            searchRank: user.rank,
            compatibleRanks: [user.rank],
            playerCount: players.length,
            players
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Eşleşme hatası." });
    }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../index.html"));
});

app.listen(PORT, () => {
    console.log(`Sunucu aktif: http://localhost:${PORT}`);
});