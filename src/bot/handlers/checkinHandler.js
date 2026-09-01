import { challengeService } from '../../services/challengeService.js';
import { keyboards } from '../keyboards.js';
import { dateUtils } from '../../utils/dateUtils.js';

export const checkinHandler = {
  async handleCheckin(ctx) {
    const userId = ctx.from.id;
    const todayStr = dateUtils.getTodayDateStr();
    const todayChallenges = challengeService.getTodayChallengesWithStatus(userId, todayStr);

    if (todayChallenges.length === 0) {
      return ctx.reply(
        '🎯 У вас пока нет активных целей на этот месяц.\n\n' +
        'Нажмите <b>➕ Добавить цель</b>, чтобы создать первый челлендж!',
        {
          parse_mode: 'HTML',
          ...keyboards.mainMenu()
        }
      );
    }

    const completed = todayChallenges.filter(c => c.today_status === 'completed').length;
    const total = todayChallenges.length;
    const formattedDate = dateUtils.formatDisplayDate(todayStr);

    const msg = `🗓 <b>Чек-ин за сегодня (${formattedDate}):</b>\n\n` +
      `Прогресс дня: <b>${completed}/${total}</b> выполнено.\n\n` +
      `<i>Нажимайте на кнопки целей ниже, чтобы переключать статус (✅ Выполнено / ❌ Пропущено / ⬜ Ожидает):</i>`;

    await ctx.reply(msg, {
      parse_mode: 'HTML',
      ...keyboards.todayCheckinKeyboard(todayChallenges)
    });
  },

  async handleToggle(ctx, challengeId) {
    const userId = ctx.from.id;
    const todayStr = dateUtils.getTodayDateStr();
    const challenges = challengeService.getTodayChallengesWithStatus(userId, todayStr);
    const target = challenges.find(c => c.id === challengeId);

    if (!target) {
      await ctx.answerCbQuery('Цель не найдена');
      return;
    }

    let newStatus = 'completed';
    let feedback = '✅ Отлично! Засчитано!';

    if (target.today_status === 'pending') {
      newStatus = 'completed';
      feedback = '✅ Выполнено! Стрик растет! 🔥';
    } else if (target.today_status === 'completed') {
      newStatus = 'skipped';
      feedback = '❌ Отмечено как пропущено';
    } else if (target.today_status === 'skipped') {
      newStatus = 'completed';
      feedback = '✅ Снова отмечено как выполнено! 💪';
    }

    challengeService.recordDailyLog(challengeId, userId, todayStr, newStatus);

    await ctx.answerCbQuery(feedback);

    // Refresh keyboard
    const updatedChallenges = challengeService.getTodayChallengesWithStatus(userId, todayStr);
    const completed = updatedChallenges.filter(c => c.today_status === 'completed').length;
    const total = updatedChallenges.length;
    const formattedDate = dateUtils.formatDisplayDate(todayStr);

    const msg = `🗓 <b>Чек-ин за сегодня (${formattedDate}):</b>\n\n` +
      `Прогресс дня: <b>${completed}/${total}</b> выполнено.\n\n` +
      `<i>Нажимайте на кнопки целей ниже, чтобы переключать статус:</i>`;

    try {
      await ctx.editMessageText(msg, {
        parse_mode: 'HTML',
        ...keyboards.todayCheckinKeyboard(updatedChallenges)
      });
    } catch (e) {
      // Ignored if message text did not change
    }
  },

  async handleRefresh(ctx) {
    const userId = ctx.from.id;
    const todayStr = dateUtils.getTodayDateStr();
    const updatedChallenges = challengeService.getTodayChallengesWithStatus(userId, todayStr);
    const completed = updatedChallenges.filter(c => c.today_status === 'completed').length;
    const total = updatedChallenges.length;
    const formattedDate = dateUtils.formatDisplayDate(todayStr);

    const msg = `🗓 <b>Чек-ин за сегодня (${formattedDate}):</b>\n\n` +
      `Прогресс дня: <b>${completed}/${total}</b> выполнено.\n\n` +
      `<i>Нажимайте на кнопки целей ниже, чтобы переключать статус:</i>`;

    await ctx.answerCbQuery('🔄 Обновлено');
    try {
      await ctx.editMessageText(msg, {
        parse_mode: 'HTML',
        ...keyboards.todayCheckinKeyboard(updatedChallenges)
      });
    } catch (e) {}
  }
};
