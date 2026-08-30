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
  CORS & STATİK DOSYALAR (TEMA DÜZELTMESİ)
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
  Kritik Ekleme: index.html, style.css ve app.js 
  dosyalarının tarayıcı tarafından okunabilmesi için 
  aynı klasör statik olarak dışarı açıldı.
*/
app.use(express.static(__dirname));

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
    "Demir 1",
    "Demir 2",
    "Demir 3",

    "Bronz 1",
    "Bronz 2",
    "Bronz 3",

    "Gümüş 1",
    "Gümüş 2",
    "Gümüş 3",

    "Altın 1",
    "Altın 2",
    "Altın 3",

    "Platin 1",
    "Platin 2",
    "Platin 3",

    "Elmas 1",
    "Elmas 2",
    "Elmas 3",

    "Yücelik 1",
    "Yücelik 2",
    "Yücelik 3",

    "Ölümsüzlük 1",
    "Ölümsüzlük 2",
    "Ölümsüzlük 3",

    "Radiant"
];

/*
=====================================================
  RANK NORMALIZE
=====================================================
*/

function normalizeRank(rank) {
    if (rank === null || rank === undefined) {
        return "";
    }

    let value = String(rank)
        .trim()
        .normalize("NFC");

    const brokenMap = {
        "GÃ¼mÃ¼ÅŸ 1": "Gümüş 1",
        "GÃ¼mÃ¼ÅŸ 2": "Gümüş 2",
        "GÃ¼mÃ¼ÅŸ 3": "Gümüş 3",

        "AltÄ±n 1": "Altın 1",
        "AltÄ±n 2": "Altın 2",
        "AltÄ±n 3": "Altın 3",

        "YÃ¼celik 1": "Yücelik 1",
        "YÃ¼celik 2": "Yücelik 2",
        "YÃ¼celik 3": "Yücelik 3",

        "Ã–lÃ¼msÃ¼zlÃ¼k 1": "Ölümsüzlük 1",
        "Ã–lÃ¼msÃ¼zlÃ¼k 2": "Ölümsüzlük 2",
        "Ã–lÃ¼msÃ¼zlÃ¼k 3": "Ölümsüzlük 3",

        "Gumus 1": "Gümüş 1",
        "Gumus 2": "Gümüş 2",
        "Gumus 3": "Gümüş 3",

        "Altin 1": "Altın 1",
        "Altin 2": "Altın 2",
        "Altin 3": "Altın 3",

        "Yucelik 1": "Yücelik 1",
        "Yucelik 2": "Yücelik 2",
        "Yucelik 3": "Yücelik 3",

        "Olumsuzluk 1": "Ölümsüzlük 1",
        "Olumsuzluk 2": "Ölümsüzlük 2",
        "Olumsuzluk 3": "Ölümsüzlük 3"
    };

    if (brokenMap[value]) {
        value = brokenMap[value];
    }

    const lowerValue = value.toLocaleLowerCase("tr-TR");

    const matchedRank = RANK_ORDER.find(
        rank =>
            rank.toLocaleLowerCase("tr-TR") ===
            lowerValue
    );

    return matchedRank || value;
}

function getRankIndex(rank) {
    const normalized = normalizeRank(rank);
    return RANK_ORDER.indexOf(normalized);
}

function isRankCompatible(rank1, rank2) {
    const index1 = getRankIndex(rank1);
    const index2 = getRankIndex(rank2);

    if (index1 === -1 || index2 === -1) {
        return false;
    }

    return Math.abs(index1 - index2) <= 1;
}

function getCompatibleRanks(rank) {
    const index = getRankIndex(rank);

    if (index === -1) {
        return [];
    }

    return RANK_ORDER.filter(
        (_, i) =>
            Math.abs(i - index) <= 1
    );
}

function cleanString(value, maxLength = 255) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .trim()
        .slice(0, maxLength);
}

function isValidUserId(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0;
}

function safeNumber(value, defaultValue = 0, min = 0, max = 1000) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return defaultValue;
    }

    return Math.max(min, Math.min(max, number));
}

/*
=====================================================
  AUTH
=====================================================
*/

