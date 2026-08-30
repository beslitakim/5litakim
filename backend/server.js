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

const PORT = 3000;

/*
  ÜRETİMDE BUNU .env DOSYASINDAN ALMAN ÖNERİLİR.
*/
const JWT_SECRET =
    process.env.JWT_SECRET ||
    "5litakim-gizli-anahtar-2026";

const ROOM_LIFETIME_SECONDS = 180;

/*
=====================================================
  CORS
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

    /*
      Eski bozuk UTF-8 kayıtlarını düzelt.
    */
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

    /*
      Büyük/küçük harf kaynaklı problemleri çöz.
    */
    const lowerValue = value.toLocaleLowerCase("tr-TR");

    const matchedRank = RANK_ORDER.find(
        rank =>
            rank.toLocaleLowerCase("tr-TR") ===
            lowerValue
    );

    return matchedRank || value;
}

/*
=====================================================
  RANK INDEX
=====================================================
*/

function getRankIndex(rank) {
    const normalized = normalizeRank(rank);

    return RANK_ORDER.indexOf(normalized);
}

/*
=====================================================
  RANK UYUMLULUK
=====================================================
*/

function isRankCompatible(rank1, rank2) {
    const index1 = getRankIndex(rank1);
    const index2 = getRankIndex(rank2);

    if (index1 === -1 || index2 === -1) {
        return false;
    }

    return Math.abs(index1 - index2) <= 1;
}

/*
=====================================================
  UYUMLU RANKLAR
=====================================================
*/

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

/*
=====================================================
  YARDIMCI FONKSİYONLAR
=====================================================
*/

function cleanString(value, maxLength = 255) {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .trim()
        .slice(0, maxLength);
}

function isValidUserId(value) {
    const number = Number(value);

    return (
        Number.isInteger(number) &&
        number > 0
    );
}

function safeNumber(
    value,
    defaultValue = 0,
    min = 0,
    max = 1000
) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return defaultValue;
    }

    return Math.max(
        min,
        Math.min(max, number)
    );
}

/*
=====================================================
  AUTH
=====================================================
*/

function authenticateToken(req, res, next) {
    try {
        const authHeader =
            req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message:
                    "Giriş yapmanız gerekiyor."
            });
        }

        if (
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Geçersiz oturum."
            });
        }

        const token =
            authHeader.substring(7).trim();

        if (!token) {
            return res.status(401).json({
                success: false,
                message:
                    "Geçersiz oturum."
            });
        }

        jwt.verify(
            token,
            JWT_SECRET,
            (error, user) => {
                if (error) {
                    return res.status(403).json({
                        success: false,
                        message:
                            "Oturum geçersiz veya süresi dolmuş."
                    });
                }

                if (
                    !user ||
                    !isValidUserId(user.id)
                ) {
                    return res.status(403).json({
                        success: false,
                        message:
                            "Geçersiz kullanıcı oturumu."
                    });
                }

                req.user = user;

                next();
            }
        );
    } catch (error) {
        console.error(
            "AUTH ERROR:",
            error
        );

        return res.status(403).json({
            success: false,
            message:
                "Oturum doğrulanamadı."
        });
    }
}

/*
=====================================================
  KULLANICI BİLGİSİ
=====================================================
*/

function getUserById(userId) {
    const user =
        db.prepare(`
            SELECT
                id,
                username,
                valorant_id,
                rank,
                role,
                created_at
            FROM users
            WHERE id = ?
        `).get(userId);

    if (!user) {
        return null;
    }

    user.rank =
        normalizeRank(user.rank);

    return user;
}

/*
=====================================================
  SON 5 DERECELİ MAÇ
=====================================================
*/

function getLastFiveRankedMatches(userId) {
    return db.prepare(`
        SELECT
            id,
            result,
            agent,
            map,
            kills,
            deaths,
            assists,
            rr_change,
            played_at
        FROM rank_matches
        WHERE user_id = ?
        ORDER BY datetime(played_at) DESC, id DESC
        LIMIT 5
    `).all(userId);
}

/*
=====================================================
  OYUNCU + MAÇLAR
=====================================================
*/

function getPlayerWithMatches(userId) {
    const user =
        getUserById(userId);

    if (!user) {
        return null;
    }

    return {
        id: user.id,
        username: user.username,
        valorant_id: user.valorant_id,
        rank: user.rank,
        role: user.role,
        ranked_matches:
            getLastFiveRankedMatches(
                user.id
            )
    };
}

/*
=====================================================
  İLAN SÜRESİ
=====================================================
*/

function getRoomRemainingSeconds(createdAt) {
    if (!createdAt) {
        return 0;
    }

    /*
      SQLite CURRENT_TIMESTAMP:
      YYYY-MM-DD HH:MM:SS UTC
    */

    const createdTime =
        Date.parse(
            String(createdAt).replace(
                " ",
                "T"
            ) + "Z"
        );

    if (!Number.isFinite(createdTime)) {
        return 0;
    }

    const elapsed =
        Math.floor(
            (Date.now() - createdTime) /
            1000
        );

    return Math.max(
        0,
        ROOM_LIFETIME_SECONDS - elapsed
    );
}

