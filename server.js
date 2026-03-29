// ═══════════════════════════════════════════════════════════════
//  LIBRA — Smart Library Backend
//  Stack: Node.js + Express + SQLite + node-cron + Nodemailer
//  Run:   npm install && node server.js
// ═══════════════════════════════════════════════════════════════

const express    = require('express');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const cron       = require('node-cron');
const nodemailer = require('nodemailer');
const Database   = require('better-sqlite3');
const path       = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'libra_super_secret_2025_change_in_production';

// ── MIDDLEWARE ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "libra.html"));
});  // serves libra.html

// ── DATABASE SETUP ──────────────────────────────────────────────
const db = new Database('libra.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    roll        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    role        TEXT DEFAULT 'student',
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS books (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    author      TEXT NOT NULL,
    genre       TEXT,
    isbn        TEXT UNIQUE,
    description TEXT,
    pages       INTEGER,
    year        INTEGER,
    total_copies   INTEGER DEFAULT 1,
    available_copies INTEGER DEFAULT 1,
    emoji       TEXT DEFAULT '📖',
    color       TEXT DEFAULT '#f0f4ff',
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS borrows (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    book_id     INTEGER NOT NULL,
    borrow_date TEXT DEFAULT (date('now')),
    due_date    TEXT NOT NULL,
    return_date TEXT,
    fine        REAL DEFAULT 0,
    status      TEXT DEFAULT 'active',
    reminder_3  INTEGER DEFAULT 0,
    reminder_1  INTEGER DEFAULT 0,
    overdue_sent INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS wishlist (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    added_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, book_id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL,
    title     TEXT NOT NULL,
    message   TEXT NOT NULL,
    type      TEXT DEFAULT 'info',
    is_read   INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// ── SEED BOOKS (if empty) ───────────────────────────────────────
const bookCount = db.prepare('SELECT COUNT(*) as c FROM books').get().c;
if (bookCount === 0) {
  const insertBook = db.prepare(`
    INSERT INTO books (title,author,genre,isbn,description,pages,year,total_copies,available_copies,emoji,color)
    VALUES (@title,@author,@genre,@isbn,@description,@pages,@year,@total_copies,@available_copies,@emoji,@color)
  `);
  const seedBooks = [
    { title:"Data Structures & Algorithms", author:"Alfred Aho", genre:"Technology", isbn:"978-0321455369", description:"A comprehensive guide covering arrays, trees, graphs, and dynamic programming.", pages:672, year:2006, total_copies:4, available_copies:3, emoji:"💻", color:"#e8f4fd" },
    { title:"Python Crash Course", author:"Eric Matthes", genre:"Technology", isbn:"978-1593279288", description:"Hands-on, project-based introduction to programming with Python.", pages:554, year:2019, total_copies:3, available_copies:2, emoji:"🐍", color:"#fef3c7" },
    { title:"Java: The Complete Reference", author:"Herbert Schildt", genre:"Technology", isbn:"978-1260463422", description:"The definitive guide to Java SE covering modules, generics, and the full Java API.", pages:1246, year:2021, total_copies:2, available_copies:0, emoji:"☕", color:"#fff1f2" },
    { title:"The Great Gatsby", author:"F. Scott Fitzgerald", genre:"Fiction", isbn:"978-0743273565", description:"A masterpiece of the Jazz Age exploring wealth, class, and the American Dream.", pages:180, year:1925, total_copies:4, available_copies:4, emoji:"📖", color:"#f0fdf4" },
    { title:"A Brief History of Time", author:"Stephen Hawking", genre:"Science", isbn:"978-0553380163", description:"Explores the nature of time, black holes, and the Big Bang.", pages:212, year:1988, total_copies:3, available_copies:2, emoji:"🌌", color:"#f5f3ff" },
    { title:"Atomic Habits", author:"James Clear", genre:"Self-Help", isbn:"978-0735211292", description:"An easy and proven way to build good habits and break bad ones.", pages:320, year:2018, total_copies:2, available_copies:0, emoji:"⚡", color:"#fff7ed" },
    { title:"Clean Code", author:"Robert C. Martin", genre:"Technology", isbn:"978-0132350884", description:"A handbook of agile software craftsmanship for writing clean, maintainable code.", pages:431, year:2008, total_copies:2, available_copies:1, emoji:"🧹", color:"#f0fdf4" },
    { title:"Sapiens", author:"Yuval Noah Harari", genre:"History", isbn:"978-0062316097", description:"A brief history of humankind from Homo sapiens to the present day.", pages:443, year:2011, total_copies:3, available_copies:3, emoji:"🏺", color:"#fffbeb" },
    { title:"Dune", author:"Frank Herbert", genre:"Fiction", isbn:"978-0441013593", description:"Epic science fiction set in the distant future on the desert planet Arrakis.", pages:688, year:1965, total_copies:1, available_copies:0, emoji:"🏜️", color:"#fefce8" },
    { title:"Introduction to Machine Learning", author:"Ethem Alpaydin", genre:"Technology", isbn:"978-0262043793", description:"Covers supervised/unsupervised learning, neural networks, and kernel machines.", pages:640, year:2020, total_copies:3, available_copies:2, emoji:"🤖", color:"#eff6ff" },
    { title:"The Alchemist", author:"Paulo Coelho", genre:"Fiction", isbn:"978-0062315007", description:"A magical tale about following your dream. Santiago's journey across the world.", pages:197, year:1988, total_copies:5, available_copies:5, emoji:"✨", color:"#fdf4ff" },
    { title:"Operating System Concepts", author:"Silberschatz & Galvin", genre:"Technology", isbn:"978-1119320913", description:"The 'Dinosaur Book' — covers memory management, scheduling, and I/O.", pages:944, year:2018, total_copies:2, available_copies:0, emoji:"🦕", color:"#f0fdfa" },
  ];
  const insertMany = db.transaction((rows) => rows.forEach(r => insertBook.run(r)));
  insertMany(seedBooks);
  console.log('✅ Seeded 12 books');
}

// ── EMAIL TRANSPORTER ───────────────────────────────────────────
// Replace with your SMTP credentials or use Gmail / SendGrid
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'your_email@gmail.com',
    pass: process.env.SMTP_PASS || 'your_app_password',
  },
});

async function sendMail(to, subject, html) {
  try {
    await transporter.sendMail({ from: '"LIBRA Library" <noreply@libra.edu>', to, subject, html });
    console.log(`📧 Email sent to ${to}: ${subject}`);
  } catch (e) {
    console.error('Email error:', e.message);
  }
}

function reminderHTML(title, name, dueDate, daysLeft, fine = 0) {
  const urgency = daysLeft <= 0 ? '#dc2626' : daysLeft === 1 ? '#f59e0b' : '#1e3a8a';
  const msg = daysLeft <= 0
    ? `Your book is <b>OVERDUE by ${Math.abs(daysLeft)} day(s)</b>. Fine accrued: ₹${fine}.`
    : `You have <b>${daysLeft} day(s) left</b> to return this book.`;
  return `
  <div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#0b1d3a,#122550);padding:28px 32px">
      <div style="color:#c9a84c;font-size:24px;font-weight:700;letter-spacing:3px">📚 LIBRA</div>
      <div style="color:rgba(255,255,255,0.6);margin-top:4px;font-size:13px">Smart Library Management</div>
    </div>
    <div style="padding:28px 32px;background:#fff">
      <p style="color:#111827;font-size:16px">Hello <b>${name}</b>,</p>
      <p style="color:#4b5563;margin:12px 0">This is a reminder about your borrowed book:</p>
      <div style="background:#f9fafb;border-left:4px solid ${urgency};border-radius:8px;padding:16px 20px;margin:20px 0">
        <div style="font-size:18px;font-weight:700;color:#111827">📖 ${title}</div>
        <div style="color:#6b7280;margin-top:6px;font-size:14px">Due Date: <b>${dueDate}</b></div>
        <div style="color:${urgency};margin-top:8px;font-size:15px;font-weight:600">${msg}</div>
      </div>
      <p style="color:#6b7280;font-size:13px">Please return the book to the library on time to avoid fines (₹5/day after due date).</p>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;font-size:12px;color:#9ca3af;text-align:center">
      LIBRA Library System • Auto-generated reminder
    </div>
  </div>`;
}

// ── AUTH MIDDLEWARE ─────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function adminAuth(req, res, next) {
  auth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    next();
  });
}

