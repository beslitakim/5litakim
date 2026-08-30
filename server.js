const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();

const PORT = 3000;

// ÜRETİMDE .env kullanılması önerilir.
const JWT_SECRET =
    process.env.JWT_SECRET || "5litakim-gizli-anahtar-2026";

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

app.use(express.static(__dirname));

/* =====================================================
   DATABASE
===================================================== */

const db = new Database(
    path.join(__dirname, "5litakim.db")
);

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

/* =====================================================
   RANK SIRALAMASI
===================================================== */

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

/* =====================================================
   RANK NORMALIZE
===================================================== */

function normalizeRank(rank) {
    if (!rank) {
        return "";
    }

    let value = String(rank).trim();

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
        "Ã–lÃ¼msÃ¼zlÃ¼k 3": "Ölümsüzlük 3"
    };

    if (brokenMap[value]) {
        value = brokenMap[value];
    }

    return value;
}

/* =====================================================
   RANK INDEX
===================================================== */

function getRankIndex(rank) {
    return RANK_ORDER.indexOf(
        normalizeRank(rank)
    );
}

/* =====================================================
   RANK UYUMLULUK
===================================================== */

function isRankCompatible(rank1, rank2) {
    const index1 = getRankIndex(rank1);
    const index2 = getRankIndex(rank2);

    if (
        index1 === -1 ||
        index2 === -1
    ) {
        return false;
    }

    return Math.abs(index1 - index2) <= 1;
}

/* =====================================================
   UYUMLU RANKLAR
===================================================== */

function getCompatibleRanks(rank) {
    const index = getRankIndex(rank);

    if (index === -1) {
        return [];
    }

    const result = [];

    for (
        let i = 0;
        i < RANK_ORDER.length;
        i++
    ) {
        if (
            Math.abs(i - index) <= 1
        ) {
            result.push(
                RANK_ORDER[i]
            );
        }
    }

    return result;
}

/* =====================================================
   AUTH
===================================================== */

function authenticateToken(
    req,
    res,
    next
) {
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
        !authHeader.startsWith(
            "Bearer "
        )
    ) {
        return res.status(401).json({
            success: false,
            message:
                "Geçersiz oturum."
        });
    }

    const token =
        authHeader.substring(7);

    jwt.verify(
        token,
        JWT_SECRET,
        (
            error,
            user
        ) => {
            if (error) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Oturum geçersiz veya süresi dolmuş."
                });
            }

            req.user = user;

            next();
        }
    );
}

/* =====================================================
   KULLANICI GETİR
===================================================== */

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
        normalizeRank(
            user.rank
        );

    return user;
}

/* =====================================================
   SON 5 MAÇ
===================================================== */