/*
=====================================================
  SÜRESİ DOLAN İLANLARI TEMİZLE
=====================================================
*/

function cleanupExpiredRooms() {
    try {
        const rooms =
            db.prepare(`
                SELECT
                    id,
                    created_at
                FROM rooms
            `).all();

        const deleteRoom =
            db.prepare(`
                DELETE FROM rooms
                WHERE id = ?
            `);

        for (const room of rooms) {
            const remaining =
                getRoomRemainingSeconds(
                    room.created_at
                );

            if (remaining <= 0) {
                deleteRoom.run(room.id);

                console.log(
                    `Süresi dolan ilan silindi: #${room.id}`
                );
            }
        }
    } catch (error) {
        console.error(
            "ROOM CLEANUP ERROR:",
            error
        );
    }
}

/*
=====================================================
  OTOMATİK TEMİZLEME
=====================================================
*/

setInterval(
    cleanupExpiredRooms,
    5000
);

/*
=====================================================
  ANA TEST
=====================================================
*/

app.get("/", (req, res) => {
    res.json({
        success: true,
        message:
            "5liTakim backend çalışıyor!",
        port: PORT,
        roomLifetime:
            ROOM_LIFETIME_SECONDS
    });
});

/*
=====================================================
  API TEST
=====================================================
*/

app.get("/api/test", (req, res) => {
    res.json({
        success: true,

        message:
            "5liTakim backend çalışıyor!",

        rankSystem:
            "±1 rank aktif",

        roomSystem:
            "3 dakika aktif",

        roomLifetimeSeconds:
            ROOM_LIFETIME_SECONDS,

        rankedMatchSystem:
            "Son 5 dereceli maç aktif",

        chatSystem:
            "İki kişilik sohbet aktif",

        ranks:
            RANK_ORDER
    });
});

/*
=====================================================
  REGISTER
=====================================================
*/

app.post(
    "/api/register",
    async (req, res) => {
        try {
            const {
                username,
                valorant_id,
                rank,
                role,
                password
            } = req.body || {};

            const usernameClean =
                cleanString(
                    username,
                    30
                );

            const valorantIdClean =
                cleanString(
                    valorant_id,
                    50
                );

            const cleanRank =
                normalizeRank(rank);

            const cleanRole =
                cleanString(
                    role,
                    30
                );

            if (
                !usernameClean ||
                !valorantIdClean ||
                !cleanRank ||
                !cleanRole ||
                !password
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Tüm alanları doldurun."
                });
            }

            if (
                usernameClean.length < 3
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Kullanıcı adı en az 3 karakter olmalıdır."
                });
            }

            if (
                password.length < 6
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Şifre en az 6 karakter olmalıdır."
                });
            }

            if (
                getRankIndex(cleanRank) === -1
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Geçersiz rank."
                });
            }

            const existingUser =
                db.prepare(`
                    SELECT id
                    FROM users
                    WHERE LOWER(username) =
                          LOWER(?)
                `).get(usernameClean);

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Bu kullanıcı adı zaten kullanılıyor."
                });
            }

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );

            const result =
                db.prepare(`
                    INSERT INTO users
                    (
                        username,
                        valorant_id,
                        rank,
                        role,
                        password
                    )
                    VALUES (?, ?, ?, ?, ?)
                `).run(
                    usernameClean,
                    valorantIdClean,
                    cleanRank,
                    cleanRole,
                    hashedPassword
                );

            return res.status(201).json({
                success: true,

                message:
                    "Kayıt başarılı!",

                userId:
                    result.lastInsertRowid
            });
        } catch (error) {
            console.error(
                "REGISTER ERROR:",
                error
            );

            if (
                String(error.message).includes(
                    "UNIQUE constraint failed"
                )
            ) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Bu kullanıcı adı zaten kullanılıyor."
                });
            }

            return res.status(500).json({
                success: false,
                message:
                    "Sunucu hatası."
            });
        }
    }
);

/*
=====================================================
  LOGIN
=====================================================
*/

app.post(
    "/api/login",
    async (req, res) => {
        try {
            const {
                username,
                password
            } = req.body || {};

            const usernameClean =
                cleanString(
                    username,
                    30
                );

            if (
                !usernameClean ||
                !password
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Kullanıcı adı ve şifre gerekli."
                });
            }

            const user =
                db.prepare(`
                    SELECT *
                    FROM users
                    WHERE LOWER(username) =
                          LOWER(?)
                `).get(
                    usernameClean
                );

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Kullanıcı adı veya şifre yanlış."
                });
            }

            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );

            if (!passwordMatch) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Kullanıcı adı veya şifre yanlış."
                });
            }

            const token =
                jwt.sign(
                    {
                        id: user.id,
                        username:
                            user.username
                    },
                    JWT_SECRET,
                    {
                        expiresIn: "7d"
                    }
                );

            return res.json({
                success: true,

                message:
                    "Giriş başarılı!",

                token,

                user: {
                    id: user.id,
                    username:
                        user.username,
                    valorant_id:
                        user.valorant_id,
                    rank:
                        normalizeRank(
                            user.rank
                        ),
                    role:
                        user.role
                }
            });
        } catch (error) {
            console.error(
                "LOGIN ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Sunucu hatası."
            });
        }
    }
);