// ══════════════════════════════════════════════════════════════
//  ROUTES
// ══════════════════════════════════════════════════════════════

// ── AUTH ────────────────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  const { roll, name, email, password } = req.body;
  if (!roll || !name || !email || !password)
    return res.status(400).json({ error: 'All fields required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (roll,name,email,password) VALUES (?,?,?,?)');
    const info = stmt.run(roll, name, email, hash);
    // Welcome notification
    db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
      .run(info.lastInsertRowid, 'Welcome to LIBRA! 🎉', `Hello ${name}! Your account is ready. You can borrow up to 3 books at a time.`, 'success');
    const token = jwt.sign({ id: info.lastInsertRowid, roll, name, email, role: 'student' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: info.lastInsertRowid, roll, name, email, role: 'student' } });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Roll number or email already registered' });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { roll, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE roll = ?').get(roll);
  if (!user) return res.status(401).json({ error: 'Roll number not found' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Incorrect password' });
  const token = jwt.sign({ id: user.id, roll: user.roll, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, roll: user.roll, name: user.name, email: user.email, role: user.role } });
});

// ── BOOKS ───────────────────────────────────────────────────────
app.get('/api/books', (req, res) => {
  const { q, genre, available } = req.query;
  let sql = 'SELECT * FROM books WHERE 1=1';
  const params = [];
  if (q) { sql += ' AND (title LIKE ? OR author LIKE ? OR genre LIKE ?)'; const p = `%${q}%`; params.push(p,p,p); }
  if (genre && genre !== 'all') { sql += ' AND genre = ?'; params.push(genre); }
  if (available === 'true') { sql += ' AND available_copies > 0'; }
  if (available === 'false') { sql += ' AND available_copies = 0'; }
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/books/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(book);
});

