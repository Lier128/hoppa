import { useMemo, useState } from 'react';
import type { Activity, ActivityKind, AppState, Category, Transport } from '@/types';
import { CATEGORIES, CATEGORY_META, TRANSPORTS, TRANSPORT_META } from '@/types';
import { useApp } from '@/store/AppStore';
import { useToast } from '@/components/ui';
import { ActivityCard } from '@/components/activity/ActivityCard';
import { Button, EmptyState, Modal, PageHead } from '@/components/ui';
import {
  Funnel,
  Info,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Target,
  Users,
  UsersRound,
} from '@/components/ui/icons';
import { explainRecommendation } from '@/domain/recommend';
import { remainingSeats } from '@/domain/rules';
import { addDays, isFuture, isSameDay, startOfDay } from '@/lib/date';
import { cx } from '@/lib/format';
import styles from './FindBuddy.module.css';

/**
 * 找搭子 / 匹配（交互规格 §2.4 / PRD §8.4）
 *
 * - 顶部切换「社群活动 / 个人活动」（activity.kind），真实改变推荐池；
 * - 「开始匹配」打开偏好面板；提交后按偏好过滤 + 按 explainRecommendation 的分数重排，
 *   并把推荐原因透出到卡片上，不做「只弹一个匹配成功」的假交互；
 * - 无结果时给出可执行的具体建议（放宽预算 / 换日期 / 清除类型 / 一键清除），每一条都会立刻改变列表。
 */

type TimeFilter = 'any' | 'today' | 'tomorrow' | 'weekend';
type BuddySort = 'match' | 'time';

interface BuddyPrefs {
  category: Category | 'all';
  time: TimeFilter;
  budgetMax: number | null;
  transport: Transport | 'any';
  onlySeats: boolean;
}

const DEFAULT_PREFS: BuddyPrefs = {
  category: 'all',
  time: 'any',
  budgetMax: null,
  transport: 'any',
  onlySeats: false,
};

const TIME_OPTIONS: ReadonlyArray<{ value: TimeFilter; label: string }> = [
  { value: 'any', label: '不限' },
  { value: 'today', label: '今天' },
  { value: 'tomorrow', label: '明天' },
  { value: 'weekend', label: '本周末' },
];

const BUDGET_OPTIONS: ReadonlyArray<{ value: number | null; label: string }> = [
  { value: null, label: '不限' },
  { value: 50, label: '≤ ¥50' },
  { value: 100, label: '≤ ¥100' },
  { value: 150, label: '≤ ¥150' },
  { value: 200, label: '≤ ¥200' },
];

const CATEGORY_OPTIONS: ReadonlyArray<{ value: Category | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  ...CATEGORIES.map((key) => ({ value: key, label: CATEGORY_META[key].label })),
];

const TRANSPORT_OPTIONS: ReadonlyArray<{ value: Transport | 'any'; label: string }> = [
  { value: 'any', label: '不限' },
  ...TRANSPORTS.map((key) => ({ value: key, label: TRANSPORT_META[key] })),
];

function timeLabel(time: TimeFilter): string {
  return TIME_OPTIONS.find((option) => option.value === time)?.label ?? '不限';
}

/** 本周末（周六 + 周日）对应的日期；今天是周六/周日时包含今天 */
function weekendDays(now: Date): Date[] {
  const today = startOfDay(now);
  const dow = today.getDay();
  if (dow === 6) return [today, startOfDay(addDays(today, 1))];
  if (dow === 0) return [today];
  const saturday = startOfDay(addDays(today, 6 - dow));
  return [saturday, startOfDay(addDays(saturday, 1))];
}

/** 人均上限估算：免费 = 0；费用待协商且没填预算 = 不可估算 */
function costEstimate(activity: Activity): number {
  if (activity.feeMode === 'free') return 0;
  return activity.budgetMax || activity.budgetMin || Number.POSITIVE_INFINITY;
}

function inTimeRange(activity: Activity, time: TimeFilter, now: Date): boolean {
  if (time === 'any') return true;
  const start = new Date(activity.startAt);
  if (time === 'today') return isSameDay(start, now);
  if (time === 'tomorrow') return isSameDay(start, addDays(now, 1));
  return weekendDays(now).some((day) => isSameDay(start, day));
}

function applyPrefs(
  activities: Activity[],
  state: Pick<AppState, 'members'>,
  prefs: BuddyPrefs,
  now: Date,
): Activity[] {
  return activities.filter((activity) => {
    if (prefs.category !== 'all' && activity.category !== prefs.category) return false;
    if (prefs.transport !== 'any' && activity.transport !== prefs.transport) return false;
    if (!inTimeRange(activity, prefs.time, now)) return false;
    if (prefs.budgetMax !== null && costEstimate(activity) > prefs.budgetMax) return false;
    if (prefs.onlySeats && remainingSeats(state, activity) <= 0) return false;
    return true;
  });
}