/*
=====================================================
  PROFILE GET
=====================================================
*/

app.get(
    "/api/profile",
    authenticateToken,
    (req, res) => {
        try {
            const user =
                getUserById(
                    req.user.id
                );

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Kullanıcı bulunamadı."
                });
            }

            return res.json({
                success: true,
                user
            });
        } catch (error) {
            console.error(
                "PROFILE ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Profil alınamadı."
            });
        }
    }
);

/*
=====================================================
  PROFILE UPDATE
=====================================================
*/

app.put(
    "/api/profile",
    authenticateToken,
    async (req, res) => {
        try {
            const {
                valorant_id,
                rank,
                role,
                password
            } = req.body || {};

            const valorantIdClean =
                cleanString(
                    valorant_id,
                    50
                );

            const cleanRank =
                normalizeRank(rank);

            const cleanRole =
                cleanString(
                    role,
                    30
                );

            if (
                !valorantIdClean ||
                !cleanRank ||
                !cleanRole
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Valorant ID, rank ve rol gerekli."
                });
            }

            if (
                getRankIndex(cleanRank) === -1
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Geçersiz rank."
                });
            }

            if (
                password &&
                password.length < 6
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Yeni şifre en az 6 karakter olmalıdır."
                });
            }

            if (password) {
                const hashedPassword =
                    await bcrypt.hash(
                        password,
                        10
                    );

                db.prepare(`
                    UPDATE users
                    SET
                        valorant_id = ?,
                        rank = ?,
                        role = ?,
                        password = ?
                    WHERE id = ?
                `).run(
                    valorantIdClean,
                    cleanRank,
                    cleanRole,
                    hashedPassword,
                    req.user.id
                );
            } else {
                db.prepare(`
                    UPDATE users
                    SET
                        valorant_id = ?,
                        rank = ?,
                        role = ?
                    WHERE id = ?
                `).run(
                    valorantIdClean,
                    cleanRank,
                    cleanRole,
                    req.user.id
                );
            }

            const updatedUser =
                getUserById(
                    req.user.id
                );

            return res.json({
                success: true,

                message:
                    "Profil başarıyla güncellendi.",

                user:
                    updatedUser
            });
        } catch (error) {
            console.error(
                "PROFILE UPDATE ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Profil güncellenemedi."
            });
        }
    }
);

/*
=====================================================
  DERECELİ MAÇ EKLE
=====================================================
*/

app.post(
    "/api/ranked-matches",
    authenticateToken,
    (req, res) => {
        try {
            const {
                result,
                agent,
                map,
                kills,
                deaths,
                assists,
                rr_change,
                played_at
            } = req.body || {};

            const cleanResult =
                cleanString(
                    result,
                    10
                ).toUpperCase();

            if (
                !["WIN", "LOSS"].includes(
                    cleanResult
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Sonuç WIN veya LOSS olmalıdır."
                });
            }

            const cleanKills =
                Math.floor(
                    safeNumber(
                        kills,
                        0,
                        0,
                        100
                    )
                );

            const cleanDeaths =
                Math.floor(
                    safeNumber(
                        deaths,
                        0,
                        0,
                        100
                    )
                );

            const cleanAssists =
                Math.floor(
                    safeNumber(
                        assists,
                        0,
                        0,
                        100
                    )
                );

            const cleanRR =
                Math.floor(
                    safeNumber(
                        rr_change,
                        0,
                        -100,
                        100
                    )
                );

            const cleanAgent =
                cleanString(
                    agent,
                    50
                );

            const cleanMap =
                cleanString(
                    map,
                    50
                );

            const cleanPlayedAt =
                played_at
                    ? cleanString(
                          played_at,
                          50
                      )
                    : null;

            const resultDb =
                db.prepare(`
                    INSERT INTO rank_matches
                    (
                        user_id,
                        result,
                        agent,
                        map,
                        kills,
                        deaths,
                        assists,
                        rr_change,
                        played_at
                    )
                    VALUES (
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        COALESCE(
                            ?,
                            CURRENT_TIMESTAMP
                        )
                    )
                `).run(
                    req.user.id,
                    cleanResult,
                    cleanAgent,
                    cleanMap,
                    cleanKills,
                    cleanDeaths,
                    cleanAssists,
                    cleanRR,
                    cleanPlayedAt
                );

            const match =
                db.prepare(`
                    SELECT
                        id,
                        result,
                        agent,
                        map,
                        kills,
                        deaths,
                        assists,
                        rr_change,
                        played_at
                    FROM rank_matches
                    WHERE id = ?
                `).get(
                    resultDb.lastInsertRowid
                );

            return res.status(201).json({
                success: true,

                message:
                    "Dereceli maç kaydedildi.",

                match
            });
        } catch (error) {
            console.error(
                "RANK MATCH CREATE ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Dereceli maç kaydedilemedi."
            });
        }
    }
);

