# 📚 LIBRA — Smart Library Management System

## Project Structure
```
libra/
├── libra.html      ← Frontend (open in browser)
├── server.js       ← Backend (Node.js + Express)
├── package.json    ← Dependencies
└── libra.db        ← SQLite database (auto-created)
```

---

## ⚡ Quick Start

### Option A — Frontend Only (No Installation)
Just open `libra.html` in your browser. Works offline with localStorage.
All features work except real email reminders.

### Option B — Full Stack (With Backend + Real Email Reminders)

**Step 1 — Install Node.js**
Download from https://nodejs.org (v18 or higher)

**Step 2 — Install dependencies**
```bash
npm install
```

**Step 3 — Configure Email (for real reminders)**
Open `server.js` and find this section:
```js
auth: {
  user: process.env.SMTP_USER || 'your_email@gmail.com',
  pass: process.env.SMTP_PASS || 'your_app_password',
}
```
Replace with your Gmail and App Password.
(Gmail → Settings → 2FA → App Passwords → Generate)

Or use environment variables:
```bash
SMTP_USER=you@gmail.com SMTP_PASS=yourpass node server.js
```

**Step 4 — Run the backend**
```bash
node server.js
# or for auto-reload during development:
npx nodemon server.js
```

**Step 5 — Open the frontend**
Open `libra.html` in your browser.
The frontend auto-detects the backend at `http://localhost:3000`.

---

## 🔔 Reminder System

| Trigger | When | How |
|---------|------|-----|
| Borrow Confirmation | Immediately | In-app + Email |
| 3-Day Reminder | 3 days before due | In-app + Email |
| 1-Day Urgent | 1 day before due | In-app + Email |
| Overdue Alert | Every day after due | In-app + Email |

Reminders run automatically every day at **8:00 AM** via cron job.

**Fine Rate:** ₹5 per day after due date.
**Borrow Period:** 14 days from borrow date.
**Max Books:** 3 books per student at a time.

---

## 🛠️ API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/send-otp` | Send OTP to email |
| POST | `/api/auth/verify-otp` | Verify OTP |

### Books
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/books` | List all books (supports ?q=, ?genre=, ?available=) |
| GET | `/api/books/:id` | Get single book |
| POST | `/api/books` | Add book (admin only) |

### Borrows
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/borrows` | Borrow a book |
| GET | `/api/borrows/my` | My borrow history |
| PUT | `/api/borrows/:id/return` | Return a book |

### Wishlist & Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/wishlist` | View / Add to wishlist |
| DELETE | `/api/wishlist/:bookId` | Remove from wishlist |
| GET | `/api/notifications` | My notifications |
| PUT | `/api/notifications/read-all` | Mark all read |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | User stats |
| GET | `/api/admin/stats` | Admin overview |

---

## 🎨 Frontend Pages

| Page | Feature |
|------|---------|
| **Home** | Hero, stats, feature overview |
| **Library** | Search, filter, browse 12+ books |
| **Borrow** | Request books, see reminder timeline |
| **⏰ Reminders** | Color-coded due date tracker |
| **❤️ Wishlist** | Saved books |
| **🔔 Alerts** | In-app notifications |
| **Dashboard** | Stats, borrow history, fines, return button |

---

## 🔑 Test Credentials (Offline Mode)
Sign up with any roll number / email / password.
OTP will be shown in an alert box (offline demo mode).

## 🔑 Admin Access (Backend Mode)
Manually update a user's role in the database:
```sql
UPDATE users SET role='admin' WHERE roll='22CS101';
```