app.post('/api/books', adminAuth, (req, res) => {
  const { title, author, genre, isbn, description, pages, year, total_copies, emoji, color } = req.body;
  const stmt = db.prepare(`INSERT INTO books (title,author,genre,isbn,description,pages,year,total_copies,available_copies,emoji,color)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const info = stmt.run(title, author, genre, isbn, description, pages, year, total_copies, total_copies, emoji||'📖', color||'#f0f4ff');
  res.json({ id: info.lastInsertRowid, message: 'Book added' });
});

app.put('/api/books/:id', adminAuth, (req, res) => {
  const { title, author, genre, description, pages, year, total_copies } = req.body;
  db.prepare('UPDATE books SET title=?,author=?,genre=?,description=?,pages=?,year=?,total_copies=? WHERE id=?')
    .run(title, author, genre, description, pages, year, total_copies, req.params.id);
  res.json({ message: 'Updated' });
});

app.delete('/api/books/:id', adminAuth, (req, res) => {
  db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// ── BORROWS ─────────────────────────────────────────────────────
app.post('/api/borrows', auth, (req, res) => {
  const { book_id } = req.body;
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(book_id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  if (book.available_copies < 1) return res.status(400).json({ error: 'No copies available' });

  // Check user borrow limit (3 active)
  const active = db.prepare("SELECT COUNT(*) as c FROM borrows WHERE user_id=? AND status='active'").get(req.user.id).c;
  if (active >= 3) return res.status(400).json({ error: 'Borrow limit reached (max 3 books)' });

  // Check already borrowed this book
  const dup = db.prepare("SELECT id FROM borrows WHERE user_id=? AND book_id=? AND status='active'").get(req.user.id, book_id);
  if (dup) return res.status(400).json({ error: 'You already have this book borrowed' });

  const due = new Date();
  due.setDate(due.getDate() + 14);
  const dueStr = due.toISOString().split('T')[0];

  const info = db.prepare('INSERT INTO borrows (user_id,book_id,due_date) VALUES (?,?,?)').run(req.user.id, book_id, dueStr);
  db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?').run(book_id);

  // Notification
  db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
    .run(req.user.id, '📚 Book Borrowed', `You borrowed "${book.title}". Please return by ${dueStr}.`, 'info');

  res.json({ id: info.lastInsertRowid, due_date: dueStr, message: 'Book borrowed successfully' });
});

app.get('/api/borrows/my', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT b.*, bk.title, bk.author, bk.emoji, bk.color, bk.genre,
      CASE WHEN b.status='active' AND date(b.due_date) < date('now')
           THEN CAST((julianday('now') - julianday(b.due_date)) * 5 AS INTEGER)
           ELSE b.fine END as computed_fine
    FROM borrows b JOIN books bk ON b.book_id = bk.id
    WHERE b.user_id = ? ORDER BY b.id DESC
  `).all(req.user.id);
  res.json(rows);
});

