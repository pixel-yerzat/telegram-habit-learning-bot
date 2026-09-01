import { config } from './config/config.js';
import { initDatabase } from './db/database.js';
import { createBot } from './bot/bot.js';
import { schedulerService } from './services/schedulerService.js';

async function main() {
  console.log('🚀 Starting Habit & Learning Tracker Telegram Bot...');

  // 1. Initialize SQLite Database
  console.log(`📁 Database path: ${config.dbPath}`);
  initDatabase();
  console.log('✅ SQLite database initialized successfully.');

  // 2. Initialize Bot
  const bot = createBot();

  // 3. Initialize Cron Scheduler
  schedulerService.init(bot);

  // 4. Start Bot polling
  if (!config.botToken || config.botToken.includes('YOUR_TELEGRAM_BOT_TOKEN')) {
    console.log('\n=============================================================');
    console.log('⚠️  ВНИМАНИЕ: BOT_TOKEN не указан в файле .env');
    console.log('1. Откройте файл .env');
    console.log('2. Вставьте ваш токен бота от @BotFather: BOT_TOKEN=123456:ABC-DEF...');
    console.log('3. Перезапустите бота: npm start');
    console.log('=============================================================\n');
    return;
  }

  try {
    await bot.launch();
    console.log('🤖 Telegram Bot is running in polling mode!');
  } catch (err) {
    console.error('❌ Failed to launch bot:', err.message);
    if (err.message.includes('401')) {
      console.error('👉 Проверьте правильность BOT_TOKEN в файле .env');
    }
  }

  // Graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal error on startup:', err);
});