/*
=====================================================
  KENDİ SON 5 DERECELİ MAÇIM
=====================================================
*/

app.get(
    "/api/ranked-matches",
    authenticateToken,
    (req, res) => {
        try {
            const matches =
                getLastFiveRankedMatches(
                    req.user.id
                );

            return res.json({
                success: true,
                matches
            });
        } catch (error) {
            console.error(
                "RANK MATCH LIST ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Dereceli maçlar alınamadı."
            });
        }
    }
);

/*
=====================================================
  BAŞKA OYUNCUNUN SON 5 MAÇI
=====================================================
*/

app.get(
    "/api/users/:userId/ranked-matches",
    authenticateToken,
    (req, res) => {
        try {
            const userId =
                Number(req.params.userId);

            if (
                !isValidUserId(userId)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Geçersiz kullanıcı."
                });
            }

            const user =
                getUserById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Kullanıcı bulunamadı."
                });
            }

            const matches =
                getLastFiveRankedMatches(
                    userId
                );

            return res.json({
                success: true,

                user: {
                    id: user.id,
                    username:
                        user.username,
                    valorant_id:
                        user.valorant_id,
                    rank:
                        user.rank,
                    role:
                        user.role
                },

                matches
            });
        } catch (error) {
            console.error(
                "USER RANK MATCH ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Oyuncunun maçları alınamadı."
            });
        }
    }
);

/*
=====================================================
  İLAN OLUŞTUR
=====================================================
*/

