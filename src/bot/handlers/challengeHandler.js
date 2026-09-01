import { Markup } from 'telegraf';
import { challengeService } from '../../services/challengeService.js';
import { keyboards } from '../keyboards.js';
import { dateUtils } from '../../utils/dateUtils.js';

export const challengeHandler = {
  async handleListChallenges(ctx) {
    const userId = ctx.from.id;
    const currentMonth = dateUtils.getCurrentMonthKey();
    const stats = challengeService.getMonthlyStats(userId, currentMonth);

    if (stats.challengeSummaries.length === 0) {
      const emptyMsg = `📋 <b>Челленджи на ${stats.monthName}:</b>\n\n` +
        `У вас пока нет активных целей на этот месяц.\n\n` +
        `<i>Добавьте 1–5 челленджей (привычки, курсы, чтение, спорт), чтобы начать трекинг!</i>`;

      return ctx.reply(emptyMsg, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Добавить цель', 'start_add_challenge')]
        ])
      });
    }

    let msg = `🎯 <b>ФОКУС-ЧЕЛЛЕНДЖИ НА ${stats.monthName.toUpperCase()}:</b>\n\n`;

    stats.challengeSummaries.forEach((ch, idx) => {
      const typeIcon = ch.type === 'learning' ? '🧠 [Обучение]' : (ch.type === 'skill' ? '⚡ [Навык]' : '🔥 [Привычка]');
      msg += `<b>${idx + 1}. ${ch.title}</b>\n`;
      msg += `   └ ${typeIcon} • <i>${ch.category}</i>\n`;
      msg += `   └ Регулярность: ${ch.target_days} дн./нед. | Стрик: <b>${ch.streak} дн.</b> 🔥\n`;
      msg += `   └ Выполнено в этом месяце: <b>${ch.completed_count} раз</b>\n\n`;
    });

    const buttons = [
      [Markup.button.callback('➕ Добавить еще цель', 'start_add_challenge')],
      [Markup.button.callback('🗑 Управление целями', 'manage_challenges_menu')],
      [Markup.button.callback('✅ Отметить сегодня', 'open_today_checkin')]
    ];

    await ctx.reply(msg, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    });
  },

  async handleManageMenu(ctx) {
    const userId = ctx.from.id;
    const challenges = challengeService.getUserActiveChallenges(userId);

    if (challenges.length === 0) {
      return ctx.reply('Нет активных целей для управления.', keyboards.mainMenu());
    }

    const buttons = challenges.map(ch => [
      Markup.button.callback(`🗑 Удалить: ${ch.title.substring(0, 22)}`, `delete_ch_${ch.id}`)
    ]);
    buttons.push([Markup.button.callback('◀️ Назад', 'view_challenges')]);

    await ctx.reply('🗑 <b>Выберите цель, которую хотите удалить:</b>', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    });
  },

  async handleDeleteChallenge(ctx, challengeId) {
    const userId = ctx.from.id;
    const ch = challengeService.getChallengeById(challengeId);
    if (!ch || ch.user_id !== userId) {
      await ctx.answerCbQuery('Цель не найдена.');
      return;
    }

    challengeService.deleteChallenge(challengeId, userId);
    await ctx.answerCbQuery(`Цель «${ch.title}» удалена!`);
    await ctx.reply(`🗑 Цель <b>«${ch.title}»</b> была удалена.`, { parse_mode: 'HTML' });
    await this.handleListChallenges(ctx);
  }
};
