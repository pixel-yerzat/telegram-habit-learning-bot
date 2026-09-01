import { Markup } from 'telegraf';
import { knowledgeService } from '../../services/knowledgeService.js';
import { challengeService } from '../../services/challengeService.js';
import { keyboards } from '../keyboards.js';
import { dateUtils } from '../../utils/dateUtils.js';

export const quizHandler = {
  async handleQuizMenu(ctx) {
    const userId = ctx.from.id;
    const learningChallenges = knowledgeService.getLearningChallenges(userId);
    const recentChecks = knowledgeService.getRecentChecks(userId, 3);

    let msg = `🧠 <b>ПРОВЕРКА ЗНАНИЙ & УСВОЕНИЯ МАТЕРИАЛА</b>\n\n` +
      `Этот модуль помогает закреплять пройденный материал (курсы, книги, статьи) с помощью ` +
      `<b>активного вспоминания (Active Recall)</b> и метода Фейнмана.\n\n`;

    if (recentChecks.length > 0) {
      msg += `📚 <b>Недавние проверки:</b>\n`;
      recentChecks.forEach(chk => {
        msg += `• <b>${chk.topic}</b> (${chk.category}) — ${chk.comprehension_score}/10 (${dateUtils.formatDisplayDate(chk.check_date)})\n`;
      });
      msg += `\n`;
    }

    msg += `<i>Готовы зафиксировать изученную тему и проверить себя?</i>`;

    const buttons = [
      [Markup.button.callback('✍️ Проверить новый материал', 'start_knowledge_check')],
      [Markup.button.callback('📋 История проверок', 'view_knowledge_history')]
    ];

    await ctx.reply(msg, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    });
  },

  async handleHistory(ctx) {
    const userId = ctx.from.id;
    const checks = knowledgeService.getRecentChecks(userId, 8);

    if (checks.length === 0) {
      return ctx.reply('У вас пока нет сохраненных проверок знаний.', keyboards.mainMenu());
    }

    let msg = `📚 <b>ИСТОРИЯ ПРОВЕРОК ЗНАНИЙ:</b>\n\n`;
    checks.forEach((chk, idx) => {
      msg += `<b>${idx + 1}. ${chk.topic}</b> (${chk.category})\n`;
      msg += `   └ Дата: ${dateUtils.formatDisplayDate(chk.check_date)} | Оценка: <b>${chk.comprehension_score}/10</b>\n`;
      msg += `   └ Тезисы: <i>${chk.key_takeaways.substring(0, 80)}${chk.key_takeaways.length > 80 ? '…' : ''}</i>\n\n`;
    });

    await ctx.reply(msg, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✍️ Добавить новую проверку', 'start_knowledge_check')]
      ])
    });
  }
};