/** 偏好面板里的一行 chip 选择 */
function ChipSelect<T extends string | number | null>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.prefField}>
      <span className={styles.prefLabel}>{label}</span>
      <div className={styles.chipRow} role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            className="chip"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FindBuddyPage() {
  const { state, now, currentUser, track } = useApp();
  const toast = useToast();

  const [kind, setKind] = useState<ActivityKind>('group');
  const [sort, setSort] = useState<BuddySort>('time');
  const [prefs, setPrefs] = useState<BuddyPrefs>(DEFAULT_PREFS);
  const [draft, setDraft] = useState<BuddyPrefs>(DEFAULT_PREFS);
  const [applied, setApplied] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  /** 推荐池只包含「准备中 + 未开始」的活动，已结束 / 已取消不会出现在匹配结果里 */
  const baseActivities = useMemo(
    () =>
      state.activities.filter(
        (activity) => activity.status === 'preparing' && isFuture(activity.startAt, now),
      ),
    [state.activities, now],
  );

  const groupCount = baseActivities.filter((activity) => activity.kind === 'group').length;
  const individualCount = baseActivities.filter((activity) => activity.kind === 'individual').length;
  const kindLabel = kind === 'group' ? '社群活动' : '个人活动';

  const kindActivities = useMemo(
    () => baseActivities.filter((activity) => activity.kind === kind),
    [baseActivities, kind],
  );

  const ranked = useMemo(() => {
    const list = applyPrefs(kindActivities, state, prefs, now);
    const withRecommendation = list.map((activity) => ({
      activity,
      rec: explainRecommendation(currentUser, activity),
    }));
    withRecommendation.sort((a, b) => {
      if (sort === 'match') {
        const diff = b.rec.score - a.rec.score;
        if (diff !== 0) return diff;
      }
      return a.activity.startAt.localeCompare(b.activity.startAt);
    });
    return withRecommendation;
  }, [kindActivities, state, prefs, now, sort, currentUser]);

  const draftCount = useMemo(
    () => applyPrefs(kindActivities, state, draft, now).length,
    [kindActivities, state, draft, now],
  );

  const openPrefs = () => {
    setDraft(prefs);
    setPrefsOpen(true);
  };

  const submitPrefs = () => {
    const resultCount = applyPrefs(kindActivities, state, draft, now).length;
    setPrefs(draft);
    setApplied(true);
    setSort('match');
    setPrefsOpen(false);
    track('filter_apply', {
      category: draft.category,
      date_range: draft.time,
      budget_range: draft.budgetMax === null ? 'any' : `le_${draft.budgetMax}`,
      transport: draft.transport,
      result_count: resultCount,
    });
    if (resultCount === 0) {
      toast.info('没有完全匹配的活动，页面里给出了放宽条件的建议');
    } else {
      toast.success(`已按偏好更新推荐：${resultCount} 个活动`);
    }
  };

  /** 空状态里的「放宽某一条」：立刻生效，并同步埋点 */
  const applyQuick = (patch: Partial<BuddyPrefs>, message: string) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    track('filter_apply', {
      category: next.category,
      date_range: next.time,
      budget_range: next.budgetMax === null ? 'any' : `le_${next.budgetMax}`,
      transport: next.transport,
      result_count: applyPrefs(kindActivities, state, next, now).length,
    });
    toast.success(message);
  };

  const clearPrefs = () => {
    setPrefs(DEFAULT_PREFS);
    setApplied(false);
    setSort('time');
    setPrefsOpen(false);
    track('filter_apply', {
      category: 'all',
      date_range: 'any',
      budget_range: 'any',
      transport: 'any',
      result_count: kindActivities.length,
    });
    toast.info('已清除全部匹配条件');
  };

  /** 按当前生效的偏好生成「具体建议」，每条都能一键执行 */
  const suggestions: Array<{ label: string; action: () => void }> = [];
  if (prefs.budgetMax !== null) {
    const nextBudget = prefs.budgetMax >= 200 ? null : prefs.budgetMax + 50;
    suggestions.push({
      label: nextBudget === null ? '预算改为不限' : `预算放宽到 ≤ ¥${nextBudget}`,
      action: () =>
        applyQuick(
          { budgetMax: nextBudget },
          nextBudget === null ? '已取消预算上限' : `预算上限已放宽到 ¥${nextBudget}`,
        ),
    });
  }
  if (prefs.time !== 'any') {
    suggestions.push({
      label: '换一个日期（时间不限）',
      action: () => applyQuick({ time: 'any' }, '已取消时间限制'),
    });
  }
  if (prefs.category !== 'all') {
    suggestions.push({
      label: '清除活动类型限制',
      action: () => applyQuick({ category: 'all' }, '已清除活动类型限制'),
    });
  }
  if (prefs.transport !== 'any') {
    suggestions.push({
      label: '不限出行方式',
      action: () => applyQuick({ transport: 'any' }, '已取消出行方式限制'),
    });
  }
  if (prefs.onlySeats) {
    suggestions.push({
      label: '把已满员的活动也纳入',
      action: () => applyQuick({ onlySeats: false }, '已把满员活动也纳入推荐'),
    });
  }

  return (
    <div className={cx('page', styles.page)}>
      <PageHead
        title="找搭子"
        sub="把「想认识人」变成一场具体的活动：先选偏好，再看推荐，最后直接进活动详情申请。"
        actions={
          <Button
            variant="primary"
            onClick={openPrefs}
            iconLeft={<Sparkles size={16} aria-hidden="true" />}
          >
            开始匹配
          </Button>
        }
      />

      {/* ---------------------------------------------------------- 匹配主区 */}
      <section className={styles.matchHero} aria-labelledby="buddy-match-title">
        <div className={styles.matchHeroText}>
          <span className={styles.kicker}>偏好匹配 · 演示版</span>
          <h2 className={styles.matchTitle} id="buddy-match-title">
            告诉我们你想怎么过这个周末
          </h2>
          <p className={styles.matchDesc}>
            按活动类型、时间、预算上限、出行方式和剩余名额筛选，再按匹配度排序；每条推荐都会写明推荐原因。
          </p>
          <p className={styles.matchNote}>
            <Info size={13} aria-hidden="true" />
            匹配只看可验证的条件（类型 / 时间 / 预算 / 出行方式 / 兴趣标签），不使用 MBTI 等标签作为依据。
          </p>
        </div>
        <div className={styles.matchHeroActions}>
          <Button size="lg" onClick={openPrefs} iconLeft={<SlidersHorizontal size={16} aria-hidden="true" />}>
            开始匹配
          </Button>
          {applied && (
            <Button
              size="lg"
              variant="secondary"
              onClick={clearPrefs}
              iconLeft={<RotateCcw size={16} aria-hidden="true" />}
            >
              清除条件
            </Button>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------- 社群 / 个人切换 */}
      <section className={styles.kindSection} aria-labelledby="buddy-kind-title">
        <div className={styles.kindHead}>
          <h2 className={styles.kindTitle} id="buddy-kind-title">
            想看哪一类？
          </h2>
          <span className={styles.kindHint}>切换后列表会立即更新</span>
        </div>
        <div className={styles.kindRow}>
          <div className="seg" role="group" aria-label="活动类型切换">
            <button
              type="button"
              className={cx('seg__item', styles.kindSeg, kind === 'group' && 'is-active')}
              aria-pressed={kind === 'group'}
              onClick={() => setKind('group')}
            >
              <Users size={15} aria-hidden="true" className={styles.segIcon} />
              社群活动
              <span className={styles.segCount}>{groupCount}</span>
            </button>
            <button
              type="button"
              className={cx('seg__item', styles.kindSeg, kind === 'individual' && 'is-active')}
              aria-pressed={kind === 'individual'}
              onClick={() => setKind('individual')}
            >
              <UsersRound size={15} aria-hidden="true" className={styles.segIcon} />
              个人活动
              <span className={styles.segCount}>{individualCount}</span>
            </button>
          </div>
          <p className={styles.kindDesc}>
            {kind === 'group'
              ? '社群活动：有固定组织者和活动规则，适合想认识一群人。'
              : '个人活动：一位发起者的轻量邀约，人少、节奏更松。'}
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------- 已应用条件 */}
      {applied && (
        <div className={styles.appliedBar}>
          <span className={styles.appliedLabel}>
            <Target size={14} aria-hidden="true" />
            已按偏好匹配
          </span>
          <div className={styles.appliedChips}>
            <span className="tag tag--pink">
              类型：{prefs.category === 'all' ? '不限' : CATEGORY_META[prefs.category].label}
            </span>
            <span className="tag tag--pink">时间：{timeLabel(prefs.time)}</span>
            <span className="tag tag--pink">
              预算：{prefs.budgetMax === null ? '不限' : `≤ ¥${prefs.budgetMax}`}
            </span>
            <span className="tag tag--pink">
              出行：{prefs.transport === 'any' ? '不限' : TRANSPORT_META[prefs.transport]}
            </span>
            {prefs.onlySeats && <span className="tag tag--pink">只看有剩余名额</span>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={openPrefs}
            iconLeft={<SlidersHorizontal size={14} aria-hidden="true" />}
          >
            修改偏好
          </Button>
        </div>
      )}

      {/* ---------------------------------------------------------- 推荐列表 */}
      <section className="section" aria-labelledby="buddy-list-title">
        <div className="section__head">
          <h2 className="section__title" id="buddy-list-title">
            推荐活动 <span className={styles.count}>{ranked.length}</span>
          </h2>
          <div className={styles.sortRow}>
            <div className="seg" role="group" aria-label="推荐排序">
              <button
                type="button"
                className={cx('seg__item', sort === 'match' && 'is-active')}
                aria-pressed={sort === 'match'}
                onClick={() => setSort('match')}
              >
                匹配度优先
              </button>
              <button
                type="button"
                className={cx('seg__item', sort === 'time' && 'is-active')}
                aria-pressed={sort === 'time'}
                onClick={() => setSort('time')}
              >
                时间优先
              </button>
            </div>
          </div>
        </div>

        {ranked.length === 0 ? (
          <EmptyState
            icon={<Funnel size={22} aria-hidden="true" />}
            title={applied ? '没有符合当前条件的活动' : `${kindLabel}暂时没有可申请的活动`}
            description={
              applied
                ? '推荐列表会随条件变化。可以先放宽预算、换一个日期或清除类型限制 —— 每一项都会立刻生效。'
                : '换一类活动看看，或者自己发起一场，让同频的人来找你。'
            }
            action={
              applied ? (
                <div className={styles.emptyActions}>
                  {suggestions.map((item) => (
                    <Button key={item.label} variant="secondary" size="sm" onClick={item.action}>
                      {item.label}
                    </Button>
                  ))}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={clearPrefs}
                    iconLeft={<RotateCcw size={14} aria-hidden="true" />}
                  >
                    一键清除全部条件
                  </Button>
                  <Button variant="ghost" size="sm" to="/create">
                    自己发起一场
                  </Button>
                </div>
              ) : (
                <div className={styles.emptyActions}>
                  <Button
                    variant="primary"
                    onClick={() => setKind(kind === 'group' ? 'individual' : 'group')}
                  >
                    看看{kind === 'group' ? '个人活动' : '社群活动'}
                  </Button>
                  <Button variant="secondary" to="/create">
                    发起一场
                  </Button>
                </div>
              )
            }
          />
        ) : (
          <div className={styles.buddyList}>
            {ranked.map(({ activity, rec }) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                variant="list"
                recommendation={rec.reasons}
                footer={
                  <div className={styles.cardFoot}>
                    <span className={styles.score}>
                      <Target size={12} aria-hidden="true" />
                      匹配度 {rec.score}
                    </span>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>

      <p className={styles.demoNote}>
        <Info size={14} aria-hidden="true" />
        演示数据 · 本地模拟：活动、用户与匹配分数全部由本地示例数据计算，分数仅用于演示推荐排序，不代表真实匹配效果。
      </p>

      {/* ---------------------------------------------------------- 偏好面板 */}
      <Modal
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        title="匹配偏好"
        description={`选择你想要的${kindLabel}方式。提交后会立即重排下方的推荐列表，并显示每条推荐的匹配度和原因。`}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDraft(DEFAULT_PREFS)}
              iconLeft={<RotateCcw size={14} aria-hidden="true" />}
            >
              重置
            </Button>
            <Button variant="secondary" onClick={() => setPrefsOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={submitPrefs}
              iconLeft={<Sparkles size={15} aria-hidden="true" />}
            >
              立即匹配
            </Button>
          </>
        }
      >
        <div className={styles.prefForm}>
          <ChipSelect
            label="活动类型"
            options={CATEGORY_OPTIONS}
            value={draft.category}
            onChange={(value) => setDraft({ ...draft, category: value })}
          />
          <ChipSelect
            label="时间"
            options={TIME_OPTIONS}
            value={draft.time}
            onChange={(value) => setDraft({ ...draft, time: value })}
          />
          <ChipSelect
            label="预算上限"
            options={BUDGET_OPTIONS}
            value={draft.budgetMax}
            onChange={(value) => setDraft({ ...draft, budgetMax: value })}
          />
          <ChipSelect
            label="出行方式"
            options={TRANSPORT_OPTIONS}
            value={draft.transport}
            onChange={(value) => setDraft({ ...draft, transport: value })}
          />
          <p className={styles.prefHint}>
            预算按活动人均预估上限估算；「费用待协商」的活动不参与固定预算档筛选。
          </p>

          <label className={styles.seatsRow}>
            <input
              type="checkbox"
              checked={draft.onlySeats}
              onChange={(event) => setDraft({ ...draft, onlySeats: event.target.checked })}
            />
            <span>
              <span className={styles.seatsTitle}>只看还有剩余名额的活动</span>
              <span className={styles.seatsHint}>
                不勾选时，已满员的活动也会出现在列表里，卡片上会标注「已满员」
              </span>
            </span>
          </label>

          <p className={styles.preview} role="status" aria-live="polite">
            按当前选择，{kindLabel}里约有 <strong>{draftCount}</strong> 个活动可匹配
          </p>
        </div>
      </Modal>
    </div>
  );
}
