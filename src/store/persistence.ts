/**
 * 本地持久化层：所有 localStorage 读写集中在这里，组件不直接碰 storage。
 * 刷新后活动 / 申请 / 消息 / 资料 / 评价仍能恢复（PRD HOP-018）。
 */
import type { AppState } from '@/types';
import { createInitialState, SCHEMA_VERSION } from '@/data/seed';
import { STORAGE_KEY } from '@/store/reducer';

function hasShape(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppState>;
  return (
    Array.isArray(candidate.users) &&
    Array.isArray(candidate.activities) &&
    Array.isArray(candidate.applications) &&
    Array.isArray(candidate.members) &&
    Array.isArray(candidate.conversations) &&
    Array.isArray(candidate.messages) &&
    Array.isArray(candidate.reviews) &&
    Array.isArray(candidate.posts) &&
    Array.isArray(candidate.interactions) &&
    Array.isArray(candidate.reports) &&
    Array.isArray(candidate.checkins) &&
    Array.isArray(candidate.events) &&
    typeof candidate.currentUserId === 'string'
  );
}

export function loadState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed: unknown = JSON.parse(raw);
    if (!hasShape(parsed)) return createInitialState();
    if (parsed.schemaVersion !== SCHEMA_VERSION) return createInitialState();
    // 如果当前演示身份在数据里不存在（例如旧数据），回退到默认身份
    if (!parsed.users.some((u) => u.id === parsed.currentUserId)) {
      return { ...parsed, currentUserId: createInitialState().currentUserId };
    }
    return parsed;
  } catch {
    return createInitialState();
  }
}

export function saveState(state: AppState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 隐私模式 / 配额不足时静默降级：本次会话仍可用，只是刷新后不保留
    console.warn('[hoppa] 本地存储写入失败，刷新后数据可能丢失');
  }
}

export function clearState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
