import { db } from '../db/database.js';
import { dateUtils } from '../utils/dateUtils.js';

export const knowledgeService = {
  // Add a knowledge check / learning reflection
  recordKnowledgeCheck(userId, challengeId, {
    topic,
    keyTakeaways,
    quizQuestion = null,
    userAnswer = null,
    comprehensionScore = 8,
    confidenceScore = 5,
    checkDate = null
  }) {
    const date = checkDate || dateUtils.getTodayDateStr();

    const result = db.prepare(`
      INSERT INTO knowledge_checks (
        challenge_id, user_id, check_date, topic, key_takeaways, 
        quiz_question, user_answer, comprehension_score, confidence_score
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      challengeId,
      userId,
      date,
      topic.trim(),
      keyTakeaways.trim(),
      quizQuestion ? quizQuestion.trim() : null,
      userAnswer ? userAnswer.trim() : null,
      Math.min(10, Math.max(1, comprehensionScore)),
      Math.min(5, Math.max(1, confidenceScore))
    );

    return db.prepare('SELECT * FROM knowledge_checks WHERE id = ?').get(result.lastInsertRowid);
  },

  // Get learning/skill challenges for user
  getLearningChallenges(userId, monthKey = null) {
    const month = monthKey || dateUtils.getCurrentMonthKey();
    return db.prepare(`
      SELECT * FROM challenges 
      WHERE user_id = ? AND month_key = ? AND type IN ('learning', 'skill') AND status = 'active'
    `).all(userId, month);
  },

  // Get recent knowledge checks
  getRecentChecks(userId, limit = 10) {
    return db.prepare(`
      SELECT kc.*, c.title as challenge_title, c.category 
      FROM knowledge_checks kc
      JOIN challenges c ON kc.challenge_id = c.id
      WHERE kc.user_id = ?
      ORDER BY kc.id DESC
      LIMIT ?
    `).all(userId, limit);
  },

  // Generate reflective questions for active recall
  generateRecallPrompts(topic = '') {
    const prompts = [
      `🎯 **Метод Фейнмана:** Объясни тему «${topic || 'изученный материал'}» своими словами так, как будто рассказываешь 10-летнему ребенку или новичку.`,
      `💡 **Практическое применение:** Как именно ты применишь знания по теме «${topic || 'изученный материал'}» в ближайшем проекте или на практике?`,
      `🔍 **Ключевые принципы:** Назови 3 главных инсайта/правила из темы «${topic || 'изученный материал'}», без которых система не работает.`,
      `⚠️ **Ошибки и подводные камни:** С какими типичными ошибками сталкиваются при изучении/использовании темы «${topic || 'изученный материал'}» и как их избежать?`
    ];

    const randomIndex = Math.floor(Math.random() * prompts.length);
    return prompts[randomIndex];
  },

  // Get stats for weekly competency evaluation
  getWeeklyLearningStats(userId, startDate, endDate) {
    const checks = db.prepare(`
      SELECT kc.*, c.category, c.title as challenge_title
      FROM knowledge_checks kc
      JOIN challenges c ON kc.challenge_id = c.id
      WHERE kc.user_id = ? AND kc.check_date >= ? AND kc.check_date <= ?
    `).all(userId, startDate, endDate);

    const totalChecks = checks.length;
    if (totalChecks === 0) {
      return { totalChecks: 0, avgComprehension: 0, categoryScores: {} };
    }

    let totalScore = 0;
    const categoryMap = {};

    checks.forEach(chk => {
      totalScore += chk.comprehension_score;
      if (!categoryMap[chk.category]) {
        categoryMap[chk.category] = { total: 0, count: 0 };
      }
      categoryMap[chk.category].total += chk.comprehension_score * 10; // normalize to 100
      categoryMap[chk.category].count += 1;
    });

    const categoryScores = {};
    for (const [cat, data] of Object.entries(categoryMap)) {
      categoryScores[cat] = Math.round(data.total / data.count);
    }

    return {
      totalChecks,
      avgComprehension: Math.round((totalScore / totalChecks) * 10) / 10,
      categoryScores,
      checks
    };
  }
};
