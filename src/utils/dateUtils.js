import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(isoWeek);
dayjs.extend(utc);
dayjs.extend(timezone);

const MONTH_NAMES_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export const dateUtils = {
  getCurrentMonthKey(date = new Date()) {
    return dayjs(date).format('YYYY-MM');
  },

  getMonthNameRu(monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    const monthName = MONTH_NAMES_RU[month - 1] || monthKey;
    return `${monthName} ${year}`;
  },

  getTodayDateStr(date = new Date()) {
    return dayjs(date).format('YYYY-MM-DD');
  },

  getCurrentWeekKey(date = new Date()) {
    const d = dayjs(date);
    return `${d.isoWeekYear()}-W${String(d.isoWeek()).padStart(2, '0')}`;
  },

  getPreviousWeekKey(date = new Date()) {
    const d = dayjs(date).subtract(1, 'week');
    return `${d.isoWeekYear()}-W${String(d.isoWeek()).padStart(2, '0')}`;
  },

  getWeekDateRange(date = new Date()) {
    const d = dayjs(date);
    const startOfWeek = d.startOf('isoWeek').format('YYYY-MM-DD');
    const endOfWeek = d.endOf('isoWeek').format('YYYY-MM-DD');
    return { startOfWeek, endOfWeek };
  },

  getDaysInWeek(date = new Date()) {
    const d = dayjs(date);
    const days = [];
    let cur = d.startOf('isoWeek');
    for (let i = 0; i < 7; i++) {
      days.push(cur.format('YYYY-MM-DD'));
      cur = cur.add(1, 'day');
    }
    return days;
  },

  isToday(dateStr) {
    return dateStr === this.getTodayDateStr();
  },

  formatDisplayDate(dateStr) {
    return dayjs(dateStr).format('DD.MM.YYYY');
  }
};