function getLastFiveRankedMatches(
    userId
) {
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
        ORDER BY
            datetime(played_at) DESC,
            id DESC
        LIMIT 5
    `).all(userId);
}

/* =====================================================
   OYUNCU + MAÇLAR
===================================================== */

function getPlayerWithMatches(
    userId
) {
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

/* =====================================================
   İLAN SÜRESİ
===================================================== */

function getRoomRemainingSeconds(
    createdAt
) {
    if (!createdAt) {
        return 0;
    }

    const createdTime =
        new Date(
            String(createdAt)
                .replace(" ", "T") + "Z"
        ).getTime();

    if (
        Number.isNaN(createdTime)
    ) {
        return 0;
    }

    const elapsed =
        Math.floor(
            (
                Date.now() -
                createdTime
            ) / 1000
        );

    return Math.max(
        0,
        ROOM_LIFETIME_SECONDS -
            elapsed
    );
}

/* =====================================================
   SÜRESİ DOLAN İLANLARI SİL
===================================================== */

function cleanupExpiredRooms() {
    try {
        const rooms =
            db.prepare(`
                SELECT
                    id,
                    created_at
                FROM rooms
            `).all();

        for (
            const room of rooms
        ) {
            if (
                getRoomRemainingSeconds(
                    room.created_at
                ) <= 0
            ) {
                db.prepare(`
                    DELETE FROM rooms
                    WHERE id = ?
                `).run(room.id);
            }
        }
    } catch (error) {
        console.error(
            "ROOM CLEANUP ERROR:",
            error
        );
    }
}

setInterval(
    cleanupExpiredRooms,
    5000
);

/* =====================================================
   ANA SAYFA
===================================================== */

app.get(
    "/",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );
    }
);

/* =====================================================
   API TEST
===================================================== */

app.get(
    "/api/test",
    (req, res) => {
        res.json({
            success: true,
            message:
                "5liTakim backend çalışıyor!",
            port: PORT,
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
            matchmaking:
                "Aktif",
            ranks:
                RANK_ORDER
        });
    }
);

/* =====================================================
   REGISTER
===================================================== */

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
            } = req.body;

            if (
                !username ||
                !valorant_id ||
                !rank ||
                !role ||
                !password
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Tüm alanları doldurun."
                });
            }

            if (
                String(password).length < 6
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Şifre en az 6 karakter olmalıdır."
                });
            }

            const cleanRank =
                normalizeRank(rank);

            if (
                getRankIndex(
                    cleanRank
                ) === -1
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Geçersiz rank."
                });
            }

            const usernameClean =
                String(username).trim();

            const valorantIdClean =
                String(
                    valorant_id
                ).trim();

            const roleClean =
                String(role).trim();

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
                usernameClean.length > 30
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Kullanıcı adı en fazla 30 karakter olabilir."
                });
            }

            const existingUser =
                db.prepare(`
                    SELECT id
                    FROM users
                    WHERE LOWER(username) = LOWER(?)
                `).get(
                    usernameClean
                );

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Bu kullanıcı adı zaten kullanılıyor."
                });
            }

            const hashedPassword =
                await bcrypt.hash(
                    String(password),
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
                    roleClean,
                    hashedPassword
                );

            res.status(201).json({
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

            res.status(500).json({
                success: false,
                message:
                    "Sunucu hatası."
            });
        }
    }
);

/* =====================================================
   LOGIN
===================================================== */

app.post(
    "/api/login",
    async (req, res) => {
        try {
            const {
                username,
                password
            } = req.body;

            if (
                !username ||
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
                    WHERE LOWER(username) = LOWER(?)
                `).get(
                    String(
                        username
                    ).trim()
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
                    String(password),
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
                        expiresIn:
                            "7d"
                    }
                );

            res.json({
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

            res.status(500).json({
                success: false,
                message:
                    "Sunucu hatası."
            });
        }
    }
);

/* =====================================================
   PROFILE GET
===================================================== */

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

            res.json({
                success: true,
                user
            });

        } catch (error) {
            console.error(
                "PROFILE ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Profil alınamadı."
            });
        }
    }
);

/* =====================================================
   PROFILE UPDATE
===================================================== */

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
            } = req.body;

            if (
                !valorant_id ||
                !rank ||
                !role
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Valorant ID, rank ve rol gerekli."
                });
            }

            const cleanRank =
                normalizeRank(rank);

            if (
                getRankIndex(
                    cleanRank
                ) === -1
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Geçersiz rank."
                });
            }

            if (
                password &&
                String(password).length < 6
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Yeni şifre en az 6 karakter olmalıdır."
                });
            }

            const cleanValorantId =
                String(
                    valorant_id
                ).trim();

            const cleanRole =
                String(role).trim();

            if (password) {
                const hashedPassword =
                    await bcrypt.hash(
                        String(password),
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
                    cleanValorantId,
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
                    cleanValorantId,
                    cleanRank,
                    cleanRole,
                    req.user.id
                );
            }

            res.json({
                success: true,
                message:
                    "Profil başarıyla güncellendi.",
                user:
                    getUserById(
                        req.user.id
                    )
            });

        } catch (error) {
            console.error(
                "PROFILE UPDATE ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Profil güncellenemedi."
            });
        }
    }
);

/* =====================================================
   RANKED MATCH EKLE
===================================================== */

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
            } = req.body;

            const cleanResult =
                String(
                    result || ""
                ).toUpperCase();

            if (
                ![
                    "WIN",
                    "LOSS"
                ].includes(
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
                Number.isFinite(
                    Number(kills)
                )
                    ? Number(kills)
                    : 0;

            const cleanDeaths =
                Number.isFinite(
                    Number(deaths)
                )
                    ? Number(deaths)
                    : 0;

            const cleanAssists =
                Number.isFinite(
                    Number(assists)
                )
                    ? Number(assists)
                    : 0;

            const cleanRR =
                Number.isFinite(
                    Number(rr_change)
                )
                    ? Number(rr_change)
                    : 0;

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
                    String(
                        agent || ""
                    ),
                    String(
                        map || ""
                    ),
                    cleanKills,
                    cleanDeaths,
                    cleanAssists,
                    cleanRR,
                    played_at || null
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

            res.status(201).json({
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

            res.status(500).json({
                success: false,
                message:
                    "Dereceli maç kaydedilemedi."
            });
        }
    }
);

/* =====================================================
   KENDİ SON 5 MAÇIM
===================================================== */

app.get(
    "/api/ranked-matches",
    authenticateToken,
    (req, res) => {
        try {
            res.json({
                success: true,
                matches:
                    getLastFiveRankedMatches(
                        req.user.id
                    )
            });
        } catch (error) {
            console.error(
                "RANK MATCH LIST ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Dereceli maçlar alınamadı."
            });
        }
    }
);

