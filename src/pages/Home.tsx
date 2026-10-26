import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Activity, Category, Transport } from '@/types';
import { CATEGORIES, CATEGORY_META, TRANSPORTS, TRANSPORT_META } from '@/types';
import { useApp } from '@/store/AppStore';
import { ActivityCard } from '@/components/activity/ActivityCard';
import { Button, CategoryIcon, EmptyState, TextInput } from '@/components/ui';
import {
  ArrowRight,
  CalendarDays,
  Compass,
  Funnel,
  Info,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Users,
  Wallet,
  X,
} from '@/components/ui/icons';
import { addDays, isFuture, isSameDay, relativeDayTime, startOfDay } from '@/lib/date';
import { cx } from '@/lib/format';
import styles from './Home.module.css';

/**
 * 首页 / 发现（交互规格 §2.2 / HOP-001、HOP-002）
 *
 * 设计取舍：
 * - 主视觉用「品牌 slogan + 品类拼图」生成式视觉，不照抄参考截图里的横幅，也不引用真实照片；
 * - 搜索与筛选全部在前端对 seed 数据做真实过滤，结果条数实时可见；
 * - 品类入口点击后进入筛选态（再次点击取消）并滚动到结果区，避免「点了没反应」；
 * - 精选路线只展示关联活动的真实节点，不伪造路线页数据。
 */

type TimeFilter = 'any' | 'today' | 'tomorrow' | 'weekend';
type BudgetFilter = 'any' | 'free' | 'le50' | 'le100';
type TransportFilter = 'any' | Transport;

interface HomeFilters {
  category: Category | 'all';
  time: TimeFilter;
  budget: BudgetFilter;
  transport: TransportFilter;
}

const INITIAL_FILTERS: HomeFilters = {
  category: 'all',
  time: 'any',
  budget: 'any',
  transport: 'any',
};

const TIME_OPTIONS: ReadonlyArray<{ value: TimeFilter; label: string }> = [
  { value: 'any', label: '不限' },
  { value: 'today', label: '今天' },
  { value: 'tomorrow', label: '明天' },
  { value: 'weekend', label: '本周末' },
];

const BUDGET_OPTIONS: ReadonlyArray<{ value: BudgetFilter; label: string }> = [
  { value: 'any', label: '不限' },
  { value: 'free', label: '免费' },
  { value: 'le50', label: '≤ ¥50' },
  { value: 'le100', label: '≤ ¥100' },
];

const CATEGORY_OPTIONS: ReadonlyArray<{ value: Category | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  ...CATEGORIES.map((key) => ({ value: key, label: CATEGORY_META[key].label })),
];

const TRANSPORT_OPTIONS: ReadonlyArray<{ value: TransportFilter; label: string }> = [
  { value: 'any', label: '不限' },
  ...TRANSPORTS.map((key) => ({ value: key, label: TRANSPORT_META[key] })),
];

/** 精选路线：只做静态样例，节点与时间全部读取关联活动的真实数据 */
interface RouteCard {
  id: string;
  title: string;
  kicker: string;
  description: string;
  activityId: string;
  background: string;
  category: Category;
}

const ROUTE_CARDS: RouteCard[] = [
  {
    id: 'huanghelou',
    title: '黄鹤楼漫游',
    kicker: '路线样例 · 夜游',
    description:
      '黄昏从黄鹤楼西门上楼，看长江大桥与两江夜景；下山穿过司门口天桥，最后在户部巷挑三样小吃收尾。',
    activityId: 'a_huanghelou_night',
    background: 'var(--gradient-brand)',
    category: 'citywalk',
  },
  {
    id: 'donghu',
    title: '东湖绿道 City Walk',
    kicker: '路线样例 · 落日',
    description:
      '磨山北门出发，沿湖走 6 公里，在湖心亭收一场落日，听涛景区收队。全程平路，第一次参加也不会掉队。',
    activityId: 'a_donghu_sunset',
    background: 'var(--gradient-sunset)',
    category: 'citywalk',
  },
];

/** 本周末（周六 + 周日）对应的日期；今天是周六/周日时包含今天 */
function weekendDays(now: Date): Date[] {
  const today = startOfDay(now);
  const dow = today.getDay();
  if (dow === 6) return [today, startOfDay(addDays(today, 1))];
  if (dow === 0) return [today];
  const saturday = startOfDay(addDays(today, 6 - dow));
  return [saturday, startOfDay(addDays(saturday, 1))];
}

/** 预算筛选用的人均上限估算：免费 = 0；费用待协商且没填预算 = 无法估算 */
function budgetCap(activity: Activity): number {
  if (activity.feeMode === 'free') return 0;
  return activity.budgetMax || activity.budgetMin || Number.POSITIVE_INFINITY;
}

function matchesKeyword(activity: Activity, keyword: string): boolean {
  if (!keyword) return true;
  const haystack = [
    activity.title,
    activity.tags.join(' '),
    activity.meetingPoint,
    activity.description,
    CATEGORY_META[activity.category].label,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(keyword);
}

function filterActivities(
  activities: Activity[],
  filters: HomeFilters,
  keyword: string,
  now: Date,
): Activity[] {
  const kw = keyword.trim().toLowerCase();
  const weekend = filters.time === 'weekend' ? weekendDays(now) : [];
  const tomorrow = addDays(now, 1);
  return activities
    .filter((activity) => {
      if (filters.category !== 'all' && activity.category !== filters.category) return false;
      if (filters.transport !== 'any' && activity.transport !== filters.transport) return false;

      const start = new Date(activity.startAt);
      if (filters.time === 'today' && !isSameDay(start, now)) return false;
      if (filters.time === 'tomorrow' && !isSameDay(start, tomorrow)) return false;
      if (filters.time === 'weekend' && !weekend.some((day) => isSameDay(start, day))) return false;

      const cap = budgetCap(activity);
      if (filters.budget === 'free' && cap !== 0) return false;
      if (filters.budget === 'le50' && cap > 50) return false;
      if (filters.budget === 'le100' && cap > 100) return false;

      return matchesKeyword(activity, kw);
    })
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/** 一行可组合的筛选 chip；4 组筛选共用同一套样式与无障碍属性 */
function ChipRow<T extends string>({
  label,
  icon,
  options,
  value,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.filterRow}>
      <span className={styles.filterLabel}>
        {icon}
        {label}
      </span>
      <div className={styles.chipWrap} role="group" aria-label={`筛选${label}`}>
        {options.map((option) => (
          <button
            key={option.value}
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

export default function HomePage() {
  const { state, now, activityById, track } = useApp();
  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<HomeFilters>(INITIAL_FILTERS);
  const resultsRef = useRef<HTMLElement | null>(null);
  const trackedView = useRef(false);

  /** 首页默认只展示「准备中 + 未开始」的活动（HOP-001） */
  const baseActivities = useMemo(
    () =>
      state.activities.filter(
        (activity) => activity.status === 'preparing' && isFuture(activity.startAt, now),
      ),
    [state.activities, now],
  );

  const filtered = useMemo(
    () => filterActivities(baseActivities, filters, keyword, now),
    [baseActivities, filters, keyword, now],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<Category, number>();
    for (const activity of baseActivities) {
      counts.set(activity.category, (counts.get(activity.category) ?? 0) + 1);
    }
    return counts;
  }, [baseActivities]);

  const activeCount =
    (filters.category !== 'all' ? 1 : 0) +
    (filters.time !== 'any' ? 1 : 0) +
    (filters.budget !== 'any' ? 1 : 0) +
    (filters.transport !== 'any' ? 1 : 0);

  useEffect(() => {
    if (trackedView.current) return;
    trackedView.current = true;
    track('home_view', {
      page_name: 'home',
      city: '武汉',
      recruiting_count: baseActivities.length,
    });
  }, [track, baseActivities.length]);

  /** 每次筛选都上报 filter_apply：属性与埋点表口径一致，额外带结果数 */
  const updateFilters = (patch: Partial<HomeFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    track('filter_apply', {
      category: next.category,
      date_range: next.time,
      budget_range: next.budget,
      transport: next.transport,
      result_count: filterActivities(baseActivities, next, keyword, now).length,
    });
  };

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
    track('filter_apply', {
      category: 'all',
      date_range: 'any',
      budget_range: 'any',
      transport: 'any',
      result_count: filterActivities(baseActivities, INITIAL_FILTERS, keyword, now).length,
    });
  };

  const selectCategory = (category: Category | 'all') => {
    updateFilters({ category });
    window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  /** 已选条件 chip：点哪个就撤销哪个 */
  const activeChips: Array<{ label: string; onClear: () => void }> = [];
  if (filters.category !== 'all') {
    activeChips.push({
      label: `类型：${CATEGORY_META[filters.category].label}`,
      onClear: () => updateFilters({ category: 'all' }),
    });
  }
  if (filters.time !== 'any') {
    activeChips.push({
      label: `时间：${TIME_OPTIONS.find((option) => option.value === filters.time)?.label ?? ''}`,
      onClear: () => updateFilters({ time: 'any' }),
    });
  }
  if (filters.budget !== 'any') {
    activeChips.push({
      label: `预算：${BUDGET_OPTIONS.find((option) => option.value === filters.budget)?.label ?? ''}`,
      onClear: () => updateFilters({ budget: 'any' }),
    });
  }
  if (filters.transport !== 'any') {
    activeChips.push({
      label: `出行：${TRANSPORT_META[filters.transport]}`,
      onClear: () => updateFilters({ transport: 'any' }),
    });
  }

  const emptyDescription = keyword.trim()
    ? `没有找到与「${keyword.trim()}」匹配的活动，可以换个关键词，或者清除筛选看看全部活动。`
    : filters.time === 'today'
      ? '今天暂时没有正在招募的活动（演示数据安排在未来 2–8 天），可以换成明天或本周末。'
      : '当前组合条件下没有活动，可以一个个撤销条件，或直接清除筛选。';

  return (
    <div className={cx('page', styles.page)}>
      {/* ---------------------------------------------------------- 主视觉 */}
      <section className={styles.hero} aria-labelledby="home-slogan">
        <div className={styles.heroText}>
          <div className={styles.eyebrow}>
            <span className="demo-badge">演示数据 · 本地模拟</span>
            <span className={styles.cityChip}>
              <MapPin size={13} aria-hidden="true" />
              武汉
            </span>
          </div>
          <h1 className={styles.slogan} id="home-slogan">
            线上相遇，<span className={styles.sloganAccent}>线下来聚</span>
          </h1>
          <p className={styles.value}>
            把「周末有空」变成一场具体的小活动：找到同频的人，约在真实的地点，一起走一段路。
            先挑一场 City Walk、一顿饭或一局桌游，剩下的见面再说。
          </p>
          <div className={styles.heroActions}>
            <Button size="lg" to="/buddy" iconLeft={<Sparkles size={16} aria-hidden="true" />}>
              开始找搭子
            </Button>
            <Button
              size="lg"
              variant="secondary"
              to="/create"
              iconLeft={<Plus size={16} aria-hidden="true" />}
            >
              发布活动
            </Button>
          </div>
          <p className={styles.heroMeta}>
            <Users size={14} aria-hidden="true" />
            {baseActivities.length} 场活动正在招募 · 覆盖 6 个品类 · 所有数据保存在本地
          </p>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          <div
            className={cx(styles.heroTile, styles.tileMain)}
            style={{ background: CATEGORY_META.citywalk.gradient }}
          >
            <CategoryIcon category="citywalk" size={30} />
            <span>City Walk</span>
          </div>
          <div
            className={cx(styles.heroTile, styles.tileFood)}
            style={{ background: CATEGORY_META.food.gradient }}
          >
            <CategoryIcon category="food" size={24} />
          </div>
          <div
            className={cx(styles.heroTile, styles.tileExhibition)}
            style={{ background: CATEGORY_META.exhibition.gradient }}
          >
            <CategoryIcon category="exhibition" size={24} />
          </div>
          <div
            className={cx(styles.heroTile, styles.tileBoard)}
            style={{ background: CATEGORY_META.boardgame.gradient }}
          >
            <CategoryIcon category="boardgame" size={22} />
          </div>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeLabel}>拼图式周末</span>
            <strong className={styles.heroBadgeValue}>{baseActivities.length}</strong>
            <span className={styles.heroBadgeHint}>场活动正在招募</span>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- 搜索 */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={17} aria-hidden="true" className={styles.searchIcon} />
          <TextInput
            className={styles.searchInput}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索标题 / 标签 / 集合地点 / 描述，例如「东湖」「免费」"
            aria-label="搜索活动"
          />
          {keyword.trim() !== '' && (
            <button
              type="button"
              className={styles.clearSearch}
              onClick={() => setKeyword('')}
              aria-label="清空搜索关键词"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        <p className={styles.searchMeta} role="status" aria-live="polite">
          {keyword.trim()
            ? `关键词「${keyword.trim()}」匹配 ${filtered.length} 个活动`
            : `${filtered.length} 个活动可申请 · 按开始时间排序`}
        </p>
      </div>

      {/* ---------------------------------------------------------- 品类入口 */}
      <section className={styles.categorySection} aria-labelledby="home-categories">
        <div className="section__head">
          <h2 className="section__title" id="home-categories">
            按类型逛
          </h2>
          <span className="section__hint">点一下就能筛出同类活动，再点一次取消</span>
        </div>
        <div className={styles.categoryGrid}>
          {CATEGORIES.map((key) => {
            const meta = CATEGORY_META[key];
            const active = filters.category === key;
            const count = categoryCounts.get(key) ?? 0;
            return (
              <button
                key={key}
                type="button"
                className={cx(styles.categoryCard, active && styles.categoryCardActive)}
                aria-pressed={active}
                onClick={() => selectCategory(active ? 'all' : key)}
              >
                <span className={styles.categoryIcon} style={{ background: meta.gradient }}>
                  <CategoryIcon category={key} size={22} />
                </span>
                <span className={styles.categoryText}>
                  <span className={styles.categoryName}>{meta.label}</span>
                  <span className={styles.categoryDesc}>
                    {meta.short} · {count} 场正在招募
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------- 筛选 */}
      <section className="section" aria-labelledby="home-filter-title">
        <div className="section__head">
          <h2 className="section__title" id="home-filter-title">
            筛选活动
          </h2>
          <div className={styles.filterHeadActions}>
            {activeCount > 0 && <span className={styles.filterCount}>已选 {activeCount} 项</span>}
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              disabled={activeCount === 0}
              iconLeft={<RotateCcw size={14} aria-hidden="true" />}
            >
              清除筛选
            </Button>
          </div>
        </div>

        <div className={cx('card', styles.filterPanel)}>
          <ChipRow
            label="类型"
            icon={<Compass size={14} aria-hidden="true" />}
            options={CATEGORY_OPTIONS}
            value={filters.category}
            onChange={(value) => updateFilters({ category: value })}
          />
          <ChipRow
            label="时间"
            icon={<CalendarDays size={14} aria-hidden="true" />}
            options={TIME_OPTIONS}
            value={filters.time}
            onChange={(value) => updateFilters({ time: value })}
          />
          <ChipRow
            label="预算"
            icon={<Wallet size={14} aria-hidden="true" />}
            options={BUDGET_OPTIONS}
            value={filters.budget}
            onChange={(value) => updateFilters({ budget: value })}
          />
          <ChipRow
            label="出行方式"
            icon={<MapPin size={14} aria-hidden="true" />}
            options={TRANSPORT_OPTIONS}
            value={filters.transport}
            onChange={(value) => updateFilters({ transport: value })}
          />
          <p className={styles.filterHint}>
            预算按人均预估上限筛选；「费用待协商」的活动不计入固定预算档。条件可以自由组合，结果会实时变化。
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------- 活动列表 */}
      <section
        className="section"
        id="home-results"
        ref={resultsRef}
        aria-labelledby="home-results-title"
      >
        <div className="section__head">
          <h2 className="section__title" id="home-results-title">
            发现活动 <span className={styles.count}>{filtered.length}</span>
          </h2>
          <span className="section__hint">
            {activeCount > 0 ? `已应用 ${activeCount} 个筛选条件` : '默认展示准备中、未开始的活动'}
          </span>
        </div>

        {activeChips.length > 0 && (
          <div className={styles.activeBar}>
            <span className={styles.activeLabel}>已应用条件</span>
            <div className={styles.activeChips}>
              {activeChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className={styles.activeChip}
                  onClick={chip.onClear}
                >
                  {chip.label}
                  <X size={12} aria-hidden="true" />
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              iconLeft={<RotateCcw size={14} aria-hidden="true" />}
            >
              清除筛选
            </Button>
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Funnel size={22} aria-hidden="true" />}
            title="暂时没有符合条件的活动"
            description={emptyDescription}
            action={
              <div className={styles.emptyActions}>
                <Button
                  variant="primary"
                  onClick={resetFilters}
                  iconLeft={<RotateCcw size={15} aria-hidden="true" />}
                >
                  清除筛选
                </Button>
                {keyword.trim() !== '' && (
                  <Button variant="secondary" onClick={() => setKeyword('')}>
                    清空关键词
                  </Button>
                )}
                <Button variant="ghost" to="/create">
                  自己发起一场
                </Button>
              </div>
            }
          />
        ) : (
          <div className={styles.activityGrid}>
            {filtered.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        )}

        <div className={cx('card', styles.publishCard)}>
          <div>
            <h3 className={styles.publishTitle}>没找到想去的？</h3>
            <p className={styles.publishDesc}>
              花两分钟发起一场自己的小活动，写清时间、集合地点和预算，让同频的人来找你。
            </p>
          </div>
          <div className={styles.publishActions}>
            <Button to="/create" iconLeft={<Plus size={16} aria-hidden="true" />}>
              发布活动
            </Button>
            <Button to="/city" variant="ghost">
              先去同城逛逛
            </Button>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- 精选路线 */}
      <section className="section" aria-labelledby="home-routes-title">
        <div className="section__head">
          <h2 className="section__title" id="home-routes-title">
            精选路线
          </h2>
          <span className="section__hint">两条静态路线样例 · 节点与时间来自关联活动</span>
        </div>
        <div className={styles.routeGrid}>
          {ROUTE_CARDS.map((card) => {
            const activity = activityById(card.activityId);
            const nodes = activity?.routePoints ?? [];
            const to = activity ? `/activity/${activity.id}` : '/city';
            return (
              <Link key={card.id} to={to} className={cx(styles.routeCard, 'card card--hover')}>
                <div className={styles.routeArt} style={{ background: card.background }}>
                  <span className="tag tag--glass">{card.kicker}</span>
                  <span className={styles.routeArtIcon}>
                    <CategoryIcon category={card.category} size={30} />
                  </span>
                  <p className={styles.routeTitle}>{card.title}</p>
                </div>
                <div className={styles.routeBody}>
                  <p className={styles.routeDesc}>{card.description}</p>
                  {nodes.length > 0 ? (
                    <ol className={styles.routeNodes}>
                      {nodes.slice(0, 4).map((node, index) => (
                        <li key={node.id}>
                          <span className={styles.nodeIndex}>{index + 1}</span>
                          <span className={styles.nodeName}>{node.name}</span>
                          <span className={styles.nodeStay}>{node.stayMinutes} 分钟</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className={styles.routeEmpty}>该路线暂无关联活动，去同城看看别的灵感。</p>
                  )}
                  <div className={styles.routeFoot}>
                    <span className={styles.routeMeta}>
                      {activity
                        ? `${relativeDayTime(activity.startAt, now)} · ${nodes.length} 个节点`
                        : '去同城发现更多路线'}
                    </span>
                    <span className={styles.routeLink}>
                      {activity ? '查看关联活动' : '去同城看看'}
                      <ArrowRight size={14} aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <p className={styles.demoNote}>
        <Info size={14} aria-hidden="true" />
        演示数据 · 本地模拟：活动、用户、互动与封面视觉全部由本地示例数据生成，不连接真实服务，也不使用任何未授权照片。
      </p>
    </div>
  );
}
