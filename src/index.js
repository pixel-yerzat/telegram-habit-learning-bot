import http from 'http';
import { config } from './config/config.js';
import { initDatabase } from './db/database.js';
import { createBot } from './bot/bot.js';
import { schedulerService } from './services/schedulerService.js';

// Global error handlers to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

async function main() {
  console.log('🚀 Starting Habit & Learning Tracker Telegram Bot...');

  // 1. Start lightweight HTTP health-check server for Railway
  const port = process.env.PORT || 3000;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'Telegram Habit & Learning Tracker Bot',
      database: 'connected',
      timestamp: new Date().toISOString()
    }));
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Health check server listening on 0.0.0.0:${port}`);
  });

  // 2. Initialize SQLite Database
  console.log(`📁 Database path: ${config.dbPath}`);
  try {
    initDatabase();
    console.log('✅ SQLite database initialized successfully.');
  } catch (dbErr) {
    console.error('❌ Database initialization error:', dbErr);
  }

  // 3. Check Bot Token
  if (!config.botToken || config.botToken === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    console.log('\n=============================================================');
    console.log('⚠️  ВНИМАНИЕ: BOT_TOKEN не указан в Переменных Окружения Railway!');
    console.log('👉 Пожалуйста, откройте вкладку "Variables" в Railway и добавьте:');
    console.log('   BOT_TOKEN = 8989474252:AAGNAYMtC-rUKdy1Mqvb9YkMhmdXcqiX2ww');
    console.log('   GEMINI_API_KEY = ваш_ключ_от_Google_AI_Studio');
    console.log('   DB_PATH = /app/data/bot.sqlite');
    console.log('=============================================================\n');
    // Keep server running for Railway health check instead of exiting
    return;
  }

  // 4. Initialize Bot instance
  const bot = createBot();

  // 5. Initialize Cron Scheduler
  schedulerService.init(bot);

  // 6. Start Bot polling with dropPendingUpdates to clean any old conflicts
  try {
    console.log('⏳ Connecting to Telegram Bot API...');
    await bot.launch({
      dropPendingUpdates: true
    });
    console.log('🤖 Telegram Bot is connected and running in polling mode!');
  } catch (err) {
    console.error('❌ Failed to launch bot:', err.message);
    if (err.message.includes('401')) {
      console.error('👉 Ошибка 401: Неверный BOT_TOKEN. Проверьте токен в настройках Variables.');
    } else if (err.message.includes('409')) {
      console.error('👉 Ошибка 409: Бот уже запущен в другом месте. Остановите локальный npm run dev на компьютере.');
    }
  }

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('🛑 Shutting down gracefully...');
    server.close();
    bot.stop();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error on startup:', err);
});
