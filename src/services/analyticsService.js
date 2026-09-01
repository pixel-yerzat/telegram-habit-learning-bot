import QuickChart from 'quickchart-js';
import axios from 'axios';
import { db } from '../db/database.js';
import { dateUtils } from '../utils/dateUtils.js';
import { knowledgeService } from './knowledgeService.js';

export const analyticsService = {
  // Generate weekly analysis and compute competency scores
  generateWeeklyAnalysis(userId, referenceDate = new Date()) {
    const weekKey = dateUtils.getCurrentWeekKey(referenceDate);
    const prevWeekKey = dateUtils.getPreviousWeekKey(referenceDate);
    const { startOfWeek, endOfWeek } = dateUtils.getWeekDateRange(referenceDate);

    // 1. Get all active challenges
    const monthKey = dateUtils.getCurrentMonthKey(referenceDate);
    const challenges = db.prepare(`
      SELECT * FROM challenges 
      WHERE user_id = ? AND month_key = ? AND status = 'active'
    `).all(userId, monthKey);

    // If no challenges in current month, get all challenges for user
    const userChallenges = challenges.length > 0 ? challenges : db.prepare(`
      SELECT * FROM challenges 
      WHERE user_id = ? AND status = 'active'
    `).all(userId);

    // 2. Fetch daily logs for the week
    const logs = db.prepare(`
      SELECT dl.*, c.category, c.title as challenge_title, c.type, c.target_days
      FROM daily_logs dl
      JOIN challenges c ON dl.challenge_id = c.id
      WHERE dl.user_id = ? AND dl.log_date >= ? AND dl.log_date <= ?
    `).all(userId, startOfWeek, endOfWeek);

    // 3. Fetch knowledge checks for the week
    const learningStats = knowledgeService.getWeeklyLearningStats(userId, startOfWeek, endOfWeek);

    // 4. Calculate habit completion rate
    const totalLogs = logs.length;
    const completedLogs = logs.filter(l => l.status === 'completed').length;
    const habitRate = totalLogs > 0 ? Math.round((completedLogs / (userChallenges.length * 7 || 7)) * 100) : 0;

    // 5. Calculate competency scores by category
    const competencyScores = {};
    const defaultCompetencies = ['Дисциплина', 'Фокус & Продуктивность'];

    // Group logs by category
    const categoryStats = {};
    for (const ch of userChallenges) {
      if (!categoryStats[ch.category]) {
        categoryStats[ch.category] = { target: ch.target_days, completed: 0, logsCount: 0 };
      }
    }

    for (const log of logs) {
      if (categoryStats[log.category]) {
        categoryStats[log.category].logsCount++;
        if (log.status === 'completed') {
          categoryStats[log.category].completed++;
        }
      }
    }

    // Compute score per challenge category (0-100)
    for (const [cat, data] of Object.entries(categoryStats)) {
      const targetDays = Math.max(1, data.target);
      const habitScore = Math.min(100, Math.round((data.completed / targetDays) * 100));

      // If there are knowledge checks for this category, blend them (50% habit consistency + 50% knowledge comprehension)
      if (learningStats.categoryScores[cat] !== undefined) {
        competencyScores[cat] = Math.round((habitScore * 0.5) + (learningStats.categoryScores[cat] * 0.5));
      } else {
        competencyScores[cat] = habitScore;
      }
    }

    // Add Discipline metric (overall consistency across all tasks)
    competencyScores['Дисциплина'] = Math.min(100, Math.max(10, Math.round(
      userChallenges.length > 0 ? (completedLogs / (userChallenges.length * 7)) * 100 : 50
    )));

    // Add Focus & Reflection metric
    competencyScores['Фокус & Продуктивность'] = Math.min(100, Math.max(15, Math.round(
      (competencyScores['Дисциплина'] * 0.6) + (learningStats.totalChecks > 0 ? 40 : 10)
    )));

    // Ensure we have at least 3 categories for nice Radar chart presentation
    if (Object.keys(competencyScores).length < 3) {
      competencyScores['Целеполагание'] = Math.min(100, 70 + (completedLogs > 3 ? 20 : 0));
    }

    // 6. Fetch previous checkpoint
    const prevCheckpoint = db.prepare(`
      SELECT * FROM weekly_checkpoints 
      WHERE user_id = ? AND week_key = ?
    `).get(userId, prevWeekKey);

    let prevScores = {};
    if (prevCheckpoint) {
      try {
        prevScores = JSON.parse(prevCheckpoint.competencies_json);
      } catch (e) {
        prevScores = {};
      }
    } else {
      // Baseline synthetic previous checkpoint for comparison if first week
      for (const [cat, score] of Object.entries(competencyScores)) {
        prevScores[cat] = Math.max(20, Math.round(score * 0.75));
      }
    }

    // 7. Calculate deltas and highlights
    const deltas = {};
    const strengths = [];
    const areasToImprove = [];

    for (const [cat, currentScore] of Object.entries(competencyScores)) {
      const prevScore = prevScores[cat] !== undefined ? prevScores[cat] : Math.max(20, Math.round(currentScore * 0.7));
      const delta = currentScore - prevScore;
      deltas[cat] = delta;

      if (currentScore >= 75) {
        strengths.push(`${cat} (${currentScore}%, ${delta >= 0 ? `+${delta}%` : `${delta}%`})`);
      } else if (currentScore < 60) {
        areasToImprove.push(`${cat} (${currentScore}%, ${delta >= 0 ? `+${delta}%` : `${delta}%`})`);
      }
    }

    // 8. Save or update current week checkpoint in DB
    const learningScore = learningStats.totalChecks > 0 ? (learningStats.avgComprehension * 10) : 50;
    const scoresJson = JSON.stringify(competencyScores);

    db.prepare(`
      INSERT INTO weekly_checkpoints (
        user_id, week_key, start_date, end_date, habit_rate, 
        learning_score, competencies_json, strengths, areas_to_improve
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, week_key) DO UPDATE SET
        habit_rate = excluded.habit_rate,
        learning_score = excluded.learning_score,
        competencies_json = excluded.competencies_json,
        strengths = excluded.strengths,
        areas_to_improve = excluded.areas_to_improve
    `).run(
      userId,
      weekKey,
      startOfWeek,
      endOfWeek,
      habitRate,
      learningScore,
      scoresJson,
      strengths.join(', '),
      areasToImprove.join(', ')
    );

    return {
      weekKey,
      prevWeekKey,
      startOfWeek,
      endOfWeek,
      habitRate,
      learningScore,
      competencyScores,
      prevScores,
      deltas,
      strengths,
      areasToImprove,
      totalCompletedLogs: completedLogs,
      totalChecks: learningStats.totalChecks,
      challengesCount: userChallenges.length
    };
  },

  // Build Radar Chart comparing Current Week vs Previous Week
  generateRadarChartUrl(analysisData) {
    const labels = Object.keys(analysisData.competencyScores);
    const currentData = labels.map(l => analysisData.competencyScores[l]);
    const previousData = labels.map(l => analysisData.prevScores[l] !== undefined ? analysisData.prevScores[l] : 30);

    const chart = new QuickChart();
    chart.setWidth(600);
    chart.setHeight(500);
    chart.setBackgroundColor('#1e1e2e'); // Dark theme

    chart.setConfig({
      type: 'radar',
      data: {
        labels: labels,
        datasets: [
          {
            label: `Предыдущий чекпоинт (${analysisData.prevWeekKey})`,
            data: previousData,
            borderColor: 'rgba(243, 139, 168, 0.85)',
            backgroundColor: 'rgba(243, 139, 168, 0.2)',
            borderWidth: 2,
            borderDash: [6, 4],
            pointBackgroundColor: 'rgba(243, 139, 168, 1)',
            pointRadius: 4
          },
          {
            label: `Текущая неделя (${analysisData.weekKey})`,
            data: currentData,
            borderColor: 'rgba(137, 180, 250, 1)',
            backgroundColor: 'rgba(137, 180, 250, 0.4)',
            borderWidth: 3,
            pointBackgroundColor: 'rgba(137, 180, 250, 1)',
            pointRadius: 5
          }
        ]
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: `📊 Радар компетенций: Прогресс ${analysisData.weekKey}`,
            color: '#cdd6f4',
            font: { size: 18, weight: 'bold' },
            padding: { top: 10, bottom: 20 }
          },
          legend: {
            position: 'bottom',
            labels: {
              color: '#cdd6f4',
              font: { size: 13 },
              padding: 15
            }
          }
        },
        scales: {
          r: {
            angleLines: { color: 'rgba(147, 153, 178, 0.3)' },
            grid: { color: 'rgba(147, 153, 178, 0.2)' },
            pointLabels: {
              color: '#f5e0dc',
              font: { size: 13, weight: 'bold' }
            },
            ticks: {
              display: true,
              stepSize: 20,
              min: 0,
              max: 100,
              color: '#a6adc8',
              backdropColor: 'transparent',
              font: { size: 10 }
            }
          }
        }
      }
    });

    return chart.getUrl();
  },

  // Get Chart as Image Buffer (for direct file upload)
  async getChartBuffer(analysisData) {
    const url = this.generateRadarChartUrl(analysisData);
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
      return Buffer.from(response.data);
    } catch (err) {
      console.error('Failed to download chart buffer from QuickChart:', err.message);
      return null;
    }
  },

  // Format Russian markdown text for weekly report
  formatWeeklyReportText(analysis) {
    let msg = `📊 <b>ЕЖЕНЕДЕЛЬНЫЙ АНАЛИЗ ПРОГРЕССА & КОМПЕТЕНЦИЙ</b>\n`;
    msg += `🗓 <b>Период:</b> ${dateUtils.formatDisplayDate(analysis.startOfWeek)} — ${dateUtils.formatDisplayDate(analysis.endOfWeek)} (Неделя ${analysis.weekKey})\n\n`;

    msg += `📈 <b>Ключевые показатели:</b>\n`;
    msg += `• <b>Выполнение привычек:</b> ${analysis.habitRate}% (выполнено действий: ${analysis.totalCompletedLogs})\n`;
    msg += `• <b>Усвоение знаний & курсов:</b> ${analysis.learningScore} / 100 (проверок: ${analysis.totalChecks})\n\n`;

    msg += `🎯 <b>Динамика навыков (к прошлому чекпоинту):</b>\n`;
    for (const [cat, score] of Object.entries(analysis.competencyScores)) {
      const delta = analysis.deltas[cat] || 0;
      const deltaSign = delta > 0 ? `🟢 +${delta}%` : (delta < 0 ? `🔴 ${delta}%` : `⚪ 0%`);
      const progressBar = this.renderProgressBar(score);
      msg += `<b>${cat}:</b> ${score}%\n${progressBar} ${deltaSign}\n`;
    }

    if (analysis.strengths.length > 0) {
      msg += `\n💪 <b>Сильные стороны недели:</b>\n`;
      analysis.strengths.forEach(s => { msg += `  ✦ ${s}\n`; });
    }

    if (analysis.areasToImprove.length > 0) {
      msg += `\n🎯 <b>Зоны роста на след. неделю:</b>\n`;
      analysis.areasToImprove.forEach(a => { msg += `  ✦ ${a}\n`; });
    } else {
      msg += `\n🔥 <b>Отличный темп!</b> Все отслеживаемые навыки находятся в зеленой зоне.\n`;
    }

    return msg;
  },

  renderProgressBar(percent) {
    const totalBars = 10;
    const filledBars = Math.round((Math.max(0, Math.min(100, percent)) / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
  }
};
