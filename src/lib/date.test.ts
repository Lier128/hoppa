import { describe, expect, it } from 'vitest';
import {
  addMinutes,
  clock,
  combineDateTime,
  countdownLabel,
  dateTimeRange,
  durationLabel,
  isFuture,
  localISO,
  relativeDayTime,
  timeOfDayBucket,
} from './date';

describe('date 工具', () => {
  it('combineDateTime 组合本地日期时间', () => {
    const d = combineDateTime('2030-05-01', '19:30');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2030);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(1);
    expect(d!.getHours()).toBe(19);
    expect(d!.getMinutes()).toBe(30);
  });

  it('combineDateTime 对空值返回 null', () => {
    expect(combineDateTime('', '19:30')).toBeNull();
    expect(combineDateTime('2030-05-01', '')).toBeNull();
  });

  it('localISO 输出带时区偏移的 ISO 字符串', () => {
    const iso = localISO(new Date(2030, 0, 2, 3, 4, 5));
    expect(iso).toMatch(/^2030-01-02T03:04:05\.\d{3}[+-]\d{2}:\d{2}$/);
  });

  it('relativeDayTime 覆盖今天 / 明天 / 周内 / 更远', () => {
    const now = new Date(2030, 0, 7, 9, 0); // 周一
    expect(relativeDayTime(localISO(new Date(2030, 0, 7, 19, 0)), now)).toBe('今天 19:00');
    expect(relativeDayTime(localISO(new Date(2030, 0, 8, 9, 30)), now)).toBe('明天 09:30');
    expect(relativeDayTime(localISO(new Date(2030, 0, 9, 10, 0)), now)).toBe('后天 10:00');
    expect(relativeDayTime(localISO(new Date(2030, 0, 12, 14, 0)), now)).toBe('周六 14:00');
    expect(relativeDayTime(localISO(new Date(2030, 1, 2, 14, 0)), now)).toBe('2月2日 14:00');
  });

  it('dateTimeRange 同一天只显示一个日期', () => {
    const start = localISO(new Date(2030, 4, 1, 19, 0));
    const end = localISO(new Date(2030, 4, 1, 21, 0));
    expect(dateTimeRange(start, end)).toContain('19:00–21:00');
  });

  it('durationLabel / countdownLabel 输出可读文案', () => {
    expect(durationLabel(90)).toBe('1 小时 30 分钟');
    expect(durationLabel(120)).toBe('2 小时');
    expect(durationLabel(45)).toBe('45 分钟');
    const now = new Date(2030, 4, 1, 19, 0);
    expect(countdownLabel(localISO(addMinutes(now, 30)), now)).toBe('30 分钟后开始');
    expect(countdownLabel(localISO(addMinutes(now, 60 * 5)), now)).toBe('5 小时后开始');
  });

  it('isFuture 与 timeOfDayBucket', () => {
    const now = new Date(2030, 4, 1, 19, 0);
    expect(isFuture(localISO(addMinutes(now, 10)), now)).toBe(true);
    expect(isFuture(localISO(addMinutes(now, -10)), now)).toBe(false);
    expect(timeOfDayBucket(localISO(new Date(2030, 4, 1, 9, 0)))).toBe('morning');
    expect(timeOfDayBucket(localISO(new Date(2030, 4, 1, 15, 0)))).toBe('afternoon');
    expect(timeOfDayBucket(localISO(new Date(2030, 4, 1, 20, 0)))).toBe('evening');
  });

  it('clock 补零', () => {
    expect(clock(new Date(2030, 0, 1, 7, 5))).toBe('07:05');
  });
});
