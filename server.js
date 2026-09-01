const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "valotakim-gizli-anahtar";
const ADMIN_USERNAME = "admin"; // Admin kullanıcı adı

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(__dirname));

const db = new Database("valotakim.db");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  valorant_id TEXT NOT NULL,
  rank TEXT NOT NULL,
  role TEXT NOT NULL,
  password TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mode TEXT NOT NULL,
  age TEXT NOT NULL,
  microphone INTEGER DEFAULT 1,
  description TEXT,
  agents TEXT DEFAULT '[]',
  participants TEXT DEFAULT '[]',
  messages TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS giveaway (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  username TEXT NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  username TEXT NOT NULL,
  rank TEXT NOT NULL,
  role TEXT NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

// İlk admin oluştur
const adminExists = db.prepare(`SELECT id FROM users WHERE username = ?`).get(ADMIN_USERNAME);
if (!adminExists) {
  db.prepare(`INSERT INTO users (username, valorant_id, rank, role, password, is_admin) VALUES (?, ?, ?, ?, ?, 1)`)
    .run(ADMIN_USERNAME, "Admin#0001", "Radiant", "Flex", "admin123");
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ success: false });
  jwt.verify(authHeader.substring(7), JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false });
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  const u = db.prepare(`SELECT is_admin FROM users WHERE id = ?`).get(req.user.id);
  if (!u || !u.is_admin) return res.status(403).json({ success: false, message: "Admin yetkisi gerekli" });
  next();
}

// RANK SIRASI (eşleşme için)
const RANK_ORDER = [
  "Demir 1","Demir 2","Demir 3",
  "Bronz 1","Bronz 2","Bronz 3",
  "Gümüş 1","Gümüş 2","Gümüş 3",
  "Altın 1","Altın 2","Altın 3",
  "Platin 1","Platin 2","Platin 3",
  "Elmas 1","Elmas 2","Elmas 3",
  "Yücelik 1","Yücelik 2","Yücelik 3",
  "Ölümsüzlük 1","Ölümsüzlük 2","Ölümsüzlük 3",
  "Radiant"
];

// === KAYIT ===
app.post("/api/register", (req, res) => {
  try {
    let { username, valName, valTag, rank, role, password, passwordConfirm } = req.body;
    if (!username || !valName || !valTag || !rank || !role || !password) {
      return res.status(400).json({ success: false, message: "Tüm alanları doldurun!" });
    }
    if (password !== passwordConfirm) {
      return res.status(400).json({ success: false, message: "Şifreler uyuşmuyor!" });
    }
    const valorant_id = `${valName}#${valTag}`;
    const existing = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username);
    if (existing) username = `${username}_${Math.floor(100 + Math.random() * 900)}`;
    db.prepare(`INSERT INTO users (username, valorant_id, rank, role, password) VALUES (?, ?, ?, ?, ?)`)
      .run(username, valorant_id, rank, role, password);
    res.json({ success: true, username });
  } catch (e) {
    res.status(500).json({ success: false, message: "Kayıt hatası: " + e.message });
  }
});

// === GİRİŞ ===
app.post("/api/login", (req, res) => {
  try {
    const { username, password } = req.body;
    const user = db.prepare(`SELECT * FROM users WHERE username = ? AND password = ?`).get(username, password);
    if (!user) return res.status(400).json({ success: false, message: "Hatalı kullanıcı adı veya şifre!" });
    const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, token, user: { id: user.id, username: user.username, is_admin: user.is_admin } });
  } catch (e) {
    res.status(500).json({ success: false, message: "Giriş hatası" });
  }
});

// === PROFİL ===
app.get("/api/profile", authenticateToken, (req, res) => {
  const user = db.prepare(`SELECT id, username, valorant_id, rank, role, is_admin FROM users WHERE id = ?`).get(req.user.id);
  res.json({ success: true, user });
});

app.put("/api/profile", authenticateToken, (req, res) => {
  const { valorant_id, rank, role } = req.body;
  db.prepare(`UPDATE users SET valorant_id = ?, rank = ?, role = ? WHERE id = ?`)
    .run(valorant_id, rank, role, req.user.id);
  res.json({ success: true });
});

// === İLANLAR ===
app.get("/api/rooms", authenticateToken, (req, res) => {
  try {
    const rooms = db.prepare(`SELECT rooms.*, users.username, users.valorant_id as owner_valorant_id, users.rank, users.role as owner_role 
      FROM rooms JOIN users ON rooms.user_id = users.id ORDER BY rooms.id DESC`).all()
      .map(r => ({
        ...r,
        agents: JSON.parse(r.agents || '[]'),
        participants: JSON.parse(r.participants || '[]'),
        messages: JSON.parse(r.messages || '[]')
      }));
    res.json({ success: true, rooms });
  } catch (e) { res.status(500).json({ success: false }); }
});

