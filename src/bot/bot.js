import { Telegraf, Scenes, session } from 'telegraf';
import { config } from '../config/config.js';
import { userService } from '../services/userService.js';

// Scenes
import { addChallengeScene } from './scenes/addChallengeScene.js';
import { knowledgeCheckScene } from './scenes/knowledgeCheckScene.js';
import { settingsScene } from './scenes/settingsScene.js';

// Handlers
import { startHandler } from './handlers/startHandler.js';
import { challengeHandler } from './handlers/challengeHandler.js';
import { checkinHandler } from './handlers/checkinHandler.js';
import { quizHandler } from './handlers/quizHandler.js';
import { weeklyHandler } from './handlers/weeklyHandler.js';

export function createBot() {
  if (!config.botToken || config.botToken === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    console.warn('⚠️ WARNING: BOT_TOKEN is not set in .env! Please configure your token.');
  }

  const bot = new Telegraf(config.botToken || 'DUMMY_TOKEN_FOR_TESTING');

  // Register session & Stage
  const stage = new Scenes.Stage([
    addChallengeScene,
    knowledgeCheckScene,
    settingsScene
  ]);

  bot.use(session());
  bot.use(stage.middleware());

  // Middleware to ensure user exists in database on every message
  bot.use(async (ctx, next) => {
    if (ctx.from) {
      userService.getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
    }
    return next();
  });

  // Basic commands
  bot.command('start', (ctx) => startHandler.handleStart(ctx));
  bot.command('help', (ctx) => startHandler.handleHelp(ctx));

  // Challenge commands & UI
  bot.command('challenges', (ctx) => challengeHandler.handleListChallenges(ctx));
  bot.hears('🎯 Челленджи месяца', (ctx) => challengeHandler.handleListChallenges(ctx));

  bot.command('add', (ctx) => ctx.scene.enter('ADD_CHALLENGE_SCENE'));
  bot.hears('➕ Добавить цель', (ctx) => ctx.scene.enter('ADD_CHALLENGE_SCENE'));

  // Habit check-in
  bot.command('checkin', (ctx) => checkinHandler.handleCheckin(ctx));
  bot.hears('✅ Отметить сегодня', (ctx) => checkinHandler.handleCheckin(ctx));

  // Knowledge & Learning validation
  bot.command(['quiz', 'review', 'learn'], (ctx) => quizHandler.handleQuizMenu(ctx));
  bot.hears('🧠 Проверка знаний', (ctx) => quizHandler.handleQuizMenu(ctx));

  // Weekly Competency Analysis & Diagram
  bot.command(['weekly', 'diagram', 'stats'], (ctx) => weeklyHandler.handleWeeklyReport(ctx));
  bot.hears('📊 Анализ компетенций', (ctx) => weeklyHandler.handleWeeklyReport(ctx));

  // Settings
  bot.command('settings', (ctx) => ctx.scene.enter('SETTINGS_SCENE'));
  bot.hears('⚙️ Настройки', (ctx) => ctx.scene.enter('SETTINGS_SCENE'));

  // Inline Button Actions
  bot.action('start_add_challenge', (ctx) => {
    ctx.answerCbQuery();
    return ctx.scene.enter('ADD_CHALLENGE_SCENE');
  });

  bot.action('view_challenges', (ctx) => {
    ctx.answerCbQuery();
    return challengeHandler.handleListChallenges(ctx);
  });

  bot.action('manage_challenges_menu', (ctx) => {
    ctx.answerCbQuery();
    return challengeHandler.handleManageMenu(ctx);
  });

  bot.action(/^delete_ch_(\d+)$/, (ctx) => {
    const challengeId = parseInt(ctx.match[1], 10);
    return challengeHandler.handleDeleteChallenge(ctx, challengeId);
  });

  bot.action('open_today_checkin', (ctx) => {
    ctx.answerCbQuery();
    return checkinHandler.handleCheckin(ctx);
  });

  bot.action(/^toggle_(\d+)$/, (ctx) => {
    const challengeId = parseInt(ctx.match[1], 10);
    return checkinHandler.handleToggle(ctx, challengeId);
  });

  bot.action('refresh_today', (ctx) => {
    return checkinHandler.handleRefresh(ctx);
  });

  bot.action('open_quiz_menu', (ctx) => {
    ctx.answerCbQuery();
    return quizHandler.handleQuizMenu(ctx);
  });

  bot.action('start_knowledge_check', (ctx) => {
    ctx.answerCbQuery();
    return ctx.scene.enter('KNOWLEDGE_CHECK_SCENE');
  });

  bot.action('view_knowledge_history', (ctx) => {
    ctx.answerCbQuery();
    return quizHandler.handleHistory(ctx);
  });

  bot.action('refresh_weekly_diagram', (ctx) => {
    return weeklyHandler.handleRefreshDiagram(ctx);
  });

  // Global Error Handler
  bot.catch((err, ctx) => {
    console.error(`[Telegraf Error for update ${ctx?.updateType}]:`, err);
  });

  return bot;
}
