import { userService } from '../../services/userService.js';
import { keyboards } from '../keyboards.js';
import { dateUtils } from '../../utils/dateUtils.js';

export const startHandler = {
  async handleStart(ctx) {
    const from = ctx.from;
    const user = userService.getOrCreateUser(from.id, from.username, from.first_name);
    const monthName = dateUtils.getMonthNameRu(dateUtils.getCurrentMonthKey());

    const welcomeMsg = `👋 <b>Привет, ${from.first_name || 'друг'}!</b>\n\n` +
      `Я твой персональный <b>Трекер Привычек, Обучения & Компетенций</b> 🚀\n\n` +
      `<b>Как устроена система:</b>\n` +
      `1️⃣ <b>В начале месяца</b> (${monthName}) вы задаете фокус-челленджи (привычки, курсы, книги, спорт).\n` +
      `2️⃣ <b>Каждый день</b> бот присылает утренний фокус и вечерний чек-ин привычек.\n` +
      `3️⃣ <b>Для обучения и курсов</b> доступна <i>Проверка знаний</i> (тестирование тезисов, методика Фейнмана, оценка глубины усвоения).\n` +
      `4️⃣ <b>В конце каждой недели</b> бот строит <b>Радар Компетенций</b> 📊 и сравнивает ваш рост с предыдущим чекпоинтом!\n\n` +
      `Нажмите кнопку ниже, чтобы начать!`;

    await ctx.reply(welcomeMsg, {
      parse_mode: 'HTML',
      ...keyboards.mainMenu()
    });
  },

  async handleHelp(ctx) {
    const helpMsg = `📖 <b>Справочник команд и возможностей бота:</b>\n\n` +
      `🎯 <b>/challenges</b> — Список ваших целей и прогресс за текущий месяц\n` +
      `➕ <b>/add</b> — Добавить новую цель или челлендж на месяц\n` +
      `✅ <b>/checkin</b> — Отметить выполнение привычек за сегодня\n` +
      `🧠 <b>/quiz</b> или <b>/review</b> — Проверка усвоения изученного материала\n` +
      `📊 <b>/weekly</b> или <b>/diagram</b> — Анализ компетенций и график прогресса\n` +
      `⚙️ <b>/settings</b> — Настройка времени напоминаний и часового пояса\n` +
      `ℹ️ <b>/help</b> — Это справочное сообщение\n\n` +
      `<i>Все действия также доступны через удобные кнопки меню!</i>`;

    await ctx.reply(helpMsg, {
      parse_mode: 'HTML',
      ...keyboards.mainMenu()
    });
  }
};
