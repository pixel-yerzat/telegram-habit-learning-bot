import { Scenes, Markup } from 'telegraf';
import { userService } from '../../services/userService.js';
import { keyboards } from '../keyboards.js';

export const settingsScene = new Scenes.WizardScene(
  'SETTINGS_SCENE',

  // Step 1: Show settings options
  async (ctx) => {
    const user = userService.getUser(ctx.from.id);
    const msg = `⚙️ <b>Настройки профиля & Напоминаний</b>\n\n` +
      `🌅 <b>Утренний фокус:</b> ${user.reminder_morning}\n` +
      `🌙 <b>Вечерний чек-ин:</b> ${user.reminder_evening}\n` +
      `🌐 <b>Часовой пояс:</b> UTC ${user.timezone}\n` +
      `🔔 <b>Статус уведомлений:</b> ${user.is_active ? 'Включены' : 'Выключены'}\n\n` +
      `<i>Выберите параметр для изменения:</i>`;

    await ctx.reply(msg, {
      parse_mode: 'HTML',
      ...keyboards.settingsKeyboard(user)
    });
    return ctx.wizard.next();
  },

  // Step 2: Handle selection
  async (ctx) => {
    if (!ctx.callbackQuery) {
      if (ctx.message?.text?.startsWith('/cancel')) {
        await ctx.reply('Настройки закрыты.', keyboards.mainMenu());
        return ctx.scene.leave();
      }
      return;
    }

    await ctx.answerCbQuery();
    const action = ctx.callbackQuery.data;

    if (action === 'toggle_notifications') {
      const user = userService.getUser(ctx.from.id);
      userService.updateSettings(ctx.from.id, { is_active: !user.is_active });
      const updated = userService.getUser(ctx.from.id);
      await ctx.editMessageText(
        `🔔 Уведомления теперь <b>${updated.is_active ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}</b>.`,
        { parse_mode: 'HTML', ...keyboards.settingsKeyboard(updated) }
      );
      return;
    }

    if (action === 'set_time_morning') {
      ctx.wizard.state.settingField = 'reminder_morning';
      await ctx.reply(
        '🌅 <b>Введите время утреннего напоминания в формате ЧЧ:ММ</b> (например <code>08:30</code>):',
        { parse_mode: 'HTML' }
      );
      return ctx.wizard.next();
    }

    if (action === 'set_time_evening') {
      ctx.wizard.state.settingField = 'reminder_evening';
      await ctx.reply(
        '🌙 <b>Введите время вечернего чек-ина в формате ЧЧ:ММ</b> (например <code>21:00</code>):',
        { parse_mode: 'HTML' }
      );
      return ctx.wizard.next();
    }

    if (action === 'set_timezone') {
      ctx.wizard.state.settingField = 'timezone';
      await ctx.reply(
        '🌐 <b>Введите ваш часовой пояс со знаком + или -</b> (например <code>+05:00</code> или <code>+03:00</code>):',
        { parse_mode: 'HTML' }
      );
      return ctx.wizard.next();
    }
  },

  // Step 3: Handle value input
  async (ctx) => {
    if (!ctx.message?.text) {
      await ctx.reply('Пожалуйста, отправьте текстовое значение:');
      return;
    }

    const val = ctx.message.text.trim();
    const field = ctx.wizard.state.settingField;

    if (field === 'reminder_morning' || field === 'reminder_evening') {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(val)) {
        await ctx.reply('⚠️ Неверный формат времени. Пожалуйста, используйте формат ЧЧ:ММ (например, 09:00):');
        return;
      }
      userService.updateSettings(ctx.from.id, { [field]: val });
      await ctx.reply(`✅ Время напоминания успешно обновлено на <b>${val}</b>!`, {
        parse_mode: 'HTML',
        ...keyboards.mainMenu()
      });
      return ctx.scene.leave();
    }

    if (field === 'timezone') {
      const tzRegex = /^([+-])(0\d|1[0-4]):([0-5]\d)$/;
      if (!tzRegex.test(val)) {
        await ctx.reply('⚠️ Неверный формат часового пояса. Используйте формат +05:00 или +03:00:');
        return;
      }
      userService.updateSettings(ctx.from.id, { timezone: val });
      await ctx.reply(`✅ Часовой пояс успешно обновлен на <b>UTC ${val}</b>!`, {
        parse_mode: 'HTML',
        ...keyboards.mainMenu()
      });
      return ctx.scene.leave();
    }
  }
);
