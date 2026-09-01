import { Markup } from 'telegraf';

export const keyboards = {
  // Main Reply Keyboard
  mainMenu() {
    return Markup.keyboard([
      ['✅ Отметить сегодня', '🎯 Челленджи месяца'],
      ['🧠 Проверка знаний', '📊 Анализ компетенций'],
      ['➕ Добавить цель', '⚙️ Настройки']
    ]).resize();
  },

  // Today's challenges inline keyboard with toggle buttons
  todayCheckinKeyboard(challenges) {
    const buttons = [];

    challenges.forEach(ch => {
      let icon = '⬜';
      if (ch.today_status === 'completed') icon = '✅';
      else if (ch.today_status === 'skipped') icon = '❌';

      const typeIcon = ch.type === 'learning' ? '🧠' : '🎯';
      const titleShort = ch.title.length > 20 ? ch.title.substring(0, 18) + '…' : ch.title;

      buttons.push([
        Markup.button.callback(
          `${icon} ${typeIcon} ${titleShort} (🔥${ch.streak})`,
          `toggle_${ch.id}`
        )
      ]);
    });

    buttons.push([
      Markup.button.callback('🔄 Обновить список', 'refresh_today'),
      Markup.button.callback('🧠 Сдать материал', 'open_quiz_menu')
    ]);

    return Markup.inlineKeyboard(buttons);
  },

  // Prompt for monthly intake
  monthlyIntakePrompt() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Настроить цели на месяц', 'start_add_challenge')],
      [Markup.button.callback('📋 Посмотреть текущие цели', 'view_challenges')]
    ]);
  },

  // Challenge Category Selection
  categoryKeyboard() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('💻 Программирование & IT', 'cat_Программирование'),
        Markup.button.callback('🇬🇧 Английский & Языки', 'cat_Английский')
      ],
      [
        Markup.button.callback('💪 Спорт & Здоровье', 'cat_Здоровье'),
        Markup.button.callback('📚 Чтение & Курсы', 'cat_Чтение')
      ],
      [
        Markup.button.callback('⚡ Продуктивность', 'cat_Продуктивность'),
        Markup.button.callback('🎯 Дисциплина', 'cat_Дисциплина')
      ],
      [
        Markup.button.callback('🎨 Творчество & Хобби', 'cat_Творчество'),
        Markup.button.callback('✍️ Своя категория', 'cat_custom')
      ],
      [Markup.button.callback('❌ Отмена', 'cancel_scene')]
    ]);
  },

  // Challenge Type Selection
  typeKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('🔥 Привычка / Трекер', 'type_habit')],
      [Markup.button.callback('🧠 Обучение / Курс / Книга', 'type_learning')],
      [Markup.button.callback('⚡ Проект / Навык', 'type_skill')],
      [Markup.button.callback('❌ Отмена', 'cancel_scene')]
    ]);
  },

  // Target frequency
  targetDaysKeyboard() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('Ежедневно (7 дн.)', 'days_7'),
        Markup.button.callback('5 дней в неделю', 'days_5')
      ],
      [
        Markup.button.callback('3 дня в неделю', 'days_3'),
        Markup.button.callback('2 дня в неделю', 'days_2')
      ],
      [Markup.button.callback('❌ Отмена', 'cancel_scene')]
    ]);
  },

  // Knowledge Comprehension Rating (1 to 10)
  knowledgeRatingKeyboard() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('1 😞', 'score_1'),
        Markup.button.callback('2', 'score_2'),
        Markup.button.callback('3', 'score_3'),
        Markup.button.callback('4', 'score_4'),
        Markup.button.callback('5 😐', 'score_5')
      ],
      [
        Markup.button.callback('6', 'score_6'),
        Markup.button.callback('7', 'score_7'),
        Markup.button.callback('8 🙂', 'score_8'),
        Markup.button.callback('9', 'score_9'),
        Markup.button.callback('10 🚀', 'score_10')
      ],
      [Markup.button.callback('❌ Пропустить оценку', 'score_skip')]
    ]);
  },

  // Settings menu
  settingsKeyboard(user) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(`🌅 Утро: ${user.reminder_morning}`, 'set_time_morning'),
        Markup.button.callback(`🌙 Вечер: ${user.reminder_evening}`, 'set_time_evening')
      ],
      [
        Markup.button.callback(`🌐 Часовой пояс: ${user.timezone}`, 'set_timezone')
      ],
      [
        Markup.button.callback(
          user.is_active ? '🔔 Уведомления: Вкл' : '🔕 Уведомления: Выкл',
          'toggle_notifications'
        )
      ]
    ]);
  },

  // List of learning challenges for quiz / review
  learningChallengesKeyboard(challenges) {
    const rows = challenges.map(ch => [
      Markup.button.callback(`🧠 ${ch.title} (${ch.category})`, `quiz_select_${ch.id}`)
    ]);
    rows.push([Markup.button.callback('❌ Назад', 'cancel_quiz')]);
    return Markup.inlineKeyboard(rows);
  },

  // Choose Knowledge Check Mode: Interactive AI Test vs Feynman Written Reflection
  testModeKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('🤖 Пройти интерактивный AI-тест', 'mode_ai_quiz')],
      [Markup.button.callback('✍️ Ответ своими словами (метод Фейнмана)', 'mode_feynman')],
      [Markup.button.callback('❌ Отмена', 'cancel_quiz')]
    ]);
  },

  // Interactive Quiz options (A, B, C, D)
  quizOptionsKeyboard(optionsCount = 4) {
    const letters = ['A', 'B', 'C', 'D'].slice(0, optionsCount);
    const row = letters.map((letter, idx) =>
      Markup.button.callback(`${letter}`, `answer_opt_${idx}`)
    );
    return Markup.inlineKeyboard([
      row,
      [Markup.button.callback('❌ Завершить тест', 'cancel_quiz')]
    ]);
  },

  // Next question button
  quizNextKeyboard(isLast = false) {
    return Markup.inlineKeyboard([
      [Markup.button.callback(isLast ? '🏁 Завершить тест и узнать результат' : '➡️ Следующий вопрос', 'quiz_next_question')]
    ]);
  }
};
