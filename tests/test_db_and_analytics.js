import assert from 'assert';
import { initDatabase, db } from '../src/db/database.js';
import { userService } from '../src/services/userService.js';
import { challengeService } from '../src/services/challengeService.js';
import { knowledgeService } from '../src/services/knowledgeService.js';
import { analyticsService } from '../src/services/analyticsService.js';
import { dateUtils } from '../src/utils/dateUtils.js';

async function runTests() {
  console.log('🧪 Starting Automated Unit & Integration Tests...\n');

  // 1. Initialize DB
  console.log('1️⃣ Testing Database Initialization...');
  initDatabase();
  assert.ok(db, 'Database should be initialized');
  console.log('  ✅ DB init passed.');

  // Clean up any previous test artifacts for testUserId
  const testUserId = 99999901;
  db.prepare('DELETE FROM users WHERE telegram_id = ?').run(testUserId);
  db.prepare('DELETE FROM challenges WHERE user_id = ?').run(testUserId);
  db.prepare('DELETE FROM daily_logs WHERE user_id = ?').run(testUserId);
  db.prepare('DELETE FROM knowledge_checks WHERE user_id = ?').run(testUserId);
  db.prepare('DELETE FROM weekly_checkpoints WHERE user_id = ?').run(testUserId);

  // 2. User Service
  console.log('2️⃣ Testing User Service...');
  const user = userService.getOrCreateUser(testUserId, 'test_user', 'Тестовый Пользователь');
  assert.strictEqual(user.telegram_id, testUserId, 'User ID matches');
  assert.strictEqual(user.first_name, 'Тестовый Пользователь', 'User first name matches');

  userService.updateSettings(testUserId, {
    reminder_morning: '08:00',
    reminder_evening: '22:00',
    timezone: '+05:00'
  });
  const updatedUser = userService.getUser(testUserId);
  assert.strictEqual(updatedUser.reminder_morning, '08:00');
  assert.strictEqual(updatedUser.reminder_evening, '22:00');
  console.log('  ✅ User service passed.');

  // 3. Challenge Service (Monthly intake)
  console.log('3️⃣ Testing Challenge Service (Monthly Intake)...');
  const currentMonth = dateUtils.getCurrentMonthKey();

  const habitCh = challengeService.createChallenge(testUserId, {
    title: 'Утренняя зарядка 20 мин',
    type: 'habit',
    category: 'Здоровье',
    targetDays: 7
  });
  assert.ok(habitCh.id, 'Habit challenge should be created');
  assert.strictEqual(habitCh.type, 'habit');

  const learningCh = challengeService.createChallenge(testUserId, {
    title: 'Курс по Node.js и базам данных',
    type: 'learning',
    category: 'Программирование',
    targetDays: 5
  });
  assert.ok(learningCh.id, 'Learning challenge should be created');
  assert.strictEqual(learningCh.type, 'learning');

  const englishCh = challengeService.createChallenge(testUserId, {
    title: '15 минут чтения на английском',
    type: 'learning',
    category: 'Английский',
    targetDays: 7
  });

  const userChallenges = challengeService.getUserActiveChallenges(testUserId, currentMonth);
  assert.strictEqual(userChallenges.length, 3, 'Should have 3 active challenges');
  console.log('  ✅ Challenge intake passed.');

  // 4. Daily Logs & Streak Calculation
  console.log('4️⃣ Testing Daily Logs & Streak Calculations...');
  const today = dateUtils.getTodayDateStr();
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = dateUtils.getTodayDateStr(d);
  d.setDate(d.getDate() - 1);
  const dayBeforeYesterday = dateUtils.getTodayDateStr(d);

  // Record logs for past 3 consecutive days for habitCh
  challengeService.recordDailyLog(habitCh.id, testUserId, dayBeforeYesterday, 'completed');
  challengeService.recordDailyLog(habitCh.id, testUserId, yesterday, 'completed');
  challengeService.recordDailyLog(habitCh.id, testUserId, today, 'completed');

  const streak = challengeService.calculateStreak(habitCh.id, today);
  assert.strictEqual(streak, 3, `Expected streak 3, got ${streak}`);

  const todayStatus = challengeService.getTodayChallengesWithStatus(testUserId, today);
  const habitToday = todayStatus.find(c => c.id === habitCh.id);
  assert.strictEqual(habitToday.today_status, 'completed');
  assert.strictEqual(habitToday.streak, 3);
  console.log('  ✅ Daily logs & streak passed.');

  // 5. Knowledge Checks & Learning Assessment
  console.log('5️⃣ Testing Knowledge Checks & Learning Assessment...');
  const check1 = knowledgeService.recordKnowledgeCheck(testUserId, learningCh.id, {
    topic: 'Асинхронность в Node.js, Event Loop',
    keyTakeaways: 'Microtasks (Promise.then, process.nextTick) выполняются раньше macrotasks (setTimeout, setImmediate).',
    quizQuestion: 'В каком порядке выполняются microtasks и macrotasks?',
    userAnswer: 'Сначала все микротаски из очереди, затем макротаски.',
    comprehensionScore: 9,
    confidenceScore: 5,
    checkDate: today
  });
  assert.ok(check1.id, 'Knowledge check should be recorded');
  assert.strictEqual(check1.comprehension_score, 9);

  const check2 = knowledgeService.recordKnowledgeCheck(testUserId, englishCh.id, {
    topic: 'Idioms and Phrasal Verbs',
    keyTakeaways: 'Bite the bullet, call it a day, under the weather',
    comprehensionScore: 8,
    checkDate: yesterday
  });
  assert.ok(check2.id);

  const recallPrompt = knowledgeService.generateRecallPrompts('Node.js Streams');
  assert.ok(recallPrompt.length > 10, 'Should generate prompt');
  console.log('  ✅ Knowledge checks passed.');

  // 6. Analytics & Radar Diagram Calculation
  console.log('6️⃣ Testing Weekly Competency Analytics & Radar Diagram...');
  const analysis = analyticsService.generateWeeklyAnalysis(testUserId);
  assert.ok(analysis.competencyScores, 'Competency scores should exist');
  assert.ok(analysis.competencyScores['Программирование'] >= 0, 'Programming competency score calculated');
  assert.ok(analysis.competencyScores['Здоровье'] >= 0, 'Health score calculated');
  assert.ok(analysis.competencyScores['Дисциплина'] >= 0, 'Discipline score calculated');

  console.log('  📊 Calculated Competency Scores:', analysis.competencyScores);
  console.log('  📈 Deltas compared to previous checkpoint:', analysis.deltas);

  const reportText = analyticsService.formatWeeklyReportText(analysis);
  assert.ok(reportText.includes('ЕЖЕНЕДЕЛЬНЫЙ АНАЛИЗ'), 'Report text formatted properly');

  const chartUrl = analyticsService.generateRadarChartUrl(analysis);
  assert.ok(chartUrl.startsWith('https://quickchart.io/chart'), 'QuickChart URL generated properly');
  console.log('  🌐 Chart URL:', chartUrl.substring(0, 70) + '...');

  console.log('  ✅ Analytics and Radar chart generation passed.');

  // 7. Single-message Multi-Goal Parsing & Batch Creation
  console.log('7️⃣ Testing Single-Message Multi-Goal Parsing & Batch Creation...');
  const { parseGoalsFromText } = await import('../src/utils/goalParser.js');
  const sampleMessage = `
  1. Курс по TypeScript и NestJS (обучение, программирование, 5 дней)
  2. Утренняя пробежка 5 км
  3. Читать книгу 'Чистый код' | Обучение | Чтение
  4. 20 новых слов на английском
  5. Пить 2 литра чистой воды (здоровье, 7 дней)
  `;

  const parsed = parseGoalsFromText(sampleMessage);
  assert.strictEqual(parsed.length, 5, 'Should parse 5 goals');
  assert.strictEqual(parsed[0].title, "Курс по TypeScript и NestJS");
  assert.strictEqual(parsed[0].type, "learning");
  assert.strictEqual(parsed[0].category, "Программирование");
  assert.strictEqual(parsed[0].targetDays, 5);

  assert.strictEqual(parsed[1].title, "Утренняя пробежка 5 км");
  assert.strictEqual(parsed[1].category, "Здоровье");

  assert.strictEqual(parsed[2].category, "Чтение");
  assert.strictEqual(parsed[3].category, "Английский");

  const batchCreated = challengeService.createMultipleChallenges(testUserId, parsed);
  assert.strictEqual(batchCreated.length, 5, 'Should create 5 challenges at once');
  console.log('  ✅ Single-message multi-goal parsing and creation passed.');

  // 8. Gemini AI Quiz Generation & Response Evaluation
  console.log('8️⃣ Testing Gemini AI Quiz & Evaluation Service...');
  const { geminiService } = await import('../src/services/geminiService.js');
  const quiz = await geminiService.generateQuiz('Event Loop и асинхронность в Node.js', 'Программирование', 3);
  assert.ok(quiz.questions, 'Quiz should contain questions array');
  assert.strictEqual(quiz.questions.length, 3, 'Quiz should have 3 questions');
  assert.ok(quiz.questions[0].question, 'Question text must not be empty');
  assert.ok(Array.isArray(quiz.questions[0].options), 'Options must be an array');
  assert.ok(quiz.questions[0].explanation, 'Explanation must exist');

  const evalResult = await geminiService.evaluateOpenResponse(
    'Event Loop в Node.js',
    'Объясните порядок выполнения microtasks и macrotasks',
    'Микротаски выполняются перед следующей макротаской, process.nextTick имеет наивысший приоритет.'
  );
  assert.ok(evalResult.score >= 1 && evalResult.score <= 10, 'Score must be between 1 and 10');
  assert.ok(evalResult.feedback, 'Feedback must be returned');
  console.log('  ✅ Gemini AI Quiz & Evaluation passed.');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🚀\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
