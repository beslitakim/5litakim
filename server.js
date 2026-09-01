const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");

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

// === STANDART KAYIT OL ===
app.post("/api/register", (req, res) => {
    try {
        const { username, valName, valTag, rank, role, password, passwordConfirm } = req.body;
        if (password !== passwordConfirm) {
            return res.status(400).json({ success: false, message: "Şifreler birbiriyle uyuşmuyor!" });
        }
        
        const valorant_id = `${valName}#${valTag}`;
        
        // Admin hesabı kontrolü veya normal kayıt
        const existing = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
        if (existing) {
            return res.status(400).json({ success: false, message: "Bu kullanıcı adı zaten alınmış!" });
        }

        db.prepare(`INSERT INTO users (username, valorant_id, rank, role, password) VALUES (?, ?, ?, ?, ?)`).run(username, valorant_id, rank, role, password);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: "Kayıt olurken hata oluştu." });
    }
});

// === STANDART GİRİŞ YAP ===
app.post("/api/login", (req, res) => {
    try {
        const { username, password } = req.body;
        const user = db.prepare(`SELECT * FROM users WHERE username = ? AND password = ?`).get(username, password);
        
        if (!user) {
            return res.status(400).json({ success: false, message: "Hatalı kullanıcı adı veya şifre!" });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
        res.json({ success: true, token, user });
    } catch (error) {
        res.status(500).json({ success: false, message: "Giriş yapılırken hata oluştu." });
    }
});

// === PROFİL ===
app.get("/api/profile", authenticateToken, (req, res) => {
    const user = db.prepare(`SELECT id, username, valorant_id, rank, role FROM users WHERE id = ?`).get(req.user.id);
    res.json({ success: true, user });
});

app.put("/api/profile", authenticateToken, (req, res) => {
    const { valorant_id, rank, role } = req.body;
    db.prepare(`UPDATE users SET valorant_id = ?, rank = ?, role = ? WHERE id = ?`).run(valorant_id, rank, role, req.user.id);
    res.json({ success: true });
});

// === İLANLAR / ODALAR ===
app.get("/api/rooms", authenticateToken, (req, res) => {
    try {
        const rooms = db.prepare(`SELECT rooms.*, users.username, users.valorant_id as owner_valorant_id, users.rank FROM rooms JOIN users ON rooms.user_id = users.id ORDER BY rooms.id DESC`).all().map(r => {
            return {
                ...r,
                agents: JSON.parse(r.agents || '[]'),
                participants: JSON.parse(r.participants || '[]'),
                messages: JSON.parse(r.messages || '[]')
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

app.post("/api/rooms/:id/message", authenticateToken, (req, res) => {
    const { message } = req.body;
    const room = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(req.params.id);
    if (!room) return res.json({ success: false });
    let messages = JSON.parse(room.messages || '[]');
    const currentUser = db.prepare(`SELECT username FROM users WHERE id = ?`).get(req.user.id).username;
    
    messages.push({ sender: currentUser, text: message, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
    db.prepare(`UPDATE rooms SET messages = ? WHERE id = ?`).run(JSON.stringify(messages), req.params.id);
    res.json({ success: true });
});

// Admin rotaları
app.get("/api/admin/rooms", authenticateToken, (req, res) => {
    const rooms = db.prepare(`SELECT rooms.*, users.username FROM rooms JOIN users ON rooms.user_id = users.id`).all();
    res.json({ success: true, rooms });
});

app.delete("/api/admin/rooms/:id", authenticateToken, (req, res) => {
    db.prepare(`DELETE FROM rooms WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
});

app.listen(PORT, () => { console.log(`Sunucu aktif: ${PORT}`); });