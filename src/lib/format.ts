import type { Activity, FeeMode, User } from '@/types';
import { FEE_MODE_META } from '@/types';

/** 费用展示：免费 / 待协商 / ¥80 起 / ¥80–120 */
export function budgetLabel(activity: Pick<Activity, 'feeMode' | 'budgetMin' | 'budgetMax'>): string {
  const { feeMode, budgetMin, budgetMax } = activity;
  if (feeMode === 'free') return '免费';
  if (feeMode === 'negotiable') return '费用待协商';
  const min = Math.max(0, Math.round(budgetMin));
  const max = Math.max(0, Math.round(budgetMax));
  if (!min && !max) return FEE_MODE_META[feeMode].label;
  if (max && max !== min) return `¥${min}–${max}`;
  return `¥${max || min}`;
}

export function feeModeLabel(mode: FeeMode): string {
  return FEE_MODE_META[mode].label;
}

/** 头像首字：中文取第一个字，英文取首字母 */
export function avatarInitial(nickname: string): string {
  const trimmed = nickname.trim();
  if (!trimmed) return '?';
  return Array.from(trimmed)[0]!.toUpperCase();
}

export function displayName(user: User | undefined, fallback = '演示用户'): string {
  return user?.nickname?.trim() || fallback;
}

/** 手机号/坐标等敏感字段永远不进入展示层；这里只处理纯文本裁剪 */
export function truncate(text: string, max = 80): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('zh-CN').format(n);
}

export function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

/** 复制文本：优先 Clipboard API，失败时退回 textarea + execCommand（无外部依赖） */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 继续走降级方案 */
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
