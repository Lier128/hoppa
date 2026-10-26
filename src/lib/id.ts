let counter = 0;

/** 稳定、可读的本地 ID（不需要后端，不依赖随机数种子） */
export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 100000;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}