app.post("/api/rooms", authenticateToken, (req, res) => {
  const { mode, age, description, agents, microphone } = req.body;
  db.prepare(`INSERT INTO rooms (user_id, mode, age, description, agents, microphone) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(req.user.id, mode, age, description || "", JSON.stringify(agents || []), microphone ? 1 : 0);
  res.json({ success: true });
});

app.post("/api/rooms/:id/join", authenticateToken, (req, res) => {
  const room = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(req.params.id);
  if (!room) return res.json({ success: false, message: "İlan bulunamadı" });
  let participants = JSON.parse(room.participants || '[]');
  const user = db.prepare(`SELECT username FROM users WHERE id = ?`).get(req.user.id);
  if (!participants.includes(user.username) && room.user_id !== req.user.id) {
    participants.push(user.username);
    db.prepare(`UPDATE rooms SET participants = ? WHERE id = ?`).run(JSON.stringify(participants), req.params.id);
  }
  res.json({ success: true, participants });
});

app.post("/api/rooms/:id/message", authenticateToken, (req, res) => {
  const { message } = req.body;
  const room = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(req.params.id);
  if (!room) return res.json({ success: false });
  let messages = JSON.parse(room.messages || '[]');
  const user = db.prepare(`SELECT username FROM users WHERE id = ?`).get(req.user.id);
  messages.push({ sender: user.username, text: message, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) });
  db.prepare(`UPDATE rooms SET messages = ? WHERE id = ?`).run(JSON.stringify(messages), req.params.id);
  res.json({ success: true });
});

// === 5'Lİ TAKIM EŞLEŞTİRME ===
app.post("/api/matchmaking/join", authenticateToken, (req, res) => {
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
  // Kuyruğa ekle (varsa güncelle)
  db.prepare(`INSERT INTO matchmaking_queue (user_id, username, rank, role) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET rank=excluded.rank, role=excluded.role, joined_at=CURRENT_TIMESTAMP`)
    .run(user.id, user.username, user.rank, user.role);
  
  // Uygun eşleşmeleri bul (±3 rank aralığı)
  const myIdx = RANK_ORDER.indexOf(user.rank);
  const queue = db.prepare(`SELECT * FROM matchmaking_queue WHERE user_id != ?`).all();
  
  const suitable = queue.filter(q => {
    const qIdx = RANK_ORDER.indexOf(q.rank);
    return Math.abs(myIdx - qIdx) <= 3;
  });

  // 4 kişi bulunduysa takım oluştur
  if (suitable.length >= 4) {
    const team = [user, ...suitable.slice(0, 4)];
    // Kuyruktan kaldır
    team.forEach(t => db.prepare(`DELETE FROM matchmaking_queue WHERE user_id = ?`).run(t.id));
    // Yeni oda oluştur
    const agents = JSON.stringify([]);
    db.prepare(`INSERT INTO rooms (user_id, mode, age, description, agents) VALUES (?, ?, ?, ?, ?)`)
      .run(user.id, "Dereceli", "Farketmez", "🎯 Eşleşme ile oluşturulan 5'li takım!", agents);
    const newRoom = db.prepare(`SELECT * FROM rooms ORDER BY id DESC LIMIT 1`).get();
    const participants = team.map(t => t.username);
    db.prepare(`UPDATE rooms SET participants = ? WHERE id = ?`).run(JSON.stringify(participants), newRoom.id);
    return res.json({ success: true, matched: true, team: team.map(t => ({ username: t.username, rank: t.rank, role: t.role })), roomId: newRoom.id });
  }
  
  res.json({ success: true, matched: false, waiting: suitable.length + 1, needed: 5 });
});

app.post("/api/matchmaking/cancel", authenticateToken, (req, res) => {
  db.prepare(`DELETE FROM matchmaking_queue WHERE user_id = ?`).run(req.user.id);
  res.json({ success: true });
});

// === ÇEKİLİŞ ===
app.get("/api/giveaway", (req, res) => {
  const participants = db.prepare(`SELECT username, joined_at FROM giveaway ORDER BY joined_at ASC`).all();
  res.json({ success: true, participants });
});

app.post("/api/giveaway/join", authenticateToken, (req, res) => {
  try {
    const user = db.prepare(`SELECT username FROM users WHERE id = ?`).get(req.user.id);
    const existing = db.prepare(`SELECT id FROM giveaway WHERE user_id = ?`).get(req.user.id);
    if (existing) return res.json({ success: false, message: "Zaten katıldınız!" });
    db.prepare(`INSERT INTO giveaway (user_id, username) VALUES (?, ?)`).run(req.user.id, user.username);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// === ADMIN ===
app.get("/api/admin/rooms", authenticateToken, requireAdmin, (req, res) => {
  const rooms = db.prepare(`SELECT rooms.*, users.username FROM rooms JOIN users ON rooms.user_id = users.id ORDER BY rooms.id DESC`).all();
  res.json({ success: true, rooms });
});

app.delete("/api/admin/rooms/:id", authenticateToken, requireAdmin, (req, res) => {
  db.prepare(`DELETE FROM rooms WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

app.get("/api/admin/users", authenticateToken, requireAdmin, (req, res) => {
  const users = db.prepare(`SELECT id, username, valorant_id, rank, role, is_admin, created_at FROM users`).all();
  res.json({ success: true, users });
});

app.listen(PORT, () => { console.log(`✅ VALOTAKIM Sunucu aktif: http://localhost:${PORT}`); });