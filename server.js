const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "valotakim-gizli-anahtar-2026";
const ROOM_LIFETIME_SECONDS = 600;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "../")));

const db = new Database(":memory:");
db.pragma("foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        valorant_id TEXT NOT NULL,
        rank TEXT NOT NULL,
        role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        mode TEXT NOT NULL,
        age TEXT NOT NULL,
        microphone INTEGER DEFAULT 1,
        description TEXT,
        agents TEXT,
        participants TEXT DEFAULT '[]',
        messages TEXT DEFAULT '[]',
        lockedUser TEXT,
        ownerAdded INTEGER DEFAULT 0,
        guestAdded INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
`);

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

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ success: false });
    jwt.verify(authHeader.substring(7), JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false });
        req.user = user;
        next();
    });
}

function cleanupExpiredRooms() {
    try {
        const rooms = db.prepare(`SELECT id, created_at FROM rooms`).all();
        for (const room of rooms) {
            const createdTime = new Date(String(room.created_at).replace(" ", "T") + "Z").getTime();
            if (Math.floor((Date.now() - createdTime) / 1000) >= ROOM_LIFETIME_SECONDS) {
                db.prepare(`DELETE FROM rooms WHERE id = ?`).run(room.id);
            }
        }
    } catch (e) { console.error(e); }
}
setInterval(cleanupExpiredRooms, 5000);

// Sosyal Giriş / Otomatik Kayıt Rotası
app.post("/api/social-login", (req, res) => {
    const { provider } = req.body;
    let username = provider === 'Riot' ? "RiotPlayer#TR1" : "GoogleUser";
    let valorant_id = provider === 'Riot' ? "Agent#0001" : "User#GGL";

    let user = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
    if (!user) {
        const result = db.prepare(`INSERT INTO users (username, valorant_id, rank, role) VALUES (?, ?, 'Gümüş 1', 'Flex')`).run(username, valorant_id);
        user = { id: result.lastInsertRowid, username, valorant_id, rank: 'Gümüş 1', role: 'Flex' };
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, token, user });
});

app.get("/api/profile", authenticateToken, (req, res) => {
    const user = db.prepare(`SELECT id, username, valorant_id, rank, role FROM users WHERE id = ?`).get(req.user.id);
    res.json({ success: true, user });
});

app.put("/api/profile", authenticateToken, (req, res) => {
    const { valorant_id, rank, role } = req.body;
    db.prepare(`UPDATE users SET valorant_id = ?, rank = ?, role = ? WHERE id = ?`).run(valorant_id, rank, role, req.user.id);
    res.json({ success: true });
});

app.get("/api/rooms", authenticateToken, (req, res) => {
    try {
        cleanupExpiredRooms();
        const rooms = db.prepare(`
            SELECT rooms.*, users.username, users.valorant_id as owner_valorant_id, users.rank 
            FROM rooms JOIN users ON rooms.user_id = users.id ORDER BY rooms.id DESC
        `).all().map(r => {
            const createdTime = new Date(String(r.created_at).replace(" ", "T") + "Z").getTime();
            const elapsed = Math.floor((Date.now() - createdTime) / 1000);
            const remaining_seconds = Math.max(0, ROOM_LIFETIME_SECONDS - elapsed);

            let lockedValId = null;
            if (r.lockedUser) {
                let gUser = db.prepare(`SELECT valorant_id FROM users WHERE username = ?`).get(r.lockedUser);
                lockedValId = gUser ? gUser.valorant_id : null;
            }

            return {
                ...r,
                agents: JSON.parse(r.agents || '[]'),
                participants: JSON.parse(r.participants || '[]'),
                messages: JSON.parse(r.messages || '[]'),
                remaining_seconds,
                locked_valorant_id: lockedValId
            };
        });
        res.json({ success: true, rooms });
    } catch (err) {
        res.status(500).json({ success: false, message: "İlanlar yüklenemedi." });
    }
});

app.post("/api/rooms", authenticateToken, (req, res) => {
    const { mode, age, description, agents } = req.body;
    db.prepare(`INSERT INTO rooms (user_id, mode, age, description, agents) VALUES (?, ?, ?, ?, ?)`).run(
        req.user.id, mode, age, description, JSON.stringify(agents)
    );
    res.json({ success: true });
});

app.post("/api/rooms/:id/join", authenticateToken, (req, res) => {
    const room = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(req.params.id);
    if (!room || room.lockedUser) return res.json({ success: false });
    let participants = JSON.parse(room.participants || '[]');
    const currentUser = db.prepare(`SELECT username FROM users WHERE id = ?`).get(req.user.id).username;
    
    if (!participants.includes(currentUser) && room.user_id !== req.user.id) {
        participants.push(currentUser);
        db.prepare(`UPDATE rooms SET participants = ? WHERE id = ?`).run(JSON.stringify(participants), req.params.id);
    }
    res.json({ success: true });
});

app.post("/api/rooms/:id/message", authenticateToken, (req, res) => {
    const room = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(req.params.id);
    if (!room) return res.json({ success: false });
    let messages = JSON.parse(room.messages || '[]');
    const currentUser = db.prepare(`SELECT username FROM users WHERE id = ?`).get(req.user.id).username;
    
    messages.push({ user: currentUser, text: req.body.text });
    db.prepare(`UPDATE rooms SET messages = ? WHERE id = ?`).run(JSON.stringify(messages), req.params.id);
    res.json({ success: true });
});

app.post("/api/rooms/:id/action", authenticateToken, (req, res) => {
    const { username, action } = req.body;
    if (action === 'reject') {
        db.prepare(`DELETE FROM rooms WHERE id = ?`).run(req.params.id);
    } else if (action === 'accept') {
        db.prepare(`UPDATE rooms SET lockedUser = ? WHERE id = ?`).run(username, req.params.id);
    }
    res.json({ success: true });
});

app.post("/api/rooms/:id/added", authenticateToken, (req, res) => {
    const room = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(req.params.id);
    if (!room) return res.json({ success: false });

    if (req.body.userType === 'owner') db.prepare(`UPDATE rooms SET ownerAdded = 1 WHERE id = ?`).run(req.params.id);
    if (req.body.userType === 'guest') db.prepare(`UPDATE rooms SET guestAdded = 1 WHERE id = ?`).run(req.params.id);

    const updated = db.prepare(`SELECT ownerAdded, guestAdded FROM rooms WHERE id = ?`).get(req.params.id);
    if (updated.ownerAdded && updated.guestAdded) {
        db.prepare(`DELETE FROM rooms WHERE id = ?`).run(req.params.id);
    }
    res.json({ success: true });
});

app.get("/api/matchmaking", authenticateToken, (req, res) => {
    const currentUser = db.prepare(`SELECT rank FROM users WHERE id = ?`).get(req.user.id);
    const myRankIdx = RANK_ORDER.indexOf(currentUser.rank || "Gümüş 1");
    
    const users = db.prepare(`SELECT username, valorant_id, rank, role FROM users WHERE id != ?`).all(req.user.id);
    const matched = users.filter(u => {
        const uIdx = RANK_ORDER.indexOf(u.rank || "Gümüş 1");
        return Math.abs(uIdx - myRankIdx) <= 3;
    });

    res.json({ success: true, searchRank: currentUser.rank, players: matched });
});

app.listen(PORT, () => { console.log(`Sunucu aktif: http://localhost:${PORT}`); });