function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Giriş yapmanız gerekiyor."
            });
        }

        const token = authHeader.substring(7).trim();

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Geçersiz oturum."
            });
        }

        jwt.verify(token, JWT_SECRET, (error, user) => {
            if (error) {
                return res.status(403).json({
                    success: false,
                    message: "Oturum geçersiz veya süresi dolmuş."
                });
            }

            if (!user || !isValidUserId(user.id)) {
                return res.status(403).json({
                    success: false,
                    message: "Geçersiz kullanıcı oturumu."
                });
            }

            req.user = user;
            next();
        });
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: "Oturum doğrulanamadı."
        });
    }
}

function getUserById(userId) {
    const user = db.prepare(`
        SELECT id, username, valorant_id, rank, role, created_at
        FROM users
        WHERE id = ?
    `).get(userId);

    if (!user) {
        return null;
    }

    user.rank = normalizeRank(user.rank);
    return user;
}

function getLastFiveRankedMatches(userId) {
    return db.prepare(`
        SELECT id, result, agent, map, kills, deaths, assists, rr_change, played_at
        FROM rank_matches
        WHERE user_id = ?
        ORDER BY datetime(played_at) DESC, id DESC
        LIMIT 5
    `).all(userId);
}

function getPlayerWithMatches(userId) {
    const user = getUserById(userId);

    if (!user) {
        return null;
    }

    return {
        id: user.id,
        username: user.username,
        valorant_id: user.valorant_id,
        rank: user.rank,
        role: user.role,
        ranked_matches: getLastFiveRankedMatches(user.id)
    };
}

function getRoomRemainingSeconds(createdAt) {
    if (!createdAt) {
        return 0;
    }

    const createdTime = Date.parse(String(createdAt).replace(" ", "T") + "Z");

    if (!Number.isFinite(createdTime)) {
        return 0;
    }

    const elapsed = Math.floor((Date.now() - createdTime) / 1000);

    return Math.max(0, ROOM_LIFETIME_SECONDS - elapsed);
}

function cleanupExpiredRooms() {
    try {
        const rooms = db.prepare(`SELECT id, created_at FROM rooms`).all();
        const deleteRoom = db.prepare(`DELETE FROM rooms WHERE id = ?`);

        for (const room of rooms) {
            if (getRoomRemainingSeconds(room.created_at) <= 0) {
                deleteRoom.run(room.id);
            }
        }
    } catch (error) {
        console.error("ROOM CLEANUP ERROR:", error);
    }
}

setInterval(cleanupExpiredRooms, 5000);

/*
=====================================================
  ROUTING / ENDPOINTS
=====================================================
*/

app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "5liTakim backend çalışıyor!"
    });
});

app.post("/api/register", async (req, res) => {
    try {
        const { username, valorant_id, rank, role, password } = req.body || {};
        const usernameClean = cleanString(username, 30);
        const valorantIdClean = cleanString(valorant_id, 50);
        const cleanRank = normalizeRank(rank);
        const cleanRole = cleanString(role, 30);

        if (!usernameClean || !valorantIdClean || !cleanRank || !cleanRole || !password) {
            return res.status(400).json({ success: false, message: "Tüm alanları doldurun." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = db.prepare(`
            INSERT INTO users (username, valorant_id, rank, role, password)
            VALUES (?, ?, ?, ?, ?)
        `).run(usernameClean, valorantIdClean, cleanRank, cleanRole, hashedPassword);

        return res.status(201).json({ success: true, message: "Kayıt başarılı!", userId: result.lastInsertRowid });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const usernameClean = cleanString(username, 30);

        const user = db.prepare(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`).get(usernameClean);

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
    } catch (error) {
        return res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

app.get("/api/profile", authenticateToken, (req, res) => {
    const user = getUserById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
    res.json({ success: true, user });
});

app.get("/api/rooms", authenticateToken, (req, res) => {
    cleanupExpiredRooms();
    const rooms = db.prepare(`SELECT rooms.*, users.username, users.valorant_id FROM rooms INNER JOIN users ON rooms.user_id = users.id`).all();
    res.json({ success: true, rooms });
});

/*
=====================================================
  SUNUCUYU BAŞLAT
=====================================================
*/

app.listen(PORT, () => {
    console.log(`Sunucu aktif: http://localhost:${PORT}`);
});