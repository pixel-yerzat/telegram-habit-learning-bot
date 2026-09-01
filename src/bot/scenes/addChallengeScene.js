import { Scenes, Markup } from 'telegraf';
import { challengeService } from '../../services/challengeService.js';
import { keyboards } from '../keyboards.js';
import { dateUtils } from '../../utils/dateUtils.js';
import { parseGoalsFromText } from '../../utils/goalParser.js';

export const addChallengeScene = new Scenes.WizardScene(
  'ADD_CHALLENGE_SCENE',

  // Step 1: Prompt user with instructions for single or multi-line batch goal input
  async (ctx) => {
    ctx.wizard.state.challengeData = {};
    const monthName = dateUtils.getMonthNameRu(dateUtils.getCurrentMonthKey());

    const promptText = `🎯 <b>Добавление целей на ${monthName}</b>\n\n` +
      `Вы можете отправить <b>все цели сразу одним сообщением</b> (списком) или одну цель!\n\n` +
      `📝 <b>Пример сообщения со списком целей:</b>\n` +
      `<code>1. Курс по Node.js и базам данных\n` +
      `2. Утренняя зарядка 20 мин\n` +
      `3. 15 минут чтения на английском\n` +
      `4. Читать книгу по системному дизайну\n` +
      `5. Пить 2 литра воды</code>\n\n` +
      `💡 <i>Бот автоматически определит тип (привычка / обучение) и сферу компетенций. Вы также можете явно указать параметры через черту:</i>\n` +
      `<code>Курс по React | Обучение | Программирование | 5 дн</code>\n\n` +
      `👇 <b>Отправьте ваше сообщение со списком целей:</b>`;

    await ctx.reply(promptText, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'cancel_scene')]
      ])
    });
    return ctx.wizard.next();
  },

  // Step 2: Parse message (single or batch)
  async (ctx) => {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
      if (ctx.callbackQuery.data === 'cancel_scene') {
        await ctx.reply('❌ Добавление целей отменено.', keyboards.mainMenu());
        return ctx.scene.leave();
      }
    }

    if (ctx.message?.text?.startsWith('/cancel')) {
      await ctx.reply('❌ Добавление целей отменено.', keyboards.mainMenu());
      return ctx.scene.leave();
    }

    const text = ctx.message?.text;
    if (!text) {
      await ctx.reply('Пожалуйста, отправьте текстовый список целей:');
      return;
    }

    const parsedGoals = parseGoalsFromText(text);

    if (parsedGoals.length === 0) {
      await ctx.reply('⚠️ Не удалось распознать цели в сообщении. Пожалуйста, напишите хотя бы одно название цели:');
      return;
    }

    ctx.wizard.state.parsedGoals = parsedGoals;

    // If multiple goals (or even 1 goal in bulk format), show preview and confirm button
    let previewMsg = `📋 <b>Распознано целей: ${parsedGoals.length}</b>\n\n`;

    parsedGoals.forEach((g, idx) => {
      const typeIcon = g.type === 'learning' ? '🧠 [Обучение]' : (g.type === 'skill' ? '⚡ [Навык]' : '🔥 [Привычка]');
      previewMsg += `<b>${idx + 1}. ${g.title}</b>\n`;
      previewMsg += `   └ ${typeIcon} • <i>${g.category}</i> • ${g.targetDays} дн./нед.\n\n`;
    });

    previewMsg += `<i>Сохранить все цели на текущий месяц?</i>`;

    await ctx.reply(previewMsg, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(`✅ Сохранить все цели (${parsedGoals.length})`, 'confirm_save_bulk')],
        [Markup.button.callback('✍️ Настроить одну цель пошагово', 'switch_step_by_step')],
        [Markup.button.callback('❌ Отмена', 'cancel_scene')]
      ])
    });

    return ctx.wizard.next();
  },

  // Step 3: Handle confirmation or switch to step-by-step
  async (ctx) => {
    if (!ctx.callbackQuery) {
      if (ctx.message?.text?.startsWith('/cancel')) {
        await ctx.reply('❌ Добавление целей отменено.', keyboards.mainMenu());
        return ctx.scene.leave();
      }
      return;
    }

    await ctx.answerCbQuery();
    const action = ctx.callbackQuery.data;

    if (action === 'cancel_scene') {
      await ctx.reply('❌ Добавление целей отменено.', keyboards.mainMenu());
      return ctx.scene.leave();
    }

    if (action === 'confirm_save_bulk') {
      const userId = ctx.from.id;
      const goals = ctx.wizard.state.parsedGoals || [];

      if (goals.length === 0) {
        await ctx.reply('⚠️ Список целей пуст.', keyboards.mainMenu());
        return ctx.scene.leave();
      }

      const createdList = challengeService.createMultipleChallenges(userId, goals);

      let successMsg = `🎉 <b>Успешно добавлено ${createdList.length} целей на этот месяц!</b>\n\n`;
      createdList.forEach((c, idx) => {
        const typeIcon = c.type === 'learning' ? '🧠' : (c.type === 'skill' ? '⚡' : '🔥');
        successMsg += `${idx + 1}. ${typeIcon} <b>${c.title}</b> (<i>${c.category}</i>, ${c.target_days} дн.)\n`;
      });

      successMsg += `\n<i>Бот будет ежедневно присылать чек-ин и строить еженедельный радар компетенций! 🚀</i>`;

      await ctx.reply(successMsg, {
        parse_mode: 'HTML',
        ...keyboards.mainMenu()
      });

      return ctx.scene.leave();
    }

    if (action === 'switch_step_by_step') {
      const firstGoal = ctx.wizard.state.parsedGoals?.[0];
      ctx.wizard.state.challengeData = {
        title: firstGoal ? firstGoal.title : ''
      };

      if (ctx.wizard.state.challengeData.title) {
        await ctx.reply(
          `📌 <b>Цель:</b> ${ctx.wizard.state.challengeData.title}\n\n` +
          `Выберите тип челленджа:`,
          {
            parse_mode: 'HTML',
            ...keyboards.typeKeyboard()
          }
        );
        ctx.wizard.selectStep(3); // Jump to step 4 in sequence
        return;
      } else {
        await ctx.reply('Напишите название цели сообщением:');
        ctx.wizard.selectStep(0);
        return;
      }
    }
  },

  // Step 4 (Step-by-step fallback): Handle Type selection, ask for Category
  async (ctx) => {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
      const data = ctx.callbackQuery.data;

      if (data === 'cancel_scene') {
        await ctx.reply('❌ Добавление цели отменено.', keyboards.mainMenu());
        return ctx.scene.leave();
      }

      if (data.startsWith('type_')) {
        ctx.wizard.state.challengeData.type = data.replace('type_', '');
      }
    } else if (ctx.message?.text?.startsWith('/cancel')) {
      await ctx.reply('❌ Добавление цели отменено.', keyboards.mainMenu());
      return ctx.scene.leave();
    } else {
      ctx.wizard.state.challengeData.type = 'habit';
    }

    await ctx.reply(
      `🏷 <b>Выберите сферу / компетенцию:</b>`,
      {
        parse_mode: 'HTML',
        ...keyboards.categoryKeyboard()
      }
    );
    return ctx.wizard.next();
  },

  // Step 5 (Step-by-step fallback): Handle Category selection, ask for Frequency
  async (ctx) => {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
      const data = ctx.callbackQuery.data;

      if (data === 'cancel_scene') {
        await ctx.reply('❌ Добавление цели отменено.', keyboards.mainMenu());
        return ctx.scene.leave();
      }

      if (data.startsWith('cat_')) {
        const cat = data.replace('cat_', '');
        if (cat === 'custom') {
          await ctx.reply('✍️ Введите название вашей компетенции/категории вручную:', { parse_mode: 'HTML' });
          ctx.wizard.state.waitingCustomCategory = true;
          return;
        }
        ctx.wizard.state.challengeData.category = cat;
      }
    } else if (ctx.message?.text) {
      if (ctx.message.text.startsWith('/cancel')) {
        await ctx.reply('❌ Добавление цели отменено.', keyboards.mainMenu());
        return ctx.scene.leave();
      }
      if (ctx.wizard.state.waitingCustomCategory) {
        ctx.wizard.state.challengeData.category = ctx.message.text.trim();
        ctx.wizard.state.waitingCustomCategory = false;
      }
    }

    if (!ctx.wizard.state.challengeData.category) {
      await ctx.reply('Пожалуйста, выберите категорию из кнопок или введите текстом:');
      return;
    }

    await ctx.reply(
      `🎯 <b>Регулярность:</b> Сколько дней в неделю вы планируете выполнять эту цель?`,
      {
        parse_mode: 'HTML',
        ...keyboards.targetDaysKeyboard()
      }
    );
    return ctx.wizard.next();
  },

  // Step 6 (Step-by-step fallback): Save frequency and create single challenge in DB
  async (ctx) => {
    let targetDays = 7;
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
      const data = ctx.callbackQuery.data;
      if (data === 'cancel_scene') {
        await ctx.reply('❌ Добавление цели отменено.', keyboards.mainMenu());
        return ctx.scene.leave();
      }
      if (data.startsWith('days_')) {
        targetDays = parseInt(data.replace('days_', ''), 10);
      }
    }

    const { title, type, category } = ctx.wizard.state.challengeData;
    const userId = ctx.from.id;

    const created = challengeService.createChallenge(userId, {
      title,
      type: type || 'habit',
      category: category || 'Общее',
      targetDays
    });

    const typeName = type === 'learning' ? '🧠 Обучение/Курс' : (type === 'skill' ? '⚡ Проект/Навык' : '🔥 Привычка');

    await ctx.reply(
      `🎉 <b>Цель успешно добавлена на этот месяц!</b>\n\n` +
      `📌 <b>Название:</b> ${created.title}\n` +
      `📂 <b>Тип:</b> ${typeName}\n` +
      `🏷 <b>Компетенция:</b> ${created.category}\n` +
      `🗓 <b>Регулярность:</b> ${created.target_days} дн./нед.\n\n` +
      `<i>Бот будет ежедневно напоминать о выполнении и включать прогресс в еженедельный радар компетенций!</i>`,
      {
        parse_mode: 'HTML',
        ...keyboards.mainMenu()
      }
    );

    return ctx.scene.leave();
  }
);
