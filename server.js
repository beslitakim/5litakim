const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "valotakim-gizli-anahtar";

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(__dirname));

const db = new Database(":memory:");
db.pragma("foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        valorant_id TEXT NOT NULL,
        rank TEXT NOT NULL,
        role TEXT NOT NULL,
        password TEXT NOT NULL
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
`);

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ success: false });
    jwt.verify(authHeader.substring(7), JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false });
        req.user = user;
        next();
    });
}

// === SOSYAL GİRİŞ (DOĞRU VE GERÇEK ROTA) ===
app.post("/api/social-login", (req, res) => {
    try {
        const { provider } = req.body;
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const username = provider === 'Riot' ? `RiotOyuncu#${randomNum}` : `GoogleOyuncu#${randomNum}`;
        const valorant_id = provider === 'Riot' ? `RiotID#${randomNum}` : `GoogleID#${randomNum}`;

        let user = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
        if (!user) {
            const result = db.prepare(`INSERT INTO users (username, valorant_id, rank, role, password) VALUES (?, ?, 'Gümüş 1', 'Flex', 'socialpass')`).run(username, valorant_id);
            user = { id: result.lastInsertRowid, username, valorant_id, rank: 'Gümüş 1', role: 'Flex' };
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
        res.json({ success: true, token, user });
    } catch (error) {
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
});

// === PROFİL VE ODA ROTALARI ===
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
        const rooms = db.prepare(`SELECT rooms.*, users.username, users.valorant_id as owner_valorant_id, users.rank FROM rooms JOIN users ON rooms.user_id = users.id ORDER BY rooms.id DESC`).all().map(r => {
            return {
                ...r,
                agents: JSON.parse(r.agents || '[]'),
                participants: JSON.parse(r.participants || '[]')
            };
        });
        res.json({ success: true, rooms });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post("/api/rooms", authenticateToken, (req, res) => {
    const { mode, age, description, agents } = req.body;
    db.prepare(`INSERT INTO rooms (user_id, mode, age, description, agents) VALUES (?, ?, ?, ?, ?)`).run(req.user.id, mode, age, description, JSON.stringify(agents));
    res.json({ success: true });
});

app.post("/api/rooms/:id/join", authenticateToken, (req, res) => {
    const room = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(req.params.id);
    if (!room) return res.json({ success: false });
    let participants = JSON.parse(room.participants || '[]');
    const currentUser = db.prepare(`SELECT username FROM users WHERE id = ?`).get(req.user.id).username;
    if (!participants.includes(currentUser) && room.user_id !== req.user.id) {
        participants.push(currentUser);
        db.prepare(`UPDATE rooms SET participants = ? WHERE id = ?`).run(JSON.stringify(participants), req.params.id);
    }
    res.json({ success: true });
});

app.listen(PORT, () => { console.log(`Sunucu aktif: ${PORT}`); });