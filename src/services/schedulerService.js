import cron from 'node-cron';
import dayjs from 'dayjs';
import { userService } from './userService.js';
import { challengeService } from './challengeService.js';
import { analyticsService } from './analyticsService.js';
import { keyboards } from '../bot/keyboards.js';
import { dateUtils } from '../utils/dateUtils.js';

export const schedulerService = {
  init(bot) {
    console.log('⏰ Initializing automated scheduler (node-cron)...');

    // Runs every minute to check if any user is due for morning, evening, monthly, or weekly triggers
    cron.schedule('* * * * *', async () => {
      await this.runMinuteTick(bot);
    });

    console.log('✅ Scheduler active.');
  },

  async runMinuteTick(bot) {
    try {
      const now = dayjs();
      const currentDayOfWeek = now.day(); // 0 is Sunday
      const currentDateOfMonth = now.date(); // 1-31
      const currentTimeStr = now.format('HH:mm'); // e.g. "09:00"

      const activeUsers = userService.getAllActiveUsers();

      for (const user of activeUsers) {
        const userId = user.telegram_id;

        // 1. Check if 1st day of the month at 09:30 -> Monthly intake prompt
        if (currentDateOfMonth === 1 && currentTimeStr === '09:30') {
          await this.sendMonthlyIntakePrompt(bot, user);
        }

        // 2. Check Morning Reminder
        if (user.reminder_morning === currentTimeStr) {
          await this.sendMorningReminder(bot, user);
        }

        // 3. Check Evening Reminder (Habit Tracker Check-in)
        if (user.reminder_evening === currentTimeStr) {
          await this.sendEveningReminder(bot, user);
        }

        // 4. Check Sunday Weekly Competency Analysis (at 20:00 on Sunday)
        if (currentDayOfWeek === 0 && currentTimeStr === '20:00') {
          await this.sendWeeklyReport(bot, user);
        }
      }
    } catch (err) {
      console.error('Error in scheduler tick:', err);
    }
  },

  async sendMonthlyIntakePrompt(bot, user) {
    try {
      const monthName = dateUtils.getMonthNameRu(dateUtils.getCurrentMonthKey());
      const msg = `🎉 <b>Наступил новый месяц — ${monthName}!</b>\n\n` +
        `Время ставить новые цели и челленджи на этот месяц. ` +
        `Определите 1-5 ключевых направлений (привычки, курсы, чтение, спорт), ` +
        `чтобы весь месяц бот помогал вам удерживать фокус и расти!\n\n` +
        `Нажмите кнопку ниже, чтобы настроить челленджи на ${monthName}:`;

      await bot.telegram.sendMessage(user.telegram_id, msg, {
        parse_mode: 'HTML',
        ...keyboards.monthlyIntakePrompt()
      });
    } catch (e) {
      console.error(`Failed to send monthly intake to user ${user.telegram_id}:`, e.message);
    }
  },

  async sendMorningReminder(bot, user) {
    try {
      const todayChallenges = challengeService.getTodayChallengesWithStatus(user.telegram_id);
      if (todayChallenges.length === 0) return;

      let msg = `🌅 <b>Доброе утро, ${user.first_name || 'друг'}!</b>\n\n` +
        `🎯 <b>Твои фокус-цели на сегодня:</b>\n`;

      todayChallenges.forEach((ch, idx) => {
        const typeEmoji = ch.type === 'learning' ? '🧠' : (ch.type === 'skill' ? '⚡' : '🔥');
        msg += `${idx + 1}. ${typeEmoji} <b>${ch.title}</b> (${ch.category}) | Стрик: ${ch.streak} дн. 🔥\n`;
      });

      msg += `\n<i>Продуктивного дня! Вечером подведем итоги и зафиксируем результаты.</i>`;

      await bot.telegram.sendMessage(user.telegram_id, msg, {
        parse_mode: 'HTML',
        ...keyboards.mainMenu()
      });
    } catch (e) {
      console.error(`Failed to send morning reminder to ${user.telegram_id}:`, e.message);
    }
  },

  async sendEveningReminder(bot, user) {
    try {
      const todayChallenges = challengeService.getTodayChallengesWithStatus(user.telegram_id);
      if (todayChallenges.length === 0) return;

      const completedCount = todayChallenges.filter(c => c.today_status === 'completed').length;
      const totalCount = todayChallenges.length;

      let msg = `🌙 <b>Вечерний чек-ин привычек и целей!</b>\n\n` +
        `Прогресс за сегодня: <b>${completedCount}/${totalCount}</b> выполнено.\n` +
        `Отметьте результаты за сегодня с помощью кнопок ниже:`;

      await bot.telegram.sendMessage(user.telegram_id, msg, {
        parse_mode: 'HTML',
        ...keyboards.todayCheckinKeyboard(todayChallenges)
      });
    } catch (e) {
      console.error(`Failed to send evening reminder to ${user.telegram_id}:`, e.message);
    }
  },

  async sendWeeklyReport(bot, user) {
    try {
      const analysis = analyticsService.generateWeeklyAnalysis(user.telegram_id);
      const text = analyticsService.formatWeeklyReportText(analysis);
      const chartUrl = analyticsService.generateRadarChartUrl(analysis);

      await bot.telegram.sendPhoto(user.telegram_id, chartUrl, {
        caption: text,
        parse_mode: 'HTML'
      });
    } catch (e) {
      console.error(`Failed to send weekly report to ${user.telegram_id}:`, e.message);
    }
  }
};