app.get('/api/borrows/all', adminAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT b.*, u.name, u.roll, u.email, bk.title, bk.author
    FROM borrows b
    JOIN users u ON b.user_id = u.id
    JOIN books bk ON b.book_id = bk.id
    ORDER BY b.id DESC
  `).all();
  res.json(rows);
});

app.put('/api/borrows/:id/return', auth, (req, res) => {
  const borrow = db.prepare('SELECT * FROM borrows WHERE id=?').get(req.params.id);
  if (!borrow) return res.status(404).json({ error: 'Borrow record not found' });
  if (borrow.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Forbidden' });
  if (borrow.status !== 'active') return res.status(400).json({ error: 'Already returned' });

  const today = new Date().toISOString().split('T')[0];
  const due = new Date(borrow.due_date);
  const now = new Date();
  let fine = 0;
  if (now > due) {
    const days = Math.floor((now - due) / 86400000);
    fine = days * 5; // ₹5 per day
  }

  db.prepare("UPDATE borrows SET status='returned', return_date=?, fine=? WHERE id=?").run(today, fine, borrow.id);
  db.prepare('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?').run(borrow.book_id);

  const book = db.prepare('SELECT title FROM books WHERE id=?').get(borrow.book_id);
  const msg = fine > 0
    ? `You returned "${book.title}". Fine of ₹${fine} applied for late return.`
    : `You returned "${book.title}" on time. Thank you! 🎉`;
  db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
    .run(borrow.user_id, fine > 0 ? '⚠️ Late Return' : '✅ Book Returned', msg, fine > 0 ? 'warning' : 'success');

  res.json({ message: 'Returned successfully', fine });
});

// ── WISHLIST ────────────────────────────────────────────────────
app.get('/api/wishlist', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT w.id, bk.* FROM wishlist w JOIN books bk ON w.book_id = bk.id
    WHERE w.user_id = ? ORDER BY w.id DESC
  `).all(req.user.id);
  res.json(rows);
});

app.post('/api/wishlist', auth, (req, res) => {
  const { book_id } = req.body;
  try {
    db.prepare('INSERT INTO wishlist (user_id,book_id) VALUES (?,?)').run(req.user.id, book_id);
    res.json({ message: 'Added to wishlist' });
  } catch {
    res.status(409).json({ error: 'Already in wishlist' });
  }
});

app.delete('/api/wishlist/:bookId', auth, (req, res) => {
  db.prepare('DELETE FROM wishlist WHERE user_id=? AND book_id=?').run(req.user.id, req.params.bookId);
  res.json({ message: 'Removed from wishlist' });
});

// ── NOTIFICATIONS ───────────────────────────────────────────────
app.get('/api/notifications', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 30').all(req.user.id);
  res.json(rows);
});

app.put('/api/notifications/read-all', auth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id);
  res.json({ message: 'All marked read' });
});

// ── DASHBOARD (user stats) ──────────────────────────────────────
app.get('/api/dashboard', auth, (req, res) => {
  const active   = db.prepare("SELECT COUNT(*) as c FROM borrows WHERE user_id=? AND status='active'").get(req.user.id).c;
  const returned = db.prepare("SELECT COUNT(*) as c FROM borrows WHERE user_id=? AND status='returned'").get(req.user.id).c;
  const overdue  = db.prepare("SELECT COUNT(*) as c FROM borrows WHERE user_id=? AND status='active' AND date(due_date)<date('now')").get(req.user.id).c;
  const fine     = db.prepare("SELECT COALESCE(SUM(fine),0) as f FROM borrows WHERE user_id=?").get(req.user.id).f;
  const wishCount= db.prepare("SELECT COUNT(*) as c FROM wishlist WHERE user_id=?").get(req.user.id).c;
  const unread   = db.prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0").get(req.user.id).c;
  res.json({ active, returned, overdue, fine, wishCount, unread });
});

// ── ADMIN STATS ─────────────────────────────────────────────────
app.get('/api/admin/stats', adminAuth, (req, res) => {
  const totalBooks    = db.prepare('SELECT COUNT(*) as c FROM books').get().c;
  const totalUsers    = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const activeBorrows = db.prepare("SELECT COUNT(*) as c FROM borrows WHERE status='active'").get().c;
  const overdue       = db.prepare("SELECT COUNT(*) as c FROM borrows WHERE status='active' AND date(due_date)<date('now')").get().c;
  const totalFines    = db.prepare('SELECT COALESCE(SUM(fine),0) as f FROM borrows').get().f;
  res.json({ totalBooks, totalUsers, activeBorrows, overdue, totalFines });
});

