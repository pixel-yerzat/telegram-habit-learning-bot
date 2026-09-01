import { db } from '../db/database.js';
import { dateUtils } from '../utils/dateUtils.js';

export const challengeService = {
  // Create new monthly challenge
  createChallenge(userId, { title, description = '', type = 'habit', category, targetDays = 7, monthKey = null }) {
    const month = monthKey || dateUtils.getCurrentMonthKey();
    const result = db.prepare(`
      INSERT INTO challenges (user_id, month_key, title, description, type, category, target_days, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(userId, month, title.trim(), description.trim(), type, category.trim(), targetDays);

    return this.getChallengeById(result.lastInsertRowid);
  },

  // Create multiple monthly challenges at once (in a single transaction)
  createMultipleChallenges(userId, goalsList, monthKey = null) {
    const month = monthKey || dateUtils.getCurrentMonthKey();
    const insertStmt = db.prepare(`
      INSERT INTO challenges (user_id, month_key, title, description, type, category, target_days, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `);

    const insertMany = db.transaction((goals) => {
      const createdIds = [];
      for (const g of goals) {
        const result = insertStmt.run(
          userId,
          month,
          g.title.trim(),
          (g.description || '').trim(),
          g.type || 'habit',
          (g.category || 'Общее').trim(),
          g.targetDays || 7
        );
        createdIds.push(result.lastInsertRowid);
      }
      return createdIds;
    });

    const ids = insertMany(goalsList);
    return ids.map(id => this.getChallengeById(id));
  },

  getChallengeById(challengeId) {
    return db.prepare('SELECT * FROM challenges WHERE id = ?').get(challengeId);
  },

  // Get active challenges for user for a specific month
  getUserActiveChallenges(userId, monthKey = null) {
    const month = monthKey || dateUtils.getCurrentMonthKey();
    return db.prepare(`
      SELECT * FROM challenges 
      WHERE user_id = ? AND month_key = ? AND status = 'active'
      ORDER BY id ASC
    `).all(userId, month);
  },

  // Get all challenges for user in a month (including completed/dropped)
  getAllUserChallenges(userId, monthKey = null) {
    const month = monthKey || dateUtils.getCurrentMonthKey();
    return db.prepare(`
      SELECT * FROM challenges 
      WHERE user_id = ? AND month_key = ?
      ORDER BY id ASC
    `).all(userId, month);
  },

  // Update status (e.g. drop or complete)
  updateChallengeStatus(challengeId, userId, status) {
    db.prepare(`
      UPDATE challenges
      SET status = ?
      WHERE id = ? AND user_id = ?
    `).run(status, challengeId, userId);
    return this.getChallengeById(challengeId);
  },

  // Delete challenge
  deleteChallenge(challengeId, userId) {
    const result = db.prepare(`
      DELETE FROM challenges
      WHERE id = ? AND user_id = ?
    `).run(challengeId, userId);
    return result.changes > 0;
  },

  // Record daily check-in (completed or skipped)
  recordDailyLog(challengeId, userId, logDate, status, note = null, rating = null) {
    const existing = db.prepare(`
      SELECT id FROM daily_logs 
      WHERE challenge_id = ? AND log_date = ?
    `).get(challengeId, logDate);

    if (existing) {
      db.prepare(`
        UPDATE daily_logs
        SET status = ?, note = COALESCE(?, note), rating = COALESCE(?, rating)
        WHERE id = ?
      `).run(status, note, rating, existing.id);
    } else {
      db.prepare(`
        INSERT INTO daily_logs (challenge_id, user_id, log_date, status, note, rating)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(challengeId, userId, logDate, status, note, rating);
    }

    return this.getTodayChallengesWithStatus(userId, logDate);
  },

  // Get challenges for today along with their check-in status
  getTodayChallengesWithStatus(userId, dateStr = null) {
    const targetDate = dateStr || dateUtils.getTodayDateStr();
    const monthKey = targetDate.substring(0, 7);

    const challenges = this.getUserActiveChallenges(userId, monthKey);

    return challenges.map(ch => {
      const log = db.prepare(`
        SELECT status, note, rating, created_at 
        FROM daily_logs 
        WHERE challenge_id = ? AND log_date = ?
      `).get(ch.id, targetDate);

      const streak = this.calculateStreak(ch.id, targetDate);

      return {
        ...ch,
        today_status: log ? log.status : 'pending', // 'completed' | 'skipped' | 'pending'
        today_note: log?.note || '',
        today_rating: log?.rating || null,
        streak
      };
    });
  },

  // Calculate current streak of consecutive completed days
  calculateStreak(challengeId, referenceDateStr = null) {
    const today = referenceDateStr || dateUtils.getTodayDateStr();
    const logs = db.prepare(`
      SELECT log_date, status 
      FROM daily_logs 
      WHERE challenge_id = ? 
      ORDER BY log_date DESC
    `).all(challengeId);

    if (!logs.length) return 0;

    let streak = 0;
    let expectedDate = today;

    // Check if today is completed
    const todayLog = logs.find(l => l.log_date === today);
    if (!todayLog || todayLog.status !== 'completed') {
      // Check if yesterday was completed (streak still alive, pending today)
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      expectedDate = dateUtils.getTodayDateStr(yesterday);
    }

    for (const log of logs) {
      if (log.log_date === expectedDate) {
        if (log.status === 'completed') {
          streak++;
          const prev = new Date(expectedDate);
          prev.setDate(prev.getDate() - 1);
          expectedDate = dateUtils.getTodayDateStr(prev);
        } else {
          break;
        }
      } else if (log.log_date < expectedDate) {
        // Gap in days
        break;
      }
    }

    return streak;
  },

  // Summary statistics for month
  getMonthlyStats(userId, monthKey = null) {
    const month = monthKey || dateUtils.getCurrentMonthKey();
    const challenges = this.getAllUserChallenges(userId, month);

    let totalCompletedLogs = 0;
    let totalLogs = 0;

    const challengeSummaries = challenges.map(ch => {
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total_logged,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
          SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped_count,
          AVG(rating) as avg_rating
        FROM daily_logs
        WHERE challenge_id = ? AND log_date LIKE ?
      `).get(ch.id, `${month}%`);

      const completed = stats.completed_count || 0;
      totalCompletedLogs += completed;
      totalLogs += (stats.total_logged || 0);

      return {
        ...ch,
        total_logged: stats.total_logged || 0,
        completed_count: completed,
        skipped_count: stats.skipped_count || 0,
        avg_rating: stats.avg_rating ? Math.round(stats.avg_rating * 10) / 10 : null,
        streak: this.calculateStreak(ch.id)
      };
    });

    return {
      monthKey: month,
      monthName: dateUtils.getMonthNameRu(month),
      totalChallenges: challenges.length,
      totalCompletedLogs,
      challengeSummaries
    };
  }
};
