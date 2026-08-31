const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "5litakim-gizli-anahtar-2026";

app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(express.json());
app.use(express.static(path.join(__dirname, "../")));

const db = new Database(":memory:");
db.pragma("foreign_keys = ON");

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
`);

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../index.html"));
});

app.listen(PORT, () => {
    console.log(`Sunucu aktif: http://localhost:${PORT}`);
});