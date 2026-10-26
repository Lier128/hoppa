/**
 * 日期与时间工具。
 *
 * 演示版约定：所有活动时间使用「本地时区语义」的 ISO 字符串，不做时区换算；
 * seed 数据基于「当前时间」生成，保证任何时候打开演示都不会出现全部活动过期。
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const pad = (n: number) => String(n).padStart(2, '0');

/** 生成本地时区的 ISO 字符串（保留毫秒，便于排序） */
export function localISO(d: Date = new Date()): string {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

export function toDate(iso: string): Date {
  return new Date(iso);
}

export function startOfDay(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function setClock(d: Date, hour: number, minute = 0): Date {
  const x = new Date(d);
  x.setHours(hour, minute, 0, 0);
  return x;
}

/** 距离今天 n 天的某个时刻（seed 用） */
export function daysFromNow(days: number, hour: number, minute = 0): Date {
  return setClock(addDays(new Date(), days), hour, minute);
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * MINUTE);
}

export function isFuture(iso: string, now: Date = new Date()): boolean {
  const t = toDate(iso).getTime();
  return Number.isFinite(t) && t > now.getTime();
}

export function isPast(iso: string, now: Date = new Date()): boolean {
  const t = toDate(iso).getTime();
  return Number.isFinite(t) && t < now.getTime();
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function weekdayLabel(d: Date): string {
  return WEEKDAYS[d.getDay()];
}

export function monthDay(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function shortDate(d: Date): string {
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function clock(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 「今天 19:00」「明天 09:30」「周六 10:00」「11.02 14:00」 */
export function relativeDayTime(iso: string, now: Date = new Date()): string {
  const d = toDate(iso);
  if (Number.isNaN(d.getTime())) return '时间待定';
  const diffDays = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY);
  const time = clock(d);
  if (diffDays === 0) return `今天 ${time}`;
  if (diffDays === 1) return `明天 ${time}`;
  if (diffDays === 2) return `后天 ${time}`;
  if (diffDays > 2 && diffDays < 7) return `${weekdayLabel(d)} ${time}`;
  return `${monthDay(d)} ${time}`;
}

/** 「10月31日 周六 19:00–21:00」 */
export function dateTimeRange(startIso: string, endIso: string): string {
  const s = toDate(startIso);
  const e = toDate(endIso);
  if (Number.isNaN(s.getTime())) return '时间待定';
  const sameDay = isSameDay(s, e);
  return `${monthDay(s)} ${weekdayLabel(s)} ${clock(s)}–${sameDay ? clock(e) : `${monthDay(e)} ${clock(e)}`}`;
}

export function durationLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '时长待定';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} 分钟`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分钟`;
}

/** 活动开始前剩余时间的口语化文案 */
export function countdownLabel(startIso: string, now: Date = new Date()): string {
  const start = toDate(startIso).getTime();
  const diff = start - now.getTime();
  if (!Number.isFinite(start)) return '';
  if (diff < 0) return '已开始';
  const mins = Math.floor(diff / MINUTE);
  if (mins < 60) return `${Math.max(1, mins)} 分钟后开始`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时后开始`;
  const days = Math.floor(hours / 24);
  return `${days} 天后开始`;
}

/** 用于格式化「刚刚 / 3 分钟前」的消息时间 */
export function fromNowLabel(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - toDate(iso).getTime();
  if (!Number.isFinite(diff)) return '';
  if (diff < MINUTE) return '刚刚';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} 天前`;
  return shortDate(toDate(iso));
}

/** yyyy-mm-dd 形式的 input[type=date] 值 */
export function inputDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 把 date + HH:mm 组合成本地 ISO */
export function combineDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  if (![y, m, d, hh, mm].every((n) => Number.isFinite(n))) return null;
  const result = new Date(y, m - 1, d, hh, mm, 0, 0);
  if (Number.isNaN(result.getTime())) return null;
  return result;
}

/** 是否为周末（周六/周日） */
export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** 把时间归入筛选用的时间段：morning / afternoon / evening */
export function timeOfDayBucket(iso: string): 'morning' | 'afternoon' | 'evening' {
  const h = toDate(iso).getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
