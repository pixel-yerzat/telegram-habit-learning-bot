import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/config.js';

let genAI = null;
if (config.geminiApiKey && config.geminiApiKey !== 'YOUR_GEMINI_API_KEY_HERE') {
  try {
    genAI = new GoogleGenerativeAI(config.geminiApiKey);
  } catch (e) {
    console.warn('⚠️ Failed to initialize GoogleGenerativeAI instance:', e.message);
  }
}

export const geminiService = {
  isAvailable() {
    return Boolean(
      config.geminiApiKey &&
      config.geminiApiKey !== 'YOUR_GEMINI_API_KEY_HERE' &&
      config.geminiApiKey.trim().length > 10
    );
  },

  getModel(modelName = 'gemini-2.5-flash') {
    if (!this.isAvailable()) return null;
    if (!genAI) {
      genAI = new GoogleGenerativeAI(config.geminiApiKey);
    }
    return genAI.getGenerativeModel({ model: modelName });
  },

  // 1. Generate Multiple-Choice Quiz questions for a topic
  async generateQuiz(topic, category = 'Обучение', count = 3) {
    if (this.isAvailable()) {
      try {
        const model = this.getModel();
        const prompt = `Ты — профессиональный ИИ-экзаменатор и наставник.
Пользователь изучает тему: «${topic}» (Категория: ${category}).

Создай тест из ${count} качественных, практических вопросов для проверки усвоения материала и закрепления знаний.
Вопросы должны проверять реальное понимание и концепции, а не просто сухую теорию.

ВЕРНИ ОТВЕТ СТРОГО В ВИДЕ ВАЛИДНОГО JSON-ОБЪЕКТА без лишнего markdown и текста вокруг:
{
  "topic": "${topic}",
  "questions": [
    {
      "id": 1,
      "question": "Текст вопроса...",
      "options": [
        "A) Первый вариант",
        "B) Второй вариант",
        "C) Третий вариант",
        "D) Четвертый вариант"
      ],
      "correctOptionIndex": 0,
      "explanation": "Краткое понятное объяснение, почему именно этот ответ правильный и в чем суть."
    }
  ]
}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            return parsed;
          }
        }
      } catch (err) {
        console.error('Gemini generateQuiz error, using smart fallback:', err.message);
      }
    }

    // Fallback Quiz if Gemini is offline / API key not set
    return this.getFallbackQuiz(topic, category, count);
  },

  // 2. Evaluate Open Response / Feynman explanation
  async evaluateOpenResponse(topic, questionOrPrompt, userAnswer) {
    if (this.isAvailable()) {
      try {
        const model = this.getModel();
        const prompt = `Ты — внимательный ИИ-наставник и эксперт в теме «${topic}».
Вопрос/Задание для проверки: «${questionOrPrompt}»
Ответ учащегося: «${userAnswer}»

Оцени глубину понимания и усвоение материала по шкале от 1 до 10.
Дай конструктивную, мотивирующую обратную связь:
- Что отвечено верно и точно
- Какие ключевые нюансы или ошибки стоит учесть
- Краткий вывод/совет

ВЕРНИ ОТВЕТ СТРОГО В ВИДЕ JSON:
{
  "score": 8,
  "feedback": "Текст обратной связи (2-4 предложения с эмодзи)...",
  "verdict": "Отлично / Хорошо / Требует повторения"
}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (err) {
        console.error('Gemini evaluateOpenResponse error, using heuristic:', err.message);
      }
    }

    // Heuristic fallback
    const wordCount = (userAnswer || '').trim().split(/\s+/).length;
    let score = 7;
    if (wordCount > 30) score = 9;
    else if (wordCount > 15) score = 8;
    else if (wordCount < 5) score = 5;

    return {
      score,
      feedback: `Отличная работа по закреплению темы «${topic}»! Вы сформулировали ключевые мысли и зафиксировали прогресс в обучении.`,
      verdict: score >= 8 ? 'Отлично' : 'Хорошо'
    };
  },

  // Fallback interactive questions
  getFallbackQuiz(topic, category, count = 3) {
    return {
      topic,
      questions: [
        {
          id: 1,
          question: `Какова главная цель и назначение концепции «${topic}»?`,
          options: [
            `A) Оптимизация и повышение эффективности работы`,
            `B) Исключительно теоретическое описание без практики`,
            `C) Замена базовых механизмов системы`,
            `D) Временное решение для устаревших методов`
          ],
          correctOptionIndex: 0,
          explanation: `Основная цель «${topic}» — структурирование знаний, повышение продуктивности и решение прикладных задач.`
        },
        {
          id: 2,
          question: `Что является лучшей практикой при применении «${topic}»?`,
          options: [
            `A) Применять на реальных задачах и закреплять регулярными повторениями`,
            `B) Изучать только теорию без практических упражнений`,
            `C) Игнорировать ошибки и продолжать без анализа`,
            `D) Заучивать наизусть без понимания сути`
          ],
          correctOptionIndex: 0,
          explanation: `Активное вспоминание, практика на реальных кейсах и анализ ошибок дают максимальный результат.`
        },
        {
          id: 3,
          question: `Какой подход к теме «${topic}» помогает быстрее всего выйти на профессиональный уровень?`,
          options: [
            `A) Метод Фейнмана: умение объяснить суть темы простыми словами`,
            `B) Чтение материала один раз в спешке`,
            `C) Откладывание повторения на месяц`,
            `D) Избегание самопроверок и тестов`
          ],
          correctOptionIndex: 0,
          explanation: `Метод Фейнмана позволяет выявить скрытые пробелы в понимании и прочно усвоить фундаментальные принципы.`
        }
      ].slice(0, count)
    };
  }
};
