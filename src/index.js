import http from 'http';
import { config } from './config/config.js';
import { initDatabase } from './db/database.js';
import { createBot } from './bot/bot.js';
import { schedulerService } from './services/schedulerService.js';

async function main() {
  console.log('🚀 Starting Habit & Learning Tracker Telegram Bot...');

  // 1. Start HTTP health check server for Railway (prevents health check crashes)
  const port = process.env.PORT || 3000;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'Telegram Habit & Learning Tracker Bot',
      database: 'connected',
      timestamp: new Date().toISOString()
    }));
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Health check server listening on port ${port}`);
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
  if (!config.botToken || config.botToken.includes('YOUR_TELEGRAM_BOT_TOKEN')) {
    console.log('\n=============================================================');
    console.log('⚠️  ВНИМАНИЕ: BOT_TOKEN не указан в Переменных Окружения!');
    console.log('👉 Пожалуйста, откройте вкладку "Variables" в Railway и добавьте:');
    console.log('   BOT_TOKEN = ваш_токен_от_BotFather');
    console.log('   GEMINI_API_KEY = ваш_ключ_от_Google_AI_Studio');
    console.log('=============================================================\n');
    return;
  }

  // 4. Initialize Bot
  const bot = createBot();

  // 5. Initialize Cron Scheduler
  schedulerService.init(bot);

  // 6. Start Bot polling
  try {
    await bot.launch();
    console.log('🤖 Telegram Bot is running in polling mode!');
  } catch (err) {
    console.error('❌ Failed to launch bot:', err.message);
    if (err.message.includes('401')) {
      console.error('👉 Ошибка 401: Неверный BOT_TOKEN. Проверьте токен в настройках Variables.');
    } else if (err.message.includes('409')) {
      console.error('👉 Ошибка 409: Бот уже запущен в другом месте (например, на вашем компьютере). Остановите локальный процесс.');
    }
  }

  // Graceful stop
  process.once('SIGINT', () => {
    server.close();
    bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    server.close();
    bot.stop('SIGTERM');
  });
}

main().catch((err) => {
  console.error('Fatal error on startup:', err);
});
