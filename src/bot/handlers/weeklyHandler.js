import { Markup } from 'telegraf';
import { analyticsService } from '../../services/analyticsService.js';
import { keyboards } from '../keyboards.js';

export const weeklyHandler = {
  async handleWeeklyReport(ctx) {
    const userId = ctx.from.id;

    // Send a loading message because chart generation might take 1-2 seconds
    const loadingMsg = await ctx.reply('⏳ Формирую еженедельный анализ компетенций и строю радарную диаграмму...');

    try {
      const analysis = analyticsService.generateWeeklyAnalysis(userId);
      const reportText = analyticsService.formatWeeklyReportText(analysis);
      const chartUrl = analyticsService.generateRadarChartUrl(analysis);

      // Try sending with photo URL
      try {
        await ctx.replyWithPhoto(
          { url: chartUrl },
          {
            caption: reportText,
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔄 Обновить диаграмму', 'refresh_weekly_diagram')],
              [Markup.button.callback('🎯 Мои цели', 'view_challenges')]
            ])
          }
        );
      } catch (photoErr) {
        console.warn('Direct URL photo send failed, trying buffer download...', photoErr.message);
        const buffer = await analyticsService.getChartBuffer(analysis);
        if (buffer) {
          await ctx.replyWithPhoto(
            { source: buffer },
            {
              caption: reportText,
              parse_mode: 'HTML'
            }
          );
        } else {
          // Text-only fallback
          await ctx.reply(reportText, { parse_mode: 'HTML' });
        }
      }

      // Delete the loading message
      try {
        await ctx.deleteMessage(loadingMsg.message_id);
      } catch (e) {}

    } catch (err) {
      console.error('Error generating weekly report:', err);
      try {
        await ctx.deleteMessage(loadingMsg.message_id);
      } catch (e) {}
      await ctx.reply('⚠️ Произошла ошибка при формировании отчета. Пожалуйста, убедитесь, что у вас есть активные цели.', keyboards.mainMenu());
    }
  },

  async handleRefreshDiagram(ctx) {
    await ctx.answerCbQuery('🔄 Пересчитываю...');
    await this.handleWeeklyReport(ctx);
  }
};