/* =====================================================
   BAŞKA OYUNCUNUN MAÇLARI
===================================================== */

app.get(
    "/api/users/:userId/ranked-matches",
    authenticateToken,
    (req, res) => {
        try {
            const userId =
                Number(
                    req.params.userId
                );

            if (
                !Number.isInteger(
                    userId
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Geçersiz kullanıcı."
                });
            }

            const user =
                getUserById(
                    userId
                );

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Kullanıcı bulunamadı."
                });
            }

            res.json({
                success: true,
                user,
                matches:
                    getLastFiveRankedMatches(
                        userId
                    )
            });

        } catch (error) {
            console.error(
                "USER RANK MATCH ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Oyuncunun maçları alınamadı."
            });
        }
    }
);

/* =====================================================
   İLAN OLUŞTUR
===================================================== */

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
            } = req.body;

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
                getRankIndex(
                    profileRank
                ) === -1
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Profilinizde geçerli bir rank bulunamadı."
                });
            }

            if (
                !role ||
                !mode ||
                !age
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "İlan bilgilerini eksiksiz doldurun."
                });
            }

            // Kullanıcının eski ilanını sil
            db.prepare(`
                DELETE FROM rooms
                WHERE user_id = ?
            `).run(
                req.user.id
            );

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
                    VALUES (
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?
                    )
                `).run(
                    req.user.id,
                    profileRank,
                    String(role).trim(),
                    String(mode).trim(),
                    String(age).trim(),
                    microphone ? 1 : 0,
                    String(
                        description || ""
                    ).trim()
                );

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
                        ON rooms.user_id = users.id
                    WHERE rooms.id = ?
                `).get(
                    result.lastInsertRowid
                );

            const owner =
                getPlayerWithMatches(
                    room.user_id
                );

            res.status(201).json({
                success: true,
                message:
                    "İlan oluşturuldu. İlan 3 dakika aktif kalacak.",

                room: {
                    ...room,

                    rank:
                        normalizeRank(
                            room.rank
                        ),

                    remaining_seconds:
                        getRoomRemainingSeconds(
                            room.created_at
                        ),

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

            res.status(500).json({
                success: false,
                message:
                    "İlan oluşturulamadı."
            });
        }
    }
);

/* =====================================================
   İLAN LİSTESİ
===================================================== */

app.get(
    "/api/rooms",
    authenticateToken,
    (req, res) => {
        try {
            cleanupExpiredRooms();

            const {
                role,
                mode
            } = req.query;

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

            if (
                rankIndex === -1
            ) {
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
                        ON rooms.user_id = users.id
                    ORDER BY rooms.id DESC
                `).all();

            // Rank filtresi
            rooms =
                rooms.filter(
                    room =>
                        isRankCompatible(
                            searchRank,
                            room.rank
                        )
                );

            // Süresi dolmuşları güvenlik için çıkar
            rooms =
                rooms.filter(
                    room =>
                        getRoomRemainingSeconds(
                            room.created_at
                        ) > 0
                );

            // Rank yakınlığına göre sırala
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

            // Rol filtresi
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

            // Mod filtresi
            if (mode) {
                rooms =
                    rooms.filter(
                        room =>
                            room.mode ===
                            mode
                    );
            }

            const finalRooms =
                rooms.map(
                    room => {
                        const owner =
                            getPlayerWithMatches(
                                room.user_id
                            );

                        return {
                            ...room,

                            rank:
                                normalizeRank(
                                    room.rank
                                ),

                            remaining_seconds:
                                getRoomRemainingSeconds(
                                    room.created_at
                                ),

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
                    }
                );

            res.json({
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

            res.status(500).json({
                success: false,
                message:
                    "İlanlar alınamadı."
            });
        }
    }
);

/* =====================================================
   TEK İLAN
===================================================== */

app.get(
    "/api/rooms/:id",
    authenticateToken,
    (req, res) => {
        try {
            const roomId =
                Number(
                    req.params.id
                );

            if (
                !Number.isInteger(
                    roomId
                )
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
                        ON rooms.user_id = users.id
                    WHERE rooms.id = ?
                `).get(
                    roomId
                );

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
                `).run(
                    roomId
                );

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

            res.json({
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

            res.status(500).json({
                success: false,
                message:
                    "İlan alınamadı."
            });
        }
    }
);

/* =====================================================
   İLANA KATIL
===================================================== */

app.post(
    "/api/rooms/:id/join",
    authenticateToken,
    (req, res) => {
        try {
            const roomId =
                Number(
                    req.params.id
                );

            if (
                !Number.isInteger(
                    roomId
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Geçersiz ilan."
                });
            }

            const room =
                db.prepare(`
                    SELECT *
                    FROM rooms
                    WHERE id = ?
                `).get(
                    roomId
                );

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
                `).run(
                    roomId
                );

                return res.status(410).json({
                    success: false,
                    message:
                        "Bu ilanın süresi doldu."
                });
            }

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

            if (
                !owner ||
                !joiner
            ) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Oyuncu bilgileri bulunamadı."
                });
            }

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

            // İlanı artık aktif listeden kaldır
            db.prepare(`
                DELETE FROM rooms
                WHERE id = ?
            `).run(
                roomId
            );

            res.json({
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

            res.status(500).json({
                success: false,
                message:
                    "İlana katılırken hata oluştu."
            });
        }
    }
);

