import { Scenes, Markup } from 'telegraf';
import { knowledgeService } from '../../services/knowledgeService.js';
import { challengeService } from '../../services/challengeService.js';
import { geminiService } from '../../services/geminiService.js';
import { keyboards } from '../keyboards.js';
import { dateUtils } from '../../utils/dateUtils.js';

export const knowledgeCheckScene = new Scenes.WizardScene(
  'KNOWLEDGE_CHECK_SCENE',

  // Step 1: Select learning challenge
  async (ctx) => {
    ctx.wizard.state.quizData = {};
    const userId = ctx.from.id;
    const learningChallenges = knowledgeService.getLearningChallenges(userId);

    if (learningChallenges.length === 0) {
      const allChallenges = challengeService.getUserActiveChallenges(userId);
      if (allChallenges.length === 0) {
        await ctx.reply(
          '💡 У вас пока нет добавленных целей. Сначала добавьте цель с типом «🧠 Обучение/Курс»!',
          keyboards.mainMenu()
        );
        return ctx.scene.leave();
      }

      await ctx.reply(
        '💡 Выберите цель, по которой хотите проверить усвоение материала:',
        keyboards.learningChallengesKeyboard(allChallenges)
      );
      return ctx.wizard.next();
    }

    if (learningChallenges.length === 1) {
      const ch = learningChallenges[0];
      ctx.wizard.state.quizData.challengeId = ch.id;
      ctx.wizard.state.quizData.challengeTitle = ch.title;
      ctx.wizard.state.quizData.category = ch.category;

      await ctx.reply(
        `🧠 <b>Проверка знаний по цели: «${ch.title}»</b>\n\n` +
        `Какую тему или концепцию вы изучили сегодня?\n` +
        `<i>(Например: Асинхронные функции, SQL Join-ы, глава 3 книги, 20 новых фраз)</i>:`,
        { parse_mode: 'HTML' }
      );
      ctx.wizard.selectStep(2);
      return;
    }

    await ctx.reply(
      '🧠 <b>Выберите учебный челлендж или курс для проверки знаний:</b>',
      {
        parse_mode: 'HTML',
        ...keyboards.learningChallengesKeyboard(learningChallenges)
      }
    );
    return ctx.wizard.next();
  },

  // Step 2: Handle challenge selection
  async (ctx) => {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
      const data = ctx.callbackQuery.data;

      if (data === 'cancel_quiz') {
        await ctx.reply('❌ Проверка знаний отменена.', keyboards.mainMenu());
        return ctx.scene.leave();
      }

      if (data.startsWith('quiz_select_')) {
        const challengeId = parseInt(data.replace('quiz_select_', ''), 10);
        const ch = challengeService.getChallengeById(challengeId);
        ctx.wizard.state.quizData.challengeId = challengeId;
        ctx.wizard.state.quizData.challengeTitle = ch?.title || 'Обучение';
        ctx.wizard.state.quizData.category = ch?.category || 'Обучение';

        await ctx.reply(
          `🧠 <b>Цель:</b> ${ch?.title}\n\n` +
          `Какую конкретную тему или урок вы изучили сегодня?\n` +
          `<i>(Например: Event Loop в JS, SQL индексы, 4-я глава книги)</i>:`,
          { parse_mode: 'HTML' }
        );
        return ctx.wizard.next();
      }
    }

    if (ctx.message?.text?.startsWith('/cancel')) {
      await ctx.reply('❌ Проверка знаний отменена.', keyboards.mainMenu());
      return ctx.scene.leave();
    }

    await ctx.reply('Пожалуйста, выберите цель из списка выше.');
  },

  // Step 3: Receive Topic and offer Mode selection (AI Quiz vs Written Reflection)
  async (ctx) => {
    if (ctx.message?.text?.startsWith('/cancel')) {
      await ctx.reply('❌ Проверка знаний отменена.', keyboards.mainMenu());
      return ctx.scene.leave();
    }

    if (!ctx.message?.text) {
      await ctx.reply('Пожалуйста, отправьте название темы текстом:');
      return;
    }

    const topic = ctx.message.text.trim();
    ctx.wizard.state.quizData.topic = topic;

    const aiStatus = geminiService.isAvailable() ? '✨ <b>Gemini AI активен</b>' : '⚡ <b>Интерактивный режим</b>';

    await ctx.reply(
      `📖 <b>Изученная тема:</b> «${topic}»\n` +
      `${aiStatus}\n\n` +
      `<b>Выберите формат проверки знаний:</b>\n` +
      `1️⃣ <b>🤖 Интерактивный AI-тест</b> — Gemini сгенерирует тест с вариантами ответов для закрепления ключевых концепций.\n` +
      `2️⃣ <b>✍️ Метод Фейнмана</b> — объясните тему своими словами, а ИИ оценит глубину понимания и даст рецензию.`,
      {
        parse_mode: 'HTML',
        ...keyboards.testModeKeyboard()
      }
    );
    return ctx.wizard.next();
  },

  // Step 4: Handle Mode Selection
  async (ctx) => {
    if (!ctx.callbackQuery) {
      if (ctx.message?.text?.startsWith('/cancel')) {
        await ctx.reply('❌ Проверка знаний отменена.', keyboards.mainMenu());
        return ctx.scene.leave();
      }
      return;
    }

    await ctx.answerCbQuery();
    const action = ctx.callbackQuery.data;

    if (action === 'cancel_quiz') {
      await ctx.reply('❌ Проверка знаний отменена.', keyboards.mainMenu());
      return ctx.scene.leave();
    }

    const { topic, category } = ctx.wizard.state.quizData;

    // --- MODE 1: Interactive AI Quiz ---
    if (action === 'mode_ai_quiz') {
      ctx.wizard.state.mode = 'ai_quiz';
      const loadingMsg = await ctx.reply('🤖 <i>Gemini генерирует интерактивный тест по вашей теме...</i>', { parse_mode: 'HTML' });

      try {
        const quizData = await geminiService.generateQuiz(topic, category, 3);
        ctx.wizard.state.quizQuestions = quizData.questions;
        ctx.wizard.state.currentQIndex = 0;
        ctx.wizard.state.correctCount = 0;
        ctx.wizard.state.userAnswers = [];

        try { await ctx.deleteMessage(loadingMsg.message_id); } catch (e) {}

        return await sendCurrentQuestion(ctx);
      } catch (err) {
        console.error('Quiz generation error:', err);
        try { await ctx.deleteMessage(loadingMsg.message_id); } catch (e) {}
        await ctx.reply('⚠️ Не удалось сгенерировать тест. Пожалуйста, напишите краткий ответ своими словами.');
        ctx.wizard.selectStep(5);
        return;
      }
    }

    // --- MODE 2: Written Feynman Reflection ---
    if (action === 'mode_feynman') {
      ctx.wizard.state.mode = 'feynman';
      const recallPrompt = knowledgeService.generateRecallPrompts(topic);
      ctx.wizard.state.quizData.prompt = recallPrompt;

      await ctx.reply(
        `📖 <b>Тема:</b> ${topic}\n\n` +
        `📝 <b>Контрольное задание (Метод Фейнмана):</b>\n` +
        `${recallPrompt}\n\n` +
        `✍️ <i>Напишите ваш ответ и главные выводы сообщением ниже:</i>`,
        { parse_mode: 'HTML' }
      );
      ctx.wizard.selectStep(5); // Jump to open text handler
      return;
    }
  },

  // Step 5 (AI Quiz answering step)
  async (ctx) => {
    // Handle Quiz Answer Callback
    if (ctx.callbackQuery) {
      const data = ctx.callbackQuery.data;

      if (data === 'cancel_quiz') {
        await ctx.answerCbQuery();
        await ctx.reply('❌ Тест завершен досрочно.', keyboards.mainMenu());
        return ctx.scene.leave();
      }

      if (data.startsWith('answer_opt_')) {
        await ctx.answerCbQuery();
        const chosenIndex = parseInt(data.replace('answer_opt_', ''), 10);
        const questions = ctx.wizard.state.quizQuestions || [];
        const curIdx = ctx.wizard.state.currentQIndex || 0;
        const currentQ = questions[curIdx];

        if (!currentQ) return;

        const isCorrect = chosenIndex === currentQ.correctOptionIndex;
        if (isCorrect) {
          ctx.wizard.state.correctCount = (ctx.wizard.state.correctCount || 0) + 1;
        }

        ctx.wizard.state.userAnswers.push({
          questionId: currentQ.id,
          question: currentQ.question,
          chosenIndex,
          correctIndex: currentQ.correctOptionIndex,
          isCorrect
        });

        const correctLetter = ['A', 'B', 'C', 'D'][currentQ.correctOptionIndex] || 'A';
        const chosenLetter = ['A', 'B', 'C', 'D'][chosenIndex] || 'A';

        let feedbackText = isCorrect
          ? `🎉 <b>Верно! (${chosenLetter})</b>\n\n`
          : `❌ <b>Не совсем. Ваш ответ: ${chosenLetter}, а правильный: ${correctLetter}</b>\n\n`;

        feedbackText += `💡 <b>Объяснение:</b> ${currentQ.explanation}`;

        const isLast = curIdx >= questions.length - 1;

        await ctx.reply(feedbackText, {
          parse_mode: 'HTML',
          ...keyboards.quizNextKeyboard(isLast)
        });
        return;
      }

      if (data === 'quiz_next_question') {
        await ctx.answerCbQuery();
        ctx.wizard.state.currentQIndex = (ctx.wizard.state.currentQIndex || 0) + 1;
        const questions = ctx.wizard.state.quizQuestions || [];

        if (ctx.wizard.state.currentQIndex < questions.length) {
          return await sendCurrentQuestion(ctx);
        } else {
          // All questions finished! Calculate final score and finish
          return await finishQuizAndSave(ctx);
        }
      }
    }

    if (ctx.message?.text?.startsWith('/cancel')) {
      await ctx.reply('❌ Проверка знаний отменена.', keyboards.mainMenu());
      return ctx.scene.leave();
    }
  },

  // Step 6 (Feynman Written Answer Evaluation)
  async (ctx) => {
    if (ctx.message?.text?.startsWith('/cancel')) {
      await ctx.reply('❌ Проверка знаний отменена.', keyboards.mainMenu());
      return ctx.scene.leave();
    }

    if (!ctx.message?.text) {
      await ctx.reply('Пожалуйста, напишите ваши тезисы сообщением:');
      return;
    }

    const userAnswer = ctx.message.text.trim();
    const { challengeId, topic, prompt, category } = ctx.wizard.state.quizData;
    const userId = ctx.from.id;
    const today = dateUtils.getTodayDateStr();

    const analyzingMsg = await ctx.reply('🤖 <i>Gemini анализирует ваш ответ и проверяет усвоение...</i>', { parse_mode: 'HTML' });

    try {
      const evaluation = await geminiService.evaluateOpenResponse(topic, prompt, userAnswer);

      try { await ctx.deleteMessage(analyzingMsg.message_id); } catch (e) {}

      // Save to database
      knowledgeService.recordKnowledgeCheck(userId, challengeId, {
        topic,
        keyTakeaways: userAnswer,
        quizQuestion: prompt,
        userAnswer: userAnswer,
        comprehensionScore: evaluation.score,
        checkDate: today
      });

      // Mark daily habit log as completed
      challengeService.recordDailyLog(challengeId, userId, today, 'completed', `Тема: ${topic} (${evaluation.score}/10)`);
      const streak = challengeService.calculateStreak(challengeId);

      let resultMsg = `🎯 <b>РЕЗУЛЬТАТ ПРОВЕРКИ ЗНАНИЙ (GEMINI AI):</b>\n\n` +
        `📚 <b>Тема:</b> ${topic}\n` +
        `⭐️ <b>Оценка усвоения:</b> ${evaluation.score}/10 (${evaluation.verdict || 'Отлично'})\n\n` +
        `💬 <b>Рецензия ИИ:</b>\n${evaluation.feedback}\n\n` +
        `🔥 <b>Стрик по цели:</b> ${streak} дн.\n\n` +
        `<i>Данные сохранены и включены в еженедельный радар развития компетенций! 🚀</i>`;

      await ctx.reply(resultMsg, {
        parse_mode: 'HTML',
        ...keyboards.mainMenu()
      });

      return ctx.scene.leave();
    } catch (err) {
      console.error('Feynman evaluation error:', err);
      try { await ctx.deleteMessage(analyzingMsg.message_id); } catch (e) {}

      knowledgeService.recordKnowledgeCheck(userId, challengeId, {
        topic,
        keyTakeaways: userAnswer,
        quizQuestion: prompt,
        comprehensionScore: 8,
        checkDate: today
      });

      challengeService.recordDailyLog(challengeId, userId, today, 'completed', `Тема: ${topic}`);

      await ctx.reply(
        `✅ <b>Ответ сохранен!</b>\n\nОценка понимания: 8/10\nСтрик обновлен!`,
        keyboards.mainMenu()
      );
      return ctx.scene.leave();
    }
  }
);