// ── SEND OTP (simple in-memory store) ──────────────────────────
const otpStore = {};
app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  otpStore[email] = { otp, exp: Date.now() + 5 * 60 * 1000 };
  await sendMail(email, 'LIBRA — Your OTP Code', `
    <div style="font-family:'Segoe UI',sans-serif;padding:32px;max-width:400px;margin:auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
      <div style="color:#0b1d3a;font-size:24px;font-weight:700">📚 LIBRA</div>
      <p style="color:#374151;margin:16px 0">Your one-time password for signup:</p>
      <div style="font-size:42px;font-weight:800;color:#0b1d3a;letter-spacing:10px;text-align:center;padding:20px;background:#f9fafb;border-radius:8px">${otp}</div>
      <p style="color:#9ca3af;font-size:13px;margin-top:16px">Expires in 5 minutes. Do not share this code.</p>
    </div>
  `);
  res.json({ message: 'OTP sent (check console if email not configured)', _dev_otp: otp });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore[email];
  if (!record) return res.status(400).json({ error: 'No OTP found for this email' });
  if (Date.now() > record.exp) return res.status(400).json({ error: 'OTP expired' });
  if (record.otp !== otp) return res.status(400).json({ error: 'Incorrect OTP' });
  delete otpStore[email];
  res.json({ message: 'OTP verified', verified: true });
});

// ══════════════════════════════════════════════════════════════
//  CRON JOBS — REMINDER SYSTEM
// ══════════════════════════════════════════════════════════════

// Runs every day at 8:00 AM
cron.schedule('0 8 * * *', async () => {
  console.log('🔔 Running daily reminder job...');

  const borrows = db.prepare(`
    SELECT b.*, u.name, u.email, u.id as uid, bk.title
    FROM borrows b
    JOIN users u ON b.user_id = u.id
    JOIN books bk ON b.book_id = bk.id
    WHERE b.status = 'active'
  `).all();

  const today = new Date();

  for (const borrow of borrows) {
    const due = new Date(borrow.due_date);
    const daysLeft = Math.round((due - today) / 86400000);
    const overdueDays = daysLeft < 0 ? Math.abs(daysLeft) : 0;
    const fine = overdueDays * 5;

    // 3-day reminder
    if (daysLeft === 3 && !borrow.reminder_3) {
      await sendMail(borrow.email, `📚 Return Reminder — "${borrow.title}" due in 3 days`, reminderHTML(borrow.title, borrow.name, borrow.due_date, 3));
      db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
        .run(borrow.uid, '📅 Return in 3 Days', `"${borrow.title}" is due on ${borrow.due_date}. Please return it on time!`, 'warning');
      db.prepare('UPDATE borrows SET reminder_3=1 WHERE id=?').run(borrow.id);
      console.log(`  3-day reminder sent to ${borrow.email}`);
    }

    // 1-day reminder
    if (daysLeft === 1 && !borrow.reminder_1) {
      await sendMail(borrow.email, `⚠️ Return Tomorrow — "${borrow.title}"`, reminderHTML(borrow.title, borrow.name, borrow.due_date, 1));
      db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
        .run(borrow.uid, '⚠️ Due Tomorrow!', `"${borrow.title}" must be returned tomorrow (${borrow.due_date}). Avoid fines!`, 'warning');
      db.prepare('UPDATE borrows SET reminder_1=1 WHERE id=?').run(borrow.id);
      console.log(`  1-day reminder sent to ${borrow.email}`);
    }

    // Overdue alert (sent once per day if overdue)
    if (daysLeft < 0) {
      await sendMail(borrow.email, `🚨 OVERDUE — "${borrow.title}" (₹${fine} fine)`, reminderHTML(borrow.title, borrow.name, borrow.due_date, daysLeft, fine));
      db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
        .run(borrow.uid, '🚨 Book Overdue!', `"${borrow.title}" is overdue by ${overdueDays} day(s). Fine: ₹${fine}. Return immediately!`, 'error');
      // Update fine in DB
      db.prepare('UPDATE borrows SET fine=? WHERE id=?').run(fine, borrow.id);
      console.log(`  Overdue alert sent to ${borrow.email} (₹${fine} fine)`);
    }
  }
  console.log(`✅ Reminders done. Processed ${borrows.length} active borrows.`);
});

// ── START SERVER ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   📚 LIBRA Backend Running           ║
  ║   http://localhost:${PORT}               ║
  ║                                       ║
  ║   API Base:  /api                     ║
  ║   Frontend:  open libra.html          ║
  ║   Reminders: Daily 8:00 AM (cron)    ║
  ╚═══════════════════════════════════════╝
  `);
});
