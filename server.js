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

/* =====================================================
   CORS + JSON
===================================================== */
app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(express.json());

/* =====================================================
   STATİK DOSYALAR
===================================================== */
app.use(express.static(path.join(__dirname, "../")));

/* =====================================================
   DATABASE (Bellek İçi veya Dosya Modu)
===================================================== */
// Render disk sorununu ve kullanıcı çakışmalarını tamamen önlemek için bellek tabanlı veritabanı
const db = new Database(":memory:");

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

    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
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
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
`);

/* =====================================================
   RANK SIRALAMASI
===================================================== */
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

function getRankIndex(rank) {
    return RANK_ORDER.indexOf(normalizeRank(rank));
}

function isRankCompatible(rank1, rank2) {
    const index1 = getRankIndex(rank1);
    const index2 = getRankIndex(rank2);
    if (index1 === -1 || index2 === -1) return false;
    return Math.abs(index1 - index2) <= 1;
}

function getCompatibleRanks(rank) {
    const index = getRankIndex(rank);
    if (index === -1) return [];
    const result = [];
    for (let i = 0; i < RANK_ORDER.length; i++) {
        if (Math.abs(i - index) <= 1) {
            result.push(RANK_ORDER[i]);
        }
    }
    return result;
}

/* =====================================================
   AUTH MIDDLEWARE
===================================================== */
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Giriş yapmanız gerekiyor." });
    }
    const token = authHeader.substring(7);
    jwt.verify(token, JWT_SECRET, (error, user) => {
        if (error) {
            return res.status(403).json({ success: false, message: "Oturum geçersiz veya süresi dolmuş." });
        }
        req.user = user;
        next();
    });
}

function getUserById(userId) {
    const user = db.prepare(`
        SELECT id, username, valorant_id, rank, role, agent, created_at 
        FROM users WHERE id = ?
    `).get(userId);
    if (!user) return null;
    user.rank = normalizeRank(user.rank);
    return user;
}

function getLastFiveRankedMatches(userId) {
    return db.prepare(`
        SELECT id, result, agent, map, kills, deaths, assists, rr_change, played_at 
        FROM rank_matches WHERE user_id = ? 
        ORDER BY datetime(played_at) DESC, id DESC LIMIT 5
    `).all(userId);
}

function getPlayerWithMatches(userId) {
    const user = getUserById(userId);
    if (!user) return null;
    return {
        id: user.id,
        username: user.username,
        valorant_id: user.valorant_id,
        rank: user.rank,
        role: user.role,
        agent: user.agent || 'Jett',
        ranked_matches: getLastFiveRankedMatches(user.id)
    };
}

function getRoomRemainingSeconds(createdAt) {
    if (!createdAt) return 0;
    const createdTime = new Date(String(createdAt).replace(" ", "T") + "Z").getTime();
    if (Number.isNaN(createdTime)) return 0;
    const elapsed = Math.floor((Date.now() - createdTime) / 1000);
    return Math.max(0, ROOM_LIFETIME_SECONDS - elapsed);
}

function cleanupExpiredRooms() {
    try {
        const rooms = db.prepare(`SELECT id, created_at FROM rooms`).all();
        for (const room of rooms) {
            if (getRoomRemainingSeconds(room.created_at) <= 0) {
                db.prepare(`DELETE FROM rooms WHERE id = ?`).run(room.id);
            }
        }
    } catch (error) {
        console.error("ROOM CLEANUP ERROR:", error);
    }
}

setInterval(cleanupExpiredRooms, 5000);

/* =====================================================
   ROTALAR
===================================================== */
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../index.html"));
});

app.get("/api/test", (req, res) => {
    res.json({ success: true, message: "5liTakim backend çalışıyor!" });
});

app.post("/api/register", async (req, res) => {
    try {
        const { username, valorant_id, rank, role, password, agent } = req.body;
        if (!username || !valorant_id || !rank || !role || !password) {
            return res.status(400).json({ success: false, message: "Tüm alanları doldurun." });
        }

        const usernameClean = String(username).trim();
        const existingUser = db.prepare(`SELECT id FROM users WHERE LOWER(username) = LOWER(?)`).get(usernameClean);
        if (existingUser) {
            return res.status(409).json({ success: false, message: "Bu kullanıcı adı zaten kullanılıyor." });
        }

        const hashedPassword = await bcrypt.hash(String(password), 10);
        const result = db.prepare(`
            INSERT INTO users (username, valorant_id, rank, role, agent, password)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(usernameClean, String(valorant_id).trim(), normalizeRank(rank), String(role).trim(), agent || 'Jett', hashedPassword);

        // Yeni kullanıcıya varsayılan 5 maç geçmişi ekle (G, G, M, B, G)
        const defaultResults = ['G', 'G', 'M', 'B', 'G'];
        const insertMatch = db.prepare(`INSERT INTO rank_matches (user_id, result, agent, map) VALUES (?, ?, 'Jett', 'Ascent')`);
        defaultResults.forEach(resType => {
            insertMatch.run(result.lastInsertRowid, resType);
        });

        res.status(201).json({ success: true, message: "Kayıt başarılı!", userId: result.lastInsertRowid });
    } catch (error) {
        console.error("REGISTER ERROR:", error);
        res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: "Kullanıcı adı ve şifre gerekli." });
        }

        const user = db.prepare(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`).get(String(username).trim());
        if (!user || !(await bcrypt.compare(String(password), user.password))) {
            return res.status(401).json({ success: false, message: "Kullanıcı adı veya şifre yanlış." });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });

        res.json({
            success: true,
            message: "Giriş başarılı!",
            token,
            user: {
                id: user.id,
                username: user.username,
                valorant_id: user.valorant_id,
                rank: normalizeRank(user.rank),
                role: user.role,
                agent: user.agent || 'Jett',
                matches: getLastFiveRankedMatches(user.id).map(m => m.result).join('')
            }
        });
    } catch (error) {
        console.error("LOGIN ERROR:", error);
        res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

app.get("/api/profile", authenticateToken, (req, res) => {
    try {
        const user = getUserById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: "Profil alınamadı." });
    }
});

app.put("/api/profile", authenticateToken, async (req, res) => {
    try {
        const { valorant_id, rank, role, agent, password } = req.body;
        const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });

        let newPass = user.password;
        if (password && String(password).trim().length >= 6) {
            newPass = await bcrypt.hash(String(password).trim(), 10);
        }

        db.prepare(`
            UPDATE users SET valorant_id = ?, rank = ?, role = ?, agent = ?, password = ? WHERE id = ?
        `).run(valorant_id || user.valorant_id, normalizeRank(rank || user.rank), role || user.role, agent || user.agent, newPass, user.id);

        res.json({ success: true, message: "Profil başarıyla güncellendi.", user: getUserById(user.id) });
    } catch (error) {
        res.status(500).json({ success: false, message: "Profil güncellenemedi." });
    }
});

app.get("/api/rooms", authenticateToken, (req, res) => {
    try {
        cleanupExpiredRooms();
        const currentUser = getUserById(req.user.id);
        const searchRank = normalizeRank(currentUser.rank);

        const rooms = db.prepare(`
            SELECT rooms.id, rooms.rank, rooms.role, rooms.mode, rooms.age, rooms.microphone, rooms.description, rooms.created_at, rooms.user_id, users.username, users.valorant_id
            FROM rooms INNER JOIN users ON rooms.user_id = users.id ORDER BY rooms.id DESC
        `).all();

        const finalRooms = rooms.filter(room => isRankCompatible(searchRank, room.rank)).map(room => {
            const owner = getPlayerWithMatches(room.user_id);
            return {
                ...room,
                rank: normalizeRank(room.rank),
                remaining_seconds: getRoomRemainingSeconds(room.created_at),
                max_seconds: ROOM_LIFETIME_SECONDS,
                owner,
                last_five_ranked_matches: owner ? owner.ranked_matches : []
            };
        });

        res.json({ success: true, rooms: finalRooms, searchRank });
    } catch (error) {
        res.status(500).json({ success: false, message: "İlanlar alınamadı." });
    }
});

app.post("/api/rooms", authenticateToken, (req, res) => {
    try {
        const { role, mode, age, microphone, description } = req.body;
        const currentUser = getUserById(req.user.id);

        db.prepare(`DELETE FROM rooms WHERE user_id = ?`).run(req.user.id);

        const result = db.prepare(`
            INSERT INTO rooms (user_id, rank, role, mode, age, microphone, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(req.user.id, currentUser.rank, role, mode, age, microphone ? 1 : 0, description || "");

        res.status(201).json({ success: true, message: "İlan oluşturuldu." });
    } catch (error) {
        res.status(500).json({ success: false, message: "İlan oluşturulamadı." });
    }
});

app.get("/api/matchmaking", authenticateToken, (req, res) => {
    try {
        const currentUser = getUserById(req.user.id);
        const otherUsers = db.prepare(`SELECT id FROM users WHERE id != ? LIMIT 4`).all(req.user.id);

        const players = [
            getPlayerWithMatches(currentUser.id),
            ...otherUsers.map(u => getPlayerWithMatches(u.id))
        ];

        res.json({
            success: true,
            teamReady: players.length >= 5,
            searchRank: currentUser.rank,
            playerCount: players.length,
            players
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Eşleşme hatası." });
    }
});

/* =====================================================
   SUNUCUYU BAŞLAT
===================================================== */
app.listen(PORT, () => {
    console.log(`Sunucu aktif: http://localhost:${PORT}`);
});