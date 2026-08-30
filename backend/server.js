const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();

/*
=====================================================
  GENEL AYARLAR
=====================================================
*/

const PORT = process.env.PORT || 3000;

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "5litakim-gizli-anahtar-2026";

const ROOM_LIFETIME_SECONDS = 180;

/*
=====================================================
  CORS & STATİK DOSYALAR (FRONTEND BAĞLANTISI)
=====================================================
*/

app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(
    express.json({
        limit: "1mb"
    })
);

/* 
  Kritik Düzeltme: index.html, style.css ve app.js 
  dosyalarının bulunduğu ana klasör Express'e tanıtıldı.
*/
app.use(express.static(path.join(__dirname, "../")));

/*
=====================================================
  DATABASE
=====================================================
*/

const db = new Database(
    path.join(__dirname, "5litakim.db")
);

db.pragma("foreign_keys = ON");

/*
=====================================================
  TABLOLAR
=====================================================
*/

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
    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    FOREIGN KEY (receiver_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rank_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    result TEXT NOT NULL,
    agent TEXT,
    map TEXT,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    rr_change INTEGER DEFAULT 0,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);
`);

/*
=====================================================
  RANK SIRALAMASI
=====================================================
*/

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
    if (!rank) return "";
    let value = String(rank).trim().normalize("NFC");
    const brokenMap = {
        "GÃ¼mÃ¼ÅŸ 1": "Gümüş 1", "GÃ¼mÃ¼ÅŸ 2": "Gümüş 2", "GÃ¼mÃ¼ÅŸ 3": "Gümüş 3",
        "AltÄ±n 1": "Altın 1", "AltÄ±n 2": "Altın 2", "AltÄ±n 3": "Altın 3",
        "YÃ¼celik 1": "Yücelik 1", "YÃ¼celik 2": "Yücelik 2", "YÃ¼celik 3": "Yücelik 3",
        "Ã–lÃ¼msÃ¼zlÃ¼k 1": "Ölümsüzlük 1", "Ã–lÃ¼msÃ¼zlÃ¼k 2": "Ölümsüzlük 2", "Ã–lÃ¼msÃ¼zlÃ¼k 3": "Ölümsüzlük 3"
    };
    if (brokenMap[value]) value = brokenMap[value];
    const lowerValue = value.toLocaleLowerCase("tr-TR");
    return RANK_ORDER.find(r => r.toLocaleLowerCase("tr-TR") === lowerValue) || value;
}

function getRankIndex(rank) {
    return RANK_ORDER.indexOf(normalizeRank(rank));
}

function isRankCompatible(rank1, rank2) {
    const i1 = getRankIndex(rank1);
    const i2 = getRankIndex(rank2);
    if (i1 === -1 || i2 === -1) return false;
    return Math.abs(i1 - i2) <= 1;
}

function cleanString(value, maxLength = 255) {
    if (!value) return "";
    return String(value).trim().slice(0, maxLength);
}

function isValidUserId(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0;
}

/*
=====================================================
  AUTH MIDDLEWARE
=====================================================
*/

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Giriş yapmanız gerekiyor." });
    }
    const token = authHeader.substring(7).trim();
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: "Oturum geçersiz." });
        req.user = user;
        next();
    });
}

function getUserById(userId) {
    const user = db.prepare(`SELECT id, username, valorant_id, rank, role, created_at FROM users WHERE id = ?`).get(userId);
    if (!user) return null;
    user.rank = normalizeRank(user.rank);
    return user;
}

/*
=====================================================
  API ENDPOINTS
=====================================================
*/

app.get("/api/test", (req, res) => {
    res.json({ success: true, message: "5liTakim backend çalışıyor!" });
});

app.post("/api/register", async (req, res) => {
    try {
        const { username, valorant_id, rank, role, password } = req.body || {};
        const uClean = cleanString(username, 30);
        const vClean = cleanString(valorant_id, 50);
        const rClean = normalizeRank(rank);
        const roleClean = cleanString(role, 30);

        if (!uClean || !vClean || !rClean || !roleClean || !password) {
            return res.status(400).json({ success: false, message: "Tüm alanları doldurun." });
        }

        const hashed = await bcrypt.hash(password, 10);
        const result = db.prepare(`
            INSERT INTO users (username, valorant_id, rank, role, password)
            VALUES (?, ?, ?, ?, ?)
        `).run(uClean, vClean, rClean, roleClean, hashed);

        return res.status(201).json({ success: true, message: "Kayıt başarılı!", userId: result.lastInsertRowid });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Sunucu hatası veya kullanıcı adı kullanımda." });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const uClean = cleanString(username, 30);
        const user = db.prepare(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`).get(uClean);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, message: "Kullanıcı adı veya şifre yanlış." });
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
                role: user.role
            }
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

app.get("/api/profile", authenticateToken, (req, res) => {
    const user = getUserById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "Bulunamadı." });
    res.json({ success: true, user });
});

app.get("/api/rooms", authenticateToken, (req, res) => {
    const rooms = db.prepare(`SELECT rooms.*, users.username, users.valorant_id FROM rooms INNER JOIN users ON rooms.user_id = users.id`).all();
    res.json({ success: true, rooms });
});

/*
=====================================================
  ANA SAYFA YÖNLENDİRMESİ (Cannot GET / Çözümü)
=====================================================
*/
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../index.html"));
});

/*
=====================================================
  SUNUCUYU BAŞLAT
=====================================================
*/
app.listen(PORT, () => {
    console.log(`Sunucu aktif: http://localhost:${PORT}`);
});