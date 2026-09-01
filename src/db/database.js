import Database from 'better-sqlite3';
import { config } from '../config/config.js';

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  // 1. Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      timezone TEXT DEFAULT '+05:00',
      reminder_morning TEXT DEFAULT '09:00',
      reminder_evening TEXT DEFAULT '21:00',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // 2. Monthly Challenges table
  db.exec(`
    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      month_key TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL CHECK(type IN ('habit', 'learning', 'skill')),
      category TEXT NOT NULL,
      target_days INTEGER DEFAULT 7,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'archived', 'dropped')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_challenges_user_month ON challenges(user_id, month_key, status);
  `);

  // 3. Daily Logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      log_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('completed', 'skipped', 'missed')),
      note TEXT,
      rating INTEGER CHECK(rating IS NULL OR (rating >= 1 AND rating <= 5)),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
      UNIQUE(challenge_id, log_date)
    );
    CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(user_id, log_date);
  `);

  // 4. Knowledge Checks / Material Assessment table
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      check_date TEXT NOT NULL,
      topic TEXT NOT NULL,
      key_takeaways TEXT NOT NULL,
      quiz_question TEXT,
      user_answer TEXT,
      comprehension_score INTEGER NOT NULL CHECK(comprehension_score >= 1 AND comprehension_score <= 10),
      confidence_score INTEGER DEFAULT 5 CHECK(confidence_score >= 1 AND confidence_score <= 5),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_checks_user ON knowledge_checks(user_id, check_date);
  `);

  // 5. Weekly Checkpoints & Competency Analysis table
  db.exec(`
    CREATE TABLE IF NOT EXISTS weekly_checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      week_key TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      habit_rate REAL NOT NULL,
      learning_score REAL NOT NULL,
      competencies_json TEXT NOT NULL,
      strengths TEXT,
      areas_to_improve TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
      UNIQUE(user_id, week_key)
    );
    CREATE INDEX IF NOT EXISTS idx_checkpoints_user_week ON weekly_checkpoints(user_id, week_key);
  `);

  return db;
}

export { db };
