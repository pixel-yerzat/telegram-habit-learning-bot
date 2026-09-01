import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const dbPath = process.env.DB_PATH || './data/bot.sqlite';
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(rootDir, dbPath);
const dataDir = path.dirname(resolvedDbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const config = {
  botToken: process.env.BOT_TOKEN || '',
  dbPath: resolvedDbPath,
  defaultTimezone: process.env.DEFAULT_TIMEZONE || '+05:00',
  defaultMorningReminder: process.env.DEFAULT_MORNING_REMINDER || '09:00',
  defaultEveningReminder: process.env.DEFAULT_EVENING_REMINDER || '21:00',
  weeklyReviewDay: parseInt(process.env.WEEKLY_REVIEW_DAY ?? '0', 10), // 0 is Sunday
  weeklyReviewTime: process.env.WEEKLY_REVIEW_TIME || '20:00',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
};