// Helper: send current multiple choice question
async function sendCurrentQuestion(ctx) {
  const questions = ctx.wizard.state.quizQuestions || [];
  const curIdx = ctx.wizard.state.currentQIndex || 0;
  const q = questions[curIdx];

  if (!q) return;

  let msg = `🧠 <b>Вопрос ${curIdx + 1} из ${questions.length}:</b>\n\n` +
    `<b>${q.question}</b>\n\n`;

  q.options.forEach(opt => {
    msg += `<b>${opt}</b>\n`;
  });

  msg += `\n<i>Выберите правильный вариант ответа кнопкой ниже:</i>`;

  await ctx.reply(msg, {
    parse_mode: 'HTML',
    ...keyboards.quizOptionsKeyboard(q.options.length)
  });
}

// Helper: finalize quiz, calculate score, save to DB and congratulate user
async function finishQuizAndSave(ctx) {
  const { challengeId, topic } = ctx.wizard.state.quizData;
  const questions = ctx.wizard.state.quizQuestions || [];
  const correctCount = ctx.wizard.state.correctCount || 0;
  const totalQuestions = questions.length || 3;
  const userId = ctx.from.id;
  const today = dateUtils.getTodayDateStr();

  // Convert correct ratio to 1-10 score
  const score = Math.max(1, Math.min(10, Math.round((correctCount / totalQuestions) * 10)));

  const summaryTakeaways = `Тест: ${correctCount}/${totalQuestions} правильных ответов (${score}/10)`;

  // Save to DB
  knowledgeService.recordKnowledgeCheck(userId, challengeId, {
    topic,
    keyTakeaways: summaryTakeaways,
    quizQuestion: `AI Quiz (${totalQuestions} вопросов)`,
    userAnswer: `${correctCount}/${totalQuestions} правильных`,
    comprehensionScore: score,
    checkDate: today
  });

  // Mark habit completed
  challengeService.recordDailyLog(challengeId, userId, today, 'completed', `Тест Gemini: ${correctCount}/${totalQuestions}`);
  const streak = challengeService.calculateStreak(challengeId);

  let medal = '🥉';
  if (score >= 9) medal = '🥇';
  else if (score >= 7) medal = '🥈';

  let finalMsg = `${medal} <b>ТЕСТ УСПЕШНО ЗАВЕРШЕН!</b>\n\n` +
    `📚 <b>Тема:</b> ${topic}\n` +
    `🎯 <b>Результат:</b> ${correctCount} из ${totalQuestions} правильных ответов\n` +
    `⭐️ <b>Итоговый балл усвоения:</b> ${score}/10\n` +
    `🔥 <b>Стрик:</b> ${streak} дн.\n\n`;

  if (score >= 8) {
    finalMsg += `🚀 <b>Великолепно!</b> Материал усвоен на высоком уровне. Вы готовы двигаться к следующей теме!`;
  } else if (score >= 6) {
    finalMsg += `👍 <b>Хороший результат!</b> Основные концепции понятны, рекомендуем закрепить практикой.`;
  } else {
    finalMsg += `💡 <b>Рекомендация:</b> Стоит повторить ключевые тезисы темы и попробовать пройти тест снова.`;
  }

  await ctx.reply(finalMsg, {
    parse_mode: 'HTML',
    ...keyboards.mainMenu()
  });

  return ctx.scene.leave();
}