app.post(
    "/api/rooms",
    authenticateToken,
    (req, res) => {
        try {
            const {
                role,
                mode,
                age,
                microphone,
                description
            } = req.body || {};

            const currentUser =
                getUserById(
                    req.user.id
                );

            if (!currentUser) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Kullanıcı bulunamadı."
                });
            }

            const profileRank =
                normalizeRank(
                    currentUser.rank
                );

            if (
                getRankIndex(profileRank) === -1
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Profilinizde geçerli bir rank bulunamadı."
                });
            }

            const cleanRole =
                cleanString(
                    role,
                    30
                );

            const cleanMode =
                cleanString(
                    mode,
                    30
                );

            const cleanAge =
                cleanString(
                    age,
                    30
                );

            const cleanDescription =
                cleanString(
                    description,
                    500
                );

            if (
                !cleanRole ||
                !cleanMode ||
                !cleanAge
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "İlan bilgilerini eksiksiz doldurun."
                });
            }

            /*
              Kullanıcının eski ilanını sil.
            */

            db.prepare(`
                DELETE FROM rooms
                WHERE user_id = ?
            `).run(
                req.user.id
            );

            /*
              Yeni ilan oluştur.
            */

            const result =
                db.prepare(`
                    INSERT INTO rooms
                    (
                        user_id,
                        rank,
                        role,
                        mode,
                        age,
                        microphone,
                        description
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                    req.user.id,
                    profileRank,
                    cleanRole,
                    cleanMode,
                    cleanAge,
                    microphone ? 1 : 0,
                    cleanDescription
                );

            const roomId =
                result.lastInsertRowid;

            const room =
                db.prepare(`
                    SELECT
                        rooms.id,
                        rooms.rank,
                        rooms.role,
                        rooms.mode,
                        rooms.age,
                        rooms.microphone,
                        rooms.description,
                        rooms.created_at,
                        rooms.user_id,
                        users.username,
                        users.valorant_id
                    FROM rooms
                    INNER JOIN users
                        ON rooms.user_id =
                           users.id
                    WHERE rooms.id = ?
                `).get(roomId);

            if (!room) {
                return res.status(500).json({
                    success: false,
                    message:
                        "İlan oluşturuldu fakat okunamadı."
                });
            }

            room.rank =
                normalizeRank(
                    room.rank
                );

            const owner =
                getPlayerWithMatches(
                    room.user_id
                );

            const remainingSeconds =
                getRoomRemainingSeconds(
                    room.created_at
                );

            return res.status(201).json({
                success: true,

                message:
                    "İlan oluşturuldu. İlan 3 dakika aktif kalacak.",

                room: {
                    ...room,

                    remaining_seconds:
                        remainingSeconds,

                    max_seconds:
                        ROOM_LIFETIME_SECONDS,

                    looking_for_one:
                        true,

                    owner,

                    last_five_ranked_matches:
                        owner
                            ? owner.ranked_matches
                            : []
                }
            });
        } catch (error) {
            console.error(
                "CREATE ROOM ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "İlan oluşturulamadı."
            });
        }
    }
);

/*
=====================================================
  İLAN LİSTESİ
=====================================================
*/

app.get(
    "/api/rooms",
    authenticateToken,
    (req, res) => {
        try {
            cleanupExpiredRooms();

            const role =
                req.query.role
                    ? cleanString(
                          req.query.role,
                          30
                      )
                    : "";

            const mode =
                req.query.mode
                    ? cleanString(
                          req.query.mode,
                          30
                      )
                    : "";

            const currentUser =
                getUserById(
                    req.user.id
                );

            if (!currentUser) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Kullanıcı bulunamadı."
                });
            }

            const searchRank =
                normalizeRank(
                    currentUser.rank
                );

            const rankIndex =
                getRankIndex(
                    searchRank
                );

            if (rankIndex === -1) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Profilinizde geçerli bir rank bulunamadı."
                });
            }

            const compatibleRanks =
                getCompatibleRanks(
                    searchRank
                );

            let rooms =
                db.prepare(`
                    SELECT
                        rooms.id,
                        rooms.rank,
                        rooms.role,
                        rooms.mode,
                        rooms.age,
                        rooms.microphone,
                        rooms.description,
                        rooms.created_at,
                        rooms.user_id,
                        users.username,
                        users.valorant_id
                    FROM rooms
                    INNER JOIN users
                        ON rooms.user_id =
                           users.id
                    ORDER BY rooms.id DESC
                `).all();

            /*
              Süresi dolmuş ilanları
              tekrar kontrol et.
            */

            rooms =
                rooms.filter(
                    room =>
                        getRoomRemainingSeconds(
                            room.created_at
                        ) > 0
                );

            /*
              Rank filtresi.
            */

            rooms =
                rooms.filter(
                    room =>
                        isRankCompatible(
                            searchRank,
                            room.rank
                        )
                );

            /*
              Rank yakınlığı.
            */

            rooms.sort(
                (a, b) => {
                    const distanceA =
                        Math.abs(
                            getRankIndex(
                                a.rank
                            ) -
                            rankIndex
                        );

                    const distanceB =
                        Math.abs(
                            getRankIndex(
                                b.rank
                            ) -
                            rankIndex
                        );

                    if (
                        distanceA !==
                        distanceB
                    ) {
                        return (
                            distanceA -
                            distanceB
                        );
                    }

                    return (
                        Number(b.id) -
                        Number(a.id)
                    );
                }
            );

            /*
              Rol filtresi.
            */

            if (role) {
                rooms =
                    rooms.filter(
                        room =>
                            room.role ===
                                role ||
                            room.role ===
                                "Flex"
                    );
            }

            /*
              Mod filtresi.
            */

            if (mode) {
                rooms =
                    rooms.filter(
                        room =>
                            room.mode ===
                            mode
                    );
            }

            /*
              Gelişmiş ilan verisi.
            */

            const finalRooms =
                rooms.map(room => {
                    const owner =
                        getPlayerWithMatches(
                            room.user_id
                        );

                    const remainingSeconds =
                        getRoomRemainingSeconds(
                            room.created_at
                        );

                    return {
                        ...room,

                        rank:
                            normalizeRank(
                                room.rank
                            ),

                        remaining_seconds:
                            remainingSeconds,

                        max_seconds:
                            ROOM_LIFETIME_SECONDS,

                        looking_for_one:
                            true,

                        owner,

                        last_five_ranked_matches:
                            owner
                                ? owner.ranked_matches
                                : []
                    };
                });

            return res.json({
                success: true,

                rooms:
                    finalRooms,

                searchRank,

                compatibleRanks,

                roomLifetimeSeconds:
                    ROOM_LIFETIME_SECONDS
            });
        } catch (error) {
            console.error(
                "ROOM LIST ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "İlanlar alınamadı."
            });
        }
    }
);

/*
=====================================================
  TEK İLAN GETİR
=====================================================
*/

app.get(
    "/api/rooms/:id",
    authenticateToken,
    (req, res) => {
        try {
            const roomId =
                Number(req.params.id);

            if (
                !isValidUserId(roomId)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Geçersiz ilan numarası."
                });
            }

            const room =
                db.prepare(`
                    SELECT
                        rooms.id,
                        rooms.rank,
                        rooms.role,
                        rooms.mode,
                        rooms.age,
                        rooms.microphone,
                        rooms.description,
                        rooms.created_at,
                        rooms.user_id,
                        users.username,
                        users.valorant_id
                    FROM rooms
                    INNER JOIN users
                        ON rooms.user_id =
                           users.id
                    WHERE rooms.id = ?
                `).get(roomId);

            if (!room) {
                return res.status(404).json({
                    success: false,
                    message:
                        "İlan bulunamadı veya süresi doldu."
                });
            }

            const remainingSeconds =
                getRoomRemainingSeconds(
                    room.created_at
                );

            if (
                remainingSeconds <= 0
            ) {
                db.prepare(`
                    DELETE FROM rooms
                    WHERE id = ?
                `).run(roomId);

                return res.status(404).json({
                    success: false,
                    message:
                        "Bu ilanın süresi dolmuş."
                });
            }

            const owner =
                getPlayerWithMatches(
                    room.user_id
                );

            return res.json({
                success: true,

                room: {
                    ...room,

                    rank:
                        normalizeRank(
                            room.rank
                        ),

                    remaining_seconds:
                        remainingSeconds,

                    max_seconds:
                        ROOM_LIFETIME_SECONDS,

                    looking_for_one:
                        true,

                    owner,

                    last_five_ranked_matches:
                        owner
                            ? owner.ranked_matches
                            : []
                }
            });
        } catch (error) {
            console.error(
                "GET ROOM ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "İlan alınamadı."
            });
        }
    }
);

/*
=====================================================
  İLANA KATIL
=====================================================
*/

app.post(
    "/api/rooms/:id/join",
    authenticateToken,
    (req, res) => {
        try {
            const roomId =
                Number(req.params.id);

            if (
                !isValidUserId(roomId)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Geçersiz ilan."
                });
            }

            const room =
                db.prepare(`
                    SELECT
                        id,
                        user_id,
                        rank,
                        role,
                        mode,
                        age,
                        microphone,
                        description,
                        created_at
                    FROM rooms
                    WHERE id = ?
                `).get(roomId);

            if (!room) {
                return res.status(404).json({
                    success: false,
                    message:
                        "İlan bulunamadı veya süresi doldu."
                });
            }

            const remainingSeconds =
                getRoomRemainingSeconds(
                    room.created_at
                );

            if (
                remainingSeconds <= 0
            ) {
                db.prepare(`
                    DELETE FROM rooms
                    WHERE id = ?
                `).run(roomId);

                return res.status(410).json({
                    success: false,
                    message:
                        "Bu ilanın süresi doldu."
                });
            }

            /*
              Kendi ilanına katılamaz.
            */

            if (
                Number(room.user_id) ===
                Number(req.user.id)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Kendi ilanınıza katılamazsınız."
                });
            }

            const owner =
                getPlayerWithMatches(
                    room.user_id
                );

            const joiner =
                getPlayerWithMatches(
                    req.user.id
                );

            if (!owner || !joiner) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Oyuncu bilgileri bulunamadı."
                });
            }

            /*
              Rank kontrolü.
            */

            if (
                !isRankCompatible(
                    owner.rank,
                    joiner.rank
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Rankınız bu ilan için uygun değil."
                });
            }

            /*
              İlanı atomik şekilde silmeye çalış.
              Böylece aynı ilana iki kişinin
              aynı anda katılma ihtimali azalır.
            */

            const deleteResult =
                db.prepare(`
                    DELETE FROM rooms
                    WHERE id = ?
                `).run(roomId);

            if (
                deleteResult.changes === 0
            ) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Bu ilana başka bir oyuncu katılmış olabilir."
                });
            }

            return res.json({
                success: true,

                message:
                    "İlana katıldınız. İki kişilik sohbet başlatıldı.",

                roomId,

                chat: {
                    active: true,

                    owner,

                    joined_player:
                        joiner,

                    participants: [
                        owner,
                        joiner
                    ]
                },

                comparison: {
                    left: {
                        player:
                            owner,

                        last_five_matches:
                            owner.ranked_matches
                    },

                    right: {
                        player:
                            joiner,

                        last_five_matches:
                            joiner.ranked_matches
                    }
                }
            });
        } catch (error) {
            console.error(
                "JOIN ROOM ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "İlana katılırken hata oluştu."
            });
        }
    }
);

/*
=====================================================
  İLAN SİL
=====================================================
*/

app.delete(
    "/api/rooms/:id",
    authenticateToken,
    (req, res) => {
        try {
            const roomId =
                Number(req.params.id);

            if (
                !isValidUserId(roomId)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Geçersiz ilan numarası."
                });
            }

            const room =
                db.prepare(`
                    SELECT
                        id,
                        user_id
                    FROM rooms
                    WHERE id = ?
                `).get(roomId);

            if (!room) {
                return res.status(404).json({
                    success: false,
                    message:
                        "İlan bulunamadı."
                });
            }

            if (
                Number(room.user_id) !==
                Number(req.user.id)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Bu ilanı silme yetkiniz yok."
                });
            }

            db.prepare(`
                DELETE FROM rooms
                WHERE id = ?
            `).run(roomId);

            return res.json({
                success: true,

                message:
                    "İlan silindi."
            });
        } catch (error) {
            console.error(
                "DELETE ROOM ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "İlan silinemedi."
            });
        }
    }
);

/*
=====================================================
  MESAJ GÖNDER
=====================================================
*/

app.post(
    "/api/messages",
    authenticateToken,
    (req, res) => {
        try {
            const {
                receiver_id,
                message
            } = req.body || {};

            const receiverId =
                Number(receiver_id);

            const cleanMessage =
                cleanString(
                    message,
                    2000
                );

            if (
                !isValidUserId(
                    receiverId
                ) ||
                !cleanMessage
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Alıcı ve mesaj gerekli."
                });
            }

            if (
                receiverId ===
                Number(req.user.id)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Kendinize mesaj gönderemezsiniz."
                });
            }

            const receiver =
                db.prepare(`
                    SELECT
                        id,
                        username
                    FROM users
                    WHERE id = ?
                `).get(receiverId);

            if (!receiver) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Alıcı kullanıcı bulunamadı."
                });
            }

            const result =
                db.prepare(`
                    INSERT INTO messages
                    (
                        sender_id,
                        receiver_id,
                        message
                    )
                    VALUES (?, ?, ?)
                `).run(
                    req.user.id,
                    receiverId,
                    cleanMessage
                );

            const newMessage =
                db.prepare(`
                    SELECT
                        messages.id,
                        messages.sender_id,
                        messages.receiver_id,
                        messages.message,
                        messages.created_at,

                        sender.username
                            AS sender_username,

                        receiver.username
                            AS receiver_username

                    FROM messages

                    INNER JOIN users AS sender
                        ON messages.sender_id =
                           sender.id

                    INNER JOIN users AS receiver
                        ON messages.receiver_id =
                           receiver.id

                    WHERE messages.id = ?
                `).get(
                    result.lastInsertRowid
                );

            return res.status(201).json({
                success: true,

                message:
                    "Mesaj gönderildi.",

                data:
                    newMessage
            });
        } catch (error) {
            console.error(
                "SEND MESSAGE ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Mesaj gönderilemedi."
            });
        }
    }
);

/*
=====================================================
  MESAJLARI GETİR
=====================================================
*/

app.get(
    "/api/messages/:userId",
    authenticateToken,
    (req, res) => {
        try {
            const otherUserId =
                Number(
                    req.params.userId
                );

            if (
                !isValidUserId(
                    otherUserId
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Geçersiz kullanıcı."
                });
            }

            if (
                otherUserId ===
                Number(req.user.id)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Kendinizle sohbet açamazsınız."
                });
            }

            const otherUser =
                getUserById(
                    otherUserId
                );

            if (!otherUser) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Kullanıcı bulunamadı."
                });
            }

            const messages =
                db.prepare(`
                    SELECT
                        messages.id,
                        messages.sender_id,
                        messages.receiver_id,
                        messages.message,
                        messages.created_at,

                        sender.username
                            AS sender_username,

                        receiver.username
                            AS receiver_username

                    FROM messages

                    INNER JOIN users AS sender
                        ON messages.sender_id =
                           sender.id

                    INNER JOIN users AS receiver
                        ON messages.receiver_id =
                           receiver.id

                    WHERE
                        (
                            messages.sender_id = ?
                            AND
                            messages.receiver_id = ?
                        )
                        OR
                        (
                            messages.sender_id = ?
                            AND
                            messages.receiver_id = ?
                        )

                    ORDER BY
                        messages.id ASC
                `).all(
                    req.user.id,
                    otherUserId,
                    otherUserId,
                    req.user.id
                );

            return res.json({
                success: true,

                user: {
                    id:
                        otherUser.id,

                    username:
                        otherUser.username,

                    valorant_id:
                        otherUser.valorant_id,

                    rank:
                        normalizeRank(
                            otherUser.rank
                        ),

                    role:
                        otherUser.role
                },

                participants: [
                    getPlayerWithMatches(
                        req.user.id
                    ),

                    getPlayerWithMatches(
                        otherUserId
                    )
                ],

                messages
            });
        } catch (error) {
            console.error(
                "GET MESSAGES ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Mesajlar alınamadı."
            });
        }
    }
);

/*
=====================================================
  MESAJLAŞILAN KULLANICILAR
=====================================================
*/

app.get(
    "/api/conversations",
    authenticateToken,
    (req, res) => {
        try {
            const conversations =
                db.prepare(`
                    SELECT
                        u.id,
                        u.username,
                        u.valorant_id,
                        u.rank,
                        u.role,

                        m.message
                            AS last_message,

                        m.created_at
                            AS last_message_at

                    FROM users u

                    INNER JOIN messages m
                        ON (
                            m.sender_id = u.id
                            OR
                            m.receiver_id = u.id
                        )

                    WHERE
                        u.id != ?

                        AND

                        m.id = (
                            SELECT
                                MAX(m2.id)

                            FROM messages m2

                            WHERE
                                (
                                    m2.sender_id = u.id
                                    AND
                                    m2.receiver_id = ?
                                )

                                OR

                                (
                                    m2.sender_id = ?
                                    AND
                                    m2.receiver_id = u.id
                                )
                        )

                    ORDER BY
                        m.id DESC
                `).all(
                    req.user.id,
                    req.user.id,
                    req.user.id
                );

            const uniqueConversations =
                [];

            const usedIds =
                new Set();

            for (
                const conversation
                of conversations
            ) {
                if (
                    !usedIds.has(
                        conversation.id
                    )
                ) {
                    usedIds.add(
                        conversation.id
                    );

                    uniqueConversations.push({
                        ...conversation,

                        rank:
                            normalizeRank(
                                conversation.rank
                            )
                    });
                }
            }

            return res.json({
                success: true,

                conversations:
                    uniqueConversations
            });
        } catch (error) {
            console.error(
                "CONVERSATIONS ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Konuşmalar alınamadı."
            });
        }
    }
);

/*
=====================================================
  MATCHMAKING
=====================================================
*/

app.get(
    "/api/matchmaking",
    authenticateToken,
    (req, res) => {
        try {
            const currentUser =
                getUserById(
                    req.user.id
                );

            if (!currentUser) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Kullanıcı bulunamadı."
                });
            }

            const userRank =
                normalizeRank(
                    currentUser.rank
                );

            const userRankIndex =
                getRankIndex(
                    userRank
                );

            if (
                userRankIndex === -1
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Profilinizde geçerli bir rank bulunamadı."
                });
            }

            const compatibleRanks =
                getCompatibleRanks(
                    userRank
                );

            let players =
                db.prepare(`
                    SELECT
                        id,
                        username,
                        valorant_id,
                        rank,
                        role
                    FROM users
                    WHERE id != ?
                `).all(
                    req.user.id
                );

            players =
                players.filter(
                    player =>
                        isRankCompatible(
                            userRank,
                            player.rank
                        )
                );

            players.sort(
                (a, b) => {
                    const distanceA =
                        Math.abs(
                            getRankIndex(
                                a.rank
                            ) -
                            userRankIndex
                        );

                    const distanceB =
                        Math.abs(
                            getRankIndex(
                                b.rank
                            ) -
                            userRankIndex
                        );

                    if (
                        distanceA !==
                        distanceB
                    ) {
                        return (
                            distanceA -
                            distanceB
                        );
                    }

                    return (
                        Number(b.id) -
                        Number(a.id)
                    );
                }
            );

            /*
              Kullanıcı + 4 kişi = 5 kişilik takım.
            */

            const selectedPlayers =
                players.slice(0, 4);

            const playerCount =
                selectedPlayers.length + 1;

            const teamReady =
                playerCount === 5;

            const normalizedPlayers =
                selectedPlayers.map(
                    player =>
                        getPlayerWithMatches(
                            player.id
                        )
                );

            return res.json({
                success: true,

                message:
                    teamReady
                        ? "5 oyuncu bulundu!"
                        : `${playerCount} oyuncu bulundu. 5 kişilik takım için ${5 - playerCount} oyuncu daha gerekli.`,

                user:
                    getPlayerWithMatches(
                        currentUser.id
                    ),

                searchRank:
                    userRank,

                compatibleRanks,

                players:
                    normalizedPlayers,

                playerCount,

                teamReady
            });
        } catch (error) {
            console.error(
                "MATCHMAKING ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Takım aranırken bir hata oluştu."
            });
        }
    }
);

/*
=====================================================
  404
=====================================================
*/

app.use(
    (req, res) => {
        res.status(404).json({
            success: false,
            message:
                "API endpoint bulunamadı."
        });
    }
);

/*
=====================================================
  GENEL HATA YAKALAMA
=====================================================
*/

app.use(
    (error, req, res, next) => {
        console.error(
            "GLOBAL ERROR:",
            error
        );

        if (
            res.headersSent
        ) {
            return next(error);
        }

        return res.status(500).json({
            success: false,
            message:
                "Beklenmeyen sunucu hatası."
        });
    }
);

/*
=====================================================
  SUNUCU
=====================================================
*/

app.listen(
    PORT,
    () => {
        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            "              5liTAKIM"
        );

        console.log(
            "========================================"
        );

        console.log(
            `Backend: http://localhost:${PORT}`
        );

        console.log(
            `Test:    http://localhost:${PORT}/api/test`
        );

        console.log(
            "Rank sistemi: ±1 AKTİF"
        );

        console.log(
            "İlan sistemi: 3 DAKİKA AKTİF"
        );

        console.log(
            "İlan otomatik silme: AKTİF"
        );

        console.log(
            "Son 5 dereceli maç: AKTİF"
        );

        console.log(
            "İki kişilik ilan sohbeti: AKTİF"
        );

        console.log(
            "Mesaj sistemi: AKTİF"
        );

        console.log(
            "Matchmaking: AKTİF"
        );

        console.log(
            "========================================"
        );

        console.log("");
    }
);