const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'valotakim_gizli_anahtar_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Veritabanı
const db = new Database('valotakim.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    valorant_id TEXT,
    rank TEXT DEFAULT 'Demir 1',
    role TEXT DEFAULT 'Flex',
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    is_banned INTEGER DEFAULT 0,
    ban_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    mode TEXT,
    age TEXT,
    description TEXT,
    agents TEXT DEFAULT '[]',
    microphone INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS room_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS giveaway (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS matchmaking_queue (
    user_id INTEGER PRIMARY KEY,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// İlk admin oluştur
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, valorant_id, rank, role, password_hash, is_admin) VALUES (?, ?, ?, ?, ?, 1)')
    .run('admin', 'Admin#0000', 'Radiant', 'Flex', hash);
  console.log('✅ Admin oluşturuldu: admin / admin123');
}

// Middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, message: 'Token yok' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user || user.is_banned) return res.status(401).json({ success: false, message: 'Geçersiz' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token hatası' });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ success: false, message: 'Admin gerekli' });
  next();
}

// AUTH ENDPOINTS
app.post('/api/register', (req, res) => {
  try {
    const { username, valName, valTag, rank, role, password, passwordConfirm } = req.body;
    if (!username || !valName || !password) return res.json({ success: false, message: 'Tüm alanları doldurun' });
    if (password !== passwordConfirm) return res.json({ success: false, message: 'Şifreler uyuşmuyor' });
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      return res.json({ success: false, message: 'Kullanıcı adı alınmış' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, valorant_id, rank, role, password_hash) VALUES (?, ?, ?, ?, ?)')
      .run(username, `${valName}#${valTag}`, rank || 'Demir 1', role || 'Flex', hash);
    res.json({ success: true, username, userId: result.lastInsertRowid });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: 'Sunucu hatası' });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.json({ success: false, message: 'Kullanıcı bulunamadı' });
    if (user.is_banned) return res.json({ success: false, message: 'Hesap banlandı: ' + (user.ban_reason || '') });
    if (!bcrypt.compareSync(password, user.password_hash)) return res.json({ success: false, message: 'Şifre yanlış' });
    
    const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, valorant_id: user.valorant_id, rank: user.rank, role: user.role, is_admin: !!user.is_admin }
    });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: 'Sunucu hatası' });
  }
});

app.get('/api/profile', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ROOMS
app.get('/api/rooms', (req, res) => {
  const rooms = db.prepare(`
    SELECT r.*, u.username, u.valorant_id as owner_valorant_id, u.rank, u.role as owner_role
    FROM rooms r JOIN users u ON r.user_id = u.id WHERE u.is_banned = 0 ORDER BY r.created_at DESC
  `).all();
  
  const enriched = rooms.map(r => {
    const participants = db.prepare('SELECT u.username FROM room_participants rp JOIN users u ON rp.user_id = u.id WHERE rp.room_id = ?')
      .all(r.id).map(p => p.username);
    const messages = db.prepare('SELECT u.username as sender, m.message as text, m.created_at as time FROM messages m JOIN users u ON m.user_id = u.id WHERE m.room_id = ? ORDER BY m.created_at')
      .all(r.id);
    return { ...r, participants, messages, agents: JSON.parse(r.agents || '[]') };
  });
  
  res.json({ success: true, rooms: enriched });
});

app.post('/api/rooms', authMiddleware, (req, res) => {
  const { mode, age, description, agents, microphone } = req.body;
  const result = db.prepare('INSERT INTO rooms (user_id, mode, age, description, agents, microphone) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.id, mode, age, description || '', JSON.stringify(agents || []), microphone ? 1 : 0);
  res.json({ success: true, roomId: result.lastInsertRowid });
});

app.post('/api/rooms/:id/join', authMiddleware, (req, res) => {
  const roomId = parseInt(req.params.id);
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!room) return res.json({ success: false, message: 'İlan bulunamadı' });
  if (room.user_id === req.user.id) return res.json({ success: false, message: 'Kendi ilanına katılamazsın' });
  
  const participants = db.prepare('SELECT user_id FROM room_participants WHERE room_id = ?').all(roomId);
  if (participants.length >= 4) return res.json({ success: false, message: 'İlan dolu' });
  if (participants.find(p => p.user_id === req.user.id)) return res.json({ success: false, message: 'Zaten katıldın' });
  
  db.prepare('INSERT INTO room_participants (room_id, user_id) VALUES (?, ?)').run(roomId, req.user.id);
  res.json({ success: true });
});

app.post('/api/rooms/:id/message', authMiddleware, (req, res) => {
  const roomId = parseInt(req.params.id);
  const { message } = req.body;
  if (!message?.trim()) return res.json({ success: false, message: 'Mesaj boş' });
  
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!room) return res.json({ success: false, message: 'İlan yok' });
  
  const isOwner = room.user_id === req.user.id;
  const isParticipant = db.prepare('SELECT id FROM room_participants WHERE room_id = ? AND user_id = ?').get(roomId, req.user.id);
  if (!isOwner && !isParticipant) return res.json({ success: false, message: 'Önce katıl' });
  
  db.prepare('INSERT INTO messages (room_id, user_id, message) VALUES (?, ?, ?)').run(roomId, req.user.id, message.trim());
  res.json({ success: true });
});

