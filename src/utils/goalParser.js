/**
 * Intelligent parser for single or multi-line goal input.
 * Supports natural text, bulleted lists, numbered lists, and pipe/parenthesis formats.
 */

const CATEGORY_KEYWORDS = {
  'Программирование': [
    'node', 'js', 'javascript', 'ts', 'typescript', 'python', 'react', 'vue', 'sql',
    'баз данных', 'бд', 'код', 'программир', 'dev', 'developer', 'алгоритм', 'backend',
    'frontend', 'git', 'docker', 'linux', 'api', 'архитектур', 'системн', 'nestjs',
    'разработк', 'ит', 'it', 'web', 'веб'
  ],
  'Английский': [
    'english', 'английск', 'слова', 'слов', 'язык', 'ielts', 'toefl', 'немецк',
    'грамматик', 'vocabulary', 'speaking', 'listening', 'испанск', 'французск', 'duolingo'
  ],
  'Здоровье': [
    'спорт', 'зарядк', 'бег', 'пробежк', 'пробежка', 'зал', 'тренировк', 'отжиман',
    'приседан', 'растяжк', 'вода', 'воды', 'сон', 'шаг', 'шагов', 'плаван', 'здоров',
    'питание', 'диета', 'прогулк', 'пресс', 'турник', 'ходьба', 'йог', 'разминк',
    'кардио', 'фитнес', 'гантел', 'км', 'велик', 'велосипед'
  ],
  'Чтение': [
    'книг', 'книгу', 'книги', 'читат', 'чтени', 'страниц', 'литератур', 'нон-фикшн',
    'book', 'глава', 'главы'
  ],
  'Дисциплина': [
    'дисциплин', 'медитац', 'режим', 'подъем', 'ранний', 'дневник', 'фокус',
    'помодоро', 'планирован', 'стоицизм', 'привычк', 'без сахара', 'без соцсетей',
    'осознан'
  ],
  'Продуктивность': [
    'проект', 'задач', 'работа', 'учеба', 'конспект', 'тайм-менеджмент', 'фокус', 'дело'
  ]
};

const LEARNING_KEYWORDS = [
  'курс', 'курсы', 'обучение', 'учить', 'изучать', 'изучение', 'книга', 'книгу',
  'читать', 'чтение', 'лекции', 'лекция', 'урок', 'уроки', 'статьи', 'статью',
  'tutorial', 'learn', 'study', 'book', 'теория', 'конспект'
];

const SKILL_KEYWORDS = [
  'проект', 'pet-project', 'портфолио', 'разработка', 'стартап', 'практика',
  'навык', 'написать', 'создать', 'сделать'
];

export function parseGoalsFromText(text) {
  if (!text || typeof text !== 'string') return [];

  const rawLines = text.split(/\r?\n/);
  const goals = [];

  for (const rawLine of rawLines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Remove leading numbering or list markers: "1.", "1)", "-", "•", "*", "—", "+"
    line = line.replace(/^(\d+[\.\)]|\-|\*|•|—|\+)\s*/, '').trim();
    if (!line) continue;

    let title = line;
    let explicitType = null;
    let explicitCategory = null;
    let targetDays = 7;

    // Check if line contains pipe delimiters: "Title | Type or Category | Frequency"
    if (line.includes('|')) {
      const parts = line.split('|').map(p => p.trim()).filter(Boolean);
      title = parts[0];

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        const partLower = part.toLowerCase();

        // Check frequency in part: "5 дн", "3 days", "7"
        const daysMatch = partLower.match(/(\d+)\s*(дн|дней|дня|д|days)?/);
        if (daysMatch && !isNaN(parseInt(daysMatch[1], 10)) && parseInt(daysMatch[1], 10) <= 7) {
          targetDays = parseInt(daysMatch[1], 10);
          continue;
        }

        // Check type in part
        if (partLower.includes('обучен') || partLower.includes('курс') || partLower.includes('learn')) {
          explicitType = 'learning';
          continue;
        }
        if (partLower.includes('навык') || partLower.includes('проект') || partLower.includes('skill')) {
          explicitType = 'skill';
          continue;
        }
        if (partLower.includes('привычк') || partLower.includes('habit')) {
          explicitType = 'habit';
          continue;
        }

        // Check category in part
        for (const cat of Object.keys(CATEGORY_KEYWORDS)) {
          if (partLower.includes(cat.toLowerCase())) {
            explicitCategory = cat;
            break;
          }
        }

        if (!explicitCategory && part.length > 1) {
          explicitCategory = part; // Use custom category string
        }
      }
    } else {
      // Check parenthesis: "Title (5 days, English)"
      const parenMatch = title.match(/\(([^)]+)\)$/);
      if (parenMatch) {
        const insideParen = parenMatch[1].toLowerCase();
        title = title.replace(/\(([^)]+)\)$/, '').trim();

        const daysMatch = insideParen.match(/(\d+)\s*(дн|дней|дня|д|days)/);
        if (daysMatch) {
          targetDays = parseInt(daysMatch[1], 10);
        }

        if (insideParen.includes('обучен') || insideParen.includes('курс')) explicitType = 'learning';
        else if (insideParen.includes('привычк')) explicitType = 'habit';
        else if (insideParen.includes('навык')) explicitType = 'skill';

        for (const cat of Object.keys(CATEGORY_KEYWORDS)) {
          if (insideParen.includes(cat.toLowerCase())) {
            explicitCategory = cat;
            break;
          }
        }
      }
    }

    const titleLower = title.toLowerCase();

    // Auto-detect type if not explicit
    let type = explicitType;
    if (!type) {
      if (LEARNING_KEYWORDS.some(kw => titleLower.includes(kw))) {
        type = 'learning';
      } else if (SKILL_KEYWORDS.some(kw => titleLower.includes(kw))) {
        type = 'skill';
      } else {
        type = 'habit';
      }
    }

    // Auto-detect category if not explicit
    let category = explicitCategory;
    if (!category) {
      for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(kw => titleLower.includes(kw))) {
          category = catName;
          break;
        }
      }
    }
    if (!category) {
      category = type === 'learning' ? 'Обучение' : 'Продуктивность';
    }

    // Clean up title from any stray trailing pipes or brackets
    title = title.replace(/[|()]/g, '').trim();

    if (title.length > 0) {
      goals.push({
        title,
        type,
        category,
        targetDays: Math.min(7, Math.max(1, targetDays))
      });
    }
  }

  return goals;
}
