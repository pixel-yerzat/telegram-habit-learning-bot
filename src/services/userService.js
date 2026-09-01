import { db } from '../db/database.js';
import { config } from '../config/config.js';

export const userService = {
  getOrCreateUser(telegramId, username = '', firstName = '') {
    const existing = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
    if (existing) {
      // Update username or firstName if changed
      if (existing.username !== username || existing.first_name !== firstName) {
        db.prepare(`
          UPDATE users 
          SET username = ?, first_name = ?, updated_at = datetime('now')
          WHERE telegram_id = ?
        `).run(username || '', firstName || '', telegramId);
        return { ...existing, username, first_name: firstName };
      }
      return existing;
    }

    db.prepare(`
      INSERT INTO users (telegram_id, username, first_name, timezone, reminder_morning, reminder_evening, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(
      telegramId,
      username || '',
      firstName || '',
      config.defaultTimezone,
      config.defaultMorningReminder,
      config.defaultEveningReminder
    );

    return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
  },

  getUser(telegramId) {
    return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
  },

  updateSettings(telegramId, { timezone, reminder_morning, reminder_evening, is_active }) {
    const user = this.getUser(telegramId);
    if (!user) return null;

    db.prepare(`
      UPDATE users
      SET timezone = COALESCE(?, timezone),
          reminder_morning = COALESCE(?, reminder_morning),
          reminder_evening = COALESCE(?, reminder_evening),
          is_active = COALESCE(?, is_active),
          updated_at = datetime('now')
      WHERE telegram_id = ?
    `).run(
      timezone !== undefined ? timezone : null,
      reminder_morning !== undefined ? reminder_morning : null,
      reminder_evening !== undefined ? reminder_evening : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      telegramId
    );

    return this.getUser(telegramId);
  },

  getAllActiveUsers() {
    return db.prepare('SELECT * FROM users WHERE is_active = 1').all();
  }
};
