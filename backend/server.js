const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "5litakim-gizli-anahtar-2026";

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "../")));

const db = new Database(path.join(__dirname, "5litakim.db"));
db.pragma("foreign_keys = ON");

/* TABLOLAR */
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

CREATE TABLE IF NOT EXISTS rank_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    result TEXT NOT NULL,
    agent TEXT,
    map TEXT,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

app.post("/api/register", async (req, res) => {
    try {
        const { username, valorant_id, rank, role, password } = req.body || {};
        if (!username || !valorant_id || !rank || !role || !password) {
            return res.status(400).json({ success: false, message: "Tüm alanları doldurun." });
        }

        const cleanUsername = String(username).trim();
        const existing = db.prepare(`SELECT id FROM users WHERE LOWER(username) = LOWER(?)`).get(cleanUsername);
        if (existing) {
            return res.status(400).json({ success: false, message: "Bu kullanıcı adı zaten kullanımda." });
        }

        const hashed = await bcrypt.hash(String(password), 10);
        const result = db.prepare(`
            INSERT INTO users (username, valorant_id, rank, role, password)
            VALUES (?, ?, ?, ?, ?)
        `).run(cleanUsername, String(valorant_id).trim(), String(rank).trim(), String(role).trim(), hashed);

        // Örnek maçlar ekle
        const insertMatch = db.prepare(`INSERT INTO rank_matches (user_id, result, agent, map) VALUES (?, ?, 'Jett', 'Ascent')`);
        ['G', 'G', 'M', 'B', 'G'].forEach(resType => {
            insertMatch.run(result.lastInsertRowid, resType);
        });

        return res.status(201).json({ success: true, message: "Kayıt başarılı!" });
    } catch (err) {
        console.error("REGISTER ERROR:", err);
        return res.status(500).json({ success: false, message: "Sunucu hatası: " + err.message });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const user = db.prepare(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`).get(String(username || "").trim());
        if (!user || !(await bcrypt.compare(String(password || ""), user.password))) {
            return res.status(401).json({ success: false, message: "Kullanıcı adı veya şifre hatalı." });
        }
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
        return res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                valorant_id: user.valorant_id,
                rank: user.rank,
                role: user.role
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../index.html"));
});

app.listen(PORT, () => {
    console.log(`Sunucu aktif: http://localhost:${PORT}`);
});