app.delete('/api/rooms/:id', authMiddleware, (req, res) => {
  const roomId = parseInt(req.params.id);
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!room) return res.json({ success: false, message: 'İlan yok' });
  if (room.user_id !== req.user.id && !req.user.is_admin) return res.json({ success: false, message: 'Yetki yok' });
  
  db.prepare('DELETE FROM messages WHERE room_id = ?').run(roomId);
  db.prepare('DELETE FROM room_participants WHERE room_id = ?').run(roomId);
  db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
  res.json({ success: true });
});

// GIVEAWAY
app.get('/api/giveaway', (req, res) => {
  const participants = db.prepare('SELECT u.username, g.joined_at FROM giveaway g JOIN users u ON g.user_id = u.id ORDER BY g.joined_at').all();
  res.json({ success: true, participants });
});

app.post('/api/giveaway/join', authMiddleware, (req, res) => {
  if (db.prepare('SELECT id FROM giveaway WHERE user_id = ?').get(req.user.id)) {
    return res.json({ success: false, message: 'Zaten katıldınız' });
  }
  db.prepare('INSERT INTO giveaway (user_id) VALUES (?)').run(req.user.id);
  res.json({ success: true });
});

// MATCHMAKING
app.post('/api/matchmaking/join', authMiddleware, (req, res) => {
  if (!db.prepare('SELECT user_id FROM matchmaking_queue WHERE user_id = ?').get(req.user.id)) {
    db.prepare('INSERT INTO matchmaking_queue (user_id) VALUES (?)').run(req.user.id);
  }
  
  const queue = db.prepare('SELECT u.id, u.username, u.rank, u.role FROM matchmaking_queue mq JOIN users u ON mq.user_id = u.id WHERE u.is_banned = 0 ORDER BY mq.joined_at LIMIT 5').all();
  
  if (queue.length === 5) {
    const ids = queue.map(u => u.id);
    db.prepare('DELETE FROM matchmaking_queue WHERE user_id IN (' + ids.join(',') + ')').run();
    
    const room = db.prepare('INSERT INTO rooms (user_id, mode, age, description, agents, microphone) VALUES (?, ?, ?, ?, ?, ?)')
      .run(queue[0].id, 'Dereceli', 'Farketmez', '5\'li eşleşme', '[]', 1);
    const roomId = room.lastInsertRowid;
    
    for (let i = 1; i < 5; i++) {
      db.prepare('INSERT INTO room_participants (room_id, user_id) VALUES (?, ?)').run(roomId, queue[i].id);
    }
    return res.json({ matched: true, team: queue, roomId });
  }
  
  res.json({ matched: false, waiting: queue.length });
});

// ADMIN
app.get('/api/admin/rooms', authMiddleware, adminMiddleware, (req, res) => {
  const rooms = db.prepare('SELECT r.*, u.username FROM rooms r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC').all();
  res.json({ success: true, rooms });
});

app.delete('/api/admin/rooms/:id', authMiddleware, adminMiddleware, (req, res) => {
  const roomId = parseInt(req.params.id);
  db.prepare('DELETE FROM messages WHERE room_id = ?').run(roomId);
  db.prepare('DELETE FROM room_participants WHERE room_id = ?').run(roomId);
  db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
  res.json({ success: true });
});

app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  const users = db.prepare('SELECT id, username, valorant_id, rank, role, is_admin, is_banned, ban_reason, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ success: true, users });
});

app.post('/api/admin/users/:id/ban', authMiddleware, adminMiddleware, (req, res) => {
  const userId = parseInt(req.params.id);
  const { reason } = req.body;
  if (userId === req.user.id) return res.json({ success: false, message: 'Kendini banlayamazsın' });
  
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!target) return res.json({ success: false, message: 'Kullanıcı yok' });
  if (target.is_admin) return res.json({ success: false, message: 'Admin banlanamaz' });
  
  db.prepare('UPDATE users SET is_banned = 1, ban_reason = ? WHERE id = ?').run(reason || 'Kural ihlali', userId);
  db.prepare('DELETE FROM rooms WHERE user_id = ?').run(userId);
  res.json({ success: true });
});

app.post('/api/admin/users/:id/unban', authMiddleware, adminMiddleware, (req, res) => {
  db.prepare('UPDATE users SET is_banned = 0, ban_reason = NULL WHERE id = ?').run(parseInt(req.params.id));
  res.json({ success: true });
});

app.post('/api/admin/users/:id/toggle-admin', authMiddleware, adminMiddleware, (req, res) => {
  const userId = parseInt(req.params.id);
  if (userId === req.user.id) return res.json({ success: false, message: 'Kendini değiştiremezsin' });
  
  const target = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId);
  if (!target) return res.json({ success: false, message: 'Kullanıcı yok' });
  
  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(target.is_admin ? 0 : 1, userId);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🚀 VALOTAKIM çalışıyor: http://localhost:${PORT}`);
  console.log(`📦 Admin: admin / admin123`);
});