/* =====================================================
   İLAN SİL
===================================================== */

app.delete(
    "/api/rooms/:id",
    authenticateToken,
    (req, res) => {
        try {
            const roomId =
                Number(
                    req.params.id
                );

            if (
                !Number.isInteger(
                    roomId
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Geçersiz ilan numarası."
                });
            }

            const room =
                db.prepare(`
                    SELECT *
                    FROM rooms
                    WHERE id = ?
                `).get(
                    roomId
                );

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
            `).run(
                roomId
            );

            res.json({
                success: true,
                message:
                    "İlan silindi."
            });

        } catch (error) {
            console.error(
                "DELETE ROOM ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "İlan silinemedi."
            });
        }
    }
);

/* =====================================================
   MESAJ GÖNDER
===================================================== */

app.post(
    "/api/messages",
    authenticateToken,
    (req, res) => {
        try {
            const {
                receiver_id,
                message
            } = req.body;

            const receiverId =
                Number(
                    receiver_id
                );

            const cleanMessage =
                String(
                    message || ""
                ).trim();

            if (
                !Number.isInteger(
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
                `).get(
                    receiverId
                );

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

            res.status(201).json({
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

            res.status(500).json({
                success: false,
                message:
                    "Mesaj gönderilemedi."
            });
        }
    }
);

/* =====================================================
   MESAJLARI GETİR
===================================================== */

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
                !Number.isInteger(
                    otherUserId
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Geçersiz kullanıcı."
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

            res.json({
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

            res.status(500).json({
                success: false,
                message:
                    "Mesajlar alınamadı."
            });
        }
    }
);

/* =====================================================
   CONVERSATIONS
===================================================== */

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

            res.json({
                success: true,

                conversations:
                    conversations.map(
                        conversation => ({
                            ...conversation,

                            rank:
                                normalizeRank(
                                    conversation.rank
                                )
                        })
                    )
            });

        } catch (error) {
            console.error(
                "CONVERSATIONS ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Konuşmalar alınamadı."
            });
        }
    }
);

/* =====================================================
   MATCHMAKING
===================================================== */

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

            const selectedPlayers =
                players.slice(0, 4);

            const playerCount =
                selectedPlayers.length +
                1;

            const teamReady =
                playerCount === 5;

            const normalizedPlayers =
                selectedPlayers.map(
                    player =>
                        getPlayerWithMatches(
                            player.id
                        )
                );

            res.json({
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

            res.status(500).json({
                success: false,
                message:
                    "Takım aranırken bir hata oluştu."
            });
        }
    }
);

/* =====================================================
   404 API
===================================================== */

app.use(
    "/api",
    (req, res) => {
        res.status(404).json({
            success: false,
            message:
                "API adresi bulunamadı."
        });
    }
);

/* =====================================================
   GENEL HATA YAKALAYICI
===================================================== */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {
        console.error(
            "GLOBAL ERROR:",
            error
        );

        if (
            res.headersSent
        ) {
            return next(error);
        }

        res.status(500).json({
            success: false,
            message:
                "Sunucu hatası."
        });
    }
);

/* =====================================================
   SUNUCU
===================================================== */

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
            `Site:    http://localhost:${PORT}`
        );
        console.log(
            `Backend: http://localhost:${PORT}/api/test`
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