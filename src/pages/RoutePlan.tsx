import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { canApply } from '@/domain/rules';
import { FEE_MODE_META, TRANSPORT_META } from '@/types';
import { budgetLabel, cx } from '@/lib/format';
import { clock, dateTimeRange, durationLabel, toDate } from '@/lib/date';
import { useApp } from '@/store/AppStore';
import { Avatar, Button, EmptyState, PageHead, Tag, useToast } from '@/components/ui';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Info,
  MapPin,
  Milestone,
  RotateCcw,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from '@/components/ui/icons';
import styles from './RoutePlan.module.css';

/** 静态示意图的节点坐标：只做视觉排布，不涉及任何真实地理坐标 */
function nodePositions(count: number): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 170, y: 100 }];
  const left = 36;
  const right = 304;
  const step = (right - left) / (count - 1);
  return Array.from({ length: count }, (_, index) => ({
    x: left + step * index,
    y: 100 + Math.sin(index * 1.15) * 34,
  }));
}

function routePath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return '';
  const first = points[0]!;
  let d = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!;
    const current = points[i]!;
    const midX = (prev.x + current.x) / 2;
    d += ` C ${midX.toFixed(1)} ${prev.y.toFixed(1)}, ${midX.toFixed(1)} ${current.y.toFixed(1)}, ${current.x.toFixed(1)} ${current.y.toFixed(1)}`;
  }
  return d;
}

export default function RoutePlanPage() {
  const { id = '' } = useParams();
  const { state, now, currentUser, userById, activityById } = useApp();
  const toast = useToast();
  const activity = activityById(id);

  // 「已到达」只保存在本页面组件内：刷新即重置，不写 localStorage、不读取定位
  const [arrived, setArrived] = useState<number[]>([]);
  useEffect(() => {
    setArrived([]);
  }, [id]);

  if (!activity) {
    return (
      <div className="page">
        <EmptyState
          icon={<Search size={22} />}
          title="找不到这个活动"
          description={`链接里的活动 ID「${id}」没有对应的演示数据，无法展示路线。`}
          action={<Button to="/">返回首页</Button>}
        />
      </div>
    );
  }

  const organizer = userById(activity.organizerId);
  const points = activity.routePoints;
  const eligibility = canApply(state, activity, currentUser.id, now);
  const isMember = state.members.some((m) => m.activityId === activity.id && m.userId === currentUser.id);
  const startTime = toDate(activity.startAt);
  const totalStay = points.reduce((sum, point) => sum + point.stayMinutes, 0);
  const durationMinutes = Math.round((toDate(activity.endAt).getTime() - startTime.getTime()) / 60_000);

  // 按「建议停留」静态推算计划到达时间，仅作演示参考
  let acc = 0;
  const planned = points.map((point) => {
    const at = Number.isNaN(startTime.getTime()) ? null : new Date(startTime.getTime() + acc * 60_000);
    acc += point.stayMinutes;
    return { point, at: at && !Number.isNaN(at.getTime()) ? clock(at) : '时间待定' };
  });

  const positions = nodePositions(points.length);
  const path = routePath(positions);
  const allArrived = points.length > 0 && arrived.length === points.length;

  const markArrived = (index: number) => {
    if (arrived.includes(index)) return;
    setArrived((prev) => [...prev, index].sort((a, b) => a - b));
    toast.success(`已标记「${points[index]?.name ?? '节点'}」到达（演示）`);
  };

  return (
    <div className={cx('page', styles.pageRoot)}>
      <PageHead
        title="路线规划"
        sub={
          <span className={styles.subline}>
            {activity.title}
            <span className={styles.dot}>·</span>
            {activity.city}
            <span className={styles.dot}>·</span>
            {TRANSPORT_META[activity.transport]}
          </span>
        }
        backTo={`/activity/${activity.id}`}
        actions={
          <Tag tone="pink" outline>
            演示路线
          </Tag>
        }
      />

      <div className={cx('notice', 'notice--info', styles.topNotice)}>
        <Info size={16} aria-hidden="true" />
        <span>
          本页是<strong>静态示意图，非实时导航</strong>：不含实时路况、不读取定位、不显示真实地图与导航精度。
          节点顺序和停留时间来自组织者的计划。
        </span>
      </div>

      <div className={cx('stat-row', styles.stats)}>
        <div className="stat">
          <div className="stat__value">{points.length}</div>
          <div className="stat__label">路线节点</div>
        </div>
        <div className="stat">
          <div className="stat__value">{durationLabel(durationMinutes)}</div>
          <div className="stat__label">活动总时长</div>
        </div>
        <div className="stat">
          <div className="stat__value">{TRANSPORT_META[activity.transport]}</div>
          <div className="stat__label">出行方式</div>
        </div>
      </div>

      {points.length === 0 ? (
        <div className={styles.emptyWrap}>
          <EmptyState
            icon={<RouteIcon size={22} />}
            title="本活动没有路线节点"
            description="组织者只填写了集合地点，没有规划路线。集合信息可以在活动详情里查看。"
            action={
              <Button to={`/activity/${activity.id}`} variant="secondary">
                返回活动详情
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {/* 静态路线示意 */}
          <section className={cx('card', 'card--pad', styles.section)} aria-labelledby="route-map">
            <div className={cx('row', 'row--between', styles.sectionHead)}>
              <h2 className={styles.sectionTitle} id="route-map">
                <RouteIcon size={17} aria-hidden="true" />
                路线示意
              </h2>
              <span className="demo-badge">静态示意图 · 非实时导航</span>
            </div>

            <div className={styles.mapWrap}>
              <div className={styles.mapCity}>
                <MapPin size={13} aria-hidden="true" />
                {activity.city}
              </div>
              <svg
                className={styles.map}
                viewBox="0 0 340 200"
                role="img"
                aria-label={`路线示意图：${points.map((point, index) => `${index + 1}. ${point.name}`).join('，')}`}
              >
                {/* 装饰性背景网格：纯 CSS/SVG 自绘，不引用任何地图瓦片 */}
                <g aria-hidden="true">
                  {[40, 80, 120, 160].map((y) => (
                    <line key={`h${y}`} x1="16" y1={y} x2="324" y2={y} className={styles.gridLine} />
                  ))}
                  {[60, 120, 180, 240, 300].map((x) => (
                    <line key={`v${x}`} x1={x} y1="18" x2={x} y2="182" className={styles.gridLine} />
                  ))}
                </g>

                {path && <path d={path} className={styles.pathShadow} />}
                {path && <path d={path} className={styles.path} />}

                {positions.map((position, index) => {
                  const done = arrived.includes(index);
                  const point = points[index]!;
                  return (
                    <g key={point.id}>
                      <circle
                        cx={position.x}
                        cy={position.y}
                        r="14"
                        className={cx(styles.node, done && styles.nodeDone)}
                      />
                      <text x={position.x} y={position.y + 4} textAnchor="middle" className={styles.nodeNum}>
                        {index + 1}
                      </text>
                      <text x={position.x} y={position.y + 30} textAnchor="middle" className={styles.nodeLabel}>
                        {point.name.length > 5 ? `${point.name.slice(0, 5)}…` : point.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className={styles.mapFoot}>
              <span className="tiny faint">编号顺序 = 下方节点时间线顺序；圆形节点仅表示先后关系。</span>
              {arrived.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  iconLeft={<RotateCcw size={14} aria-hidden="true" />}
                  onClick={() => {
                    setArrived([]);
                    toast.info('已清除本页的「已到达」标记（演示）');
                  }}
                >
                  清除演示标记
                </Button>
              )}
            </div>
          </section>

          {/* 节点时间线 */}
          <section className={cx('card', 'card--pad', styles.section)} aria-labelledby="route-nodes">
            <div className={cx('row', 'row--between', styles.sectionHead)}>
              <h2 className={styles.sectionTitle} id="route-nodes">
                <Milestone size={17} aria-hidden="true" />
                节点时间线
              </h2>
              <span className="tiny faint">
                已标记 {arrived.length}/{points.length}
              </span>
            </div>

            <div className={cx('notice', 'notice--warn', styles.markNotice)}>
              <Info size={15} aria-hidden="true" />
              <span>
                「标记已到达」是<strong>演示交互</strong>：只在当前页面记录，刷新后重置，不读取 GPS、
                不上传任何位置数据，也不会通知组织者。
              </span>
            </div>

            <ol className="timeline">
              {planned.map(({ point, at }, index) => {
                const done = arrived.includes(index);
                return (
                  <li key={point.id} className="timeline__item">
                    <div className={styles.nodeHead}>
                      <span className={styles.nodeTitle}>
                        <span className={cx(styles.nodeIndex, done && styles.nodeIndexDone)}>
                          {done ? <Check size={12} aria-hidden="true" /> : index + 1}
                        </span>
                        {point.name}
                      </span>
                      {done ? (
                        <Tag tone="green" icon={<Check size={12} aria-hidden="true" />}>
                          已到达（演示）
                        </Tag>
                      ) : (
                        <Button size="sm" variant="soft" onClick={() => markArrived(index)}>
                          标记已到达
                        </Button>
                      )}
                    </div>
                    <p className={styles.nodeNote}>{point.note}</p>
                    <div className="timeline__meta">
                      建议停留 {durationLabel(point.stayMinutes)} · 计划到达约 {at}（按建议停留推算）
                    </div>
                  </li>
                );
              })}
            </ol>

            {allArrived && (
              <div className={cx('notice', 'notice--success', styles.markNotice)}>
                <Check size={15} aria-hidden="true" />
                <span>已把全部节点标记为到达（演示）。这些标记不会同步给组织者或其他成员。</span>
              </div>
            )}
          </section>
        </>
      )}

      {/* 集合信息 */}
      <section className={cx('card', 'card--pad', styles.section)} aria-labelledby="route-meet">
        <h2 className={styles.sectionTitle} id="route-meet">
          <CalendarDays size={17} aria-hidden="true" />
          集合与费用
        </h2>
        <div className="meta-list">
          <div className="meta-item">
            <Clock size={16} className="meta-item__icon" aria-hidden="true" />
            <span className="meta-item__label">时间</span>
            <span className="meta-item__value">{dateTimeRange(activity.startAt, activity.endAt)}</span>
          </div>
          <div className="meta-item">
            <MapPin size={16} className="meta-item__icon" aria-hidden="true" />
            <span className="meta-item__label">集合</span>
            <span className="meta-item__value">{activity.meetingPoint}</span>
          </div>
          <div className="meta-item">
            <Users size={16} className="meta-item__icon" aria-hidden="true" />
            <span className="meta-item__label">组织者</span>
            <span className="meta-item__value">
              <span className="row" style={{ gap: 6 }}>
                <Avatar user={organizer} size="xs" />
                {organizer?.nickname ?? '演示用户'}
              </span>
            </span>
          </div>
          <div className="meta-item">
            <Info size={16} className="meta-item__icon" aria-hidden="true" />
            <span className="meta-item__label">费用</span>
            <span className="meta-item__value">
              {budgetLabel(activity)}
              <span className={styles.valueHint}>
                {FEE_MODE_META[activity.feeMode].label}：{FEE_MODE_META[activity.feeMode].hint}
                ，预算为人均预估，不构成支付承诺
              </span>
            </span>
          </div>
        </div>
        <p className={styles.totalStay}>
          节点建议停留合计 {durationLabel(totalStay)}；与活动总时长 {durationLabel(durationMinutes)}{' '}
          的差值用于集合、路上移动和临时调整。
        </p>
      </section>

      {/* 加入我的活动 */}
      <section className={cx('card', 'card--pad', styles.section)} aria-labelledby="route-join">
        <h2 className={styles.sectionTitle} id="route-join">
          <UserPlus size={17} aria-hidden="true" />
          加入我的活动
        </h2>

        {eligibility.allowed ? (
          <>
            <p className={styles.joinText}>
              这条路线来自活动「{activity.title}」。参加活动需要回到活动详情提交申请，由组织者审核通过后
              才会出现在「我的活动」并进入群聊——本页不会直接把你加入活动。
            </p>
            <div className={styles.joinActions}>
              <Button to={`/activity/${activity.id}`} iconRight={<ArrowRight size={15} aria-hidden="true" />}>
                加入我的活动
              </Button>
              <Button
                to={`/safety/${activity.id}`}
                variant="secondary"
                iconLeft={<ShieldCheck size={15} aria-hidden="true" />}
              >
                安全中心
              </Button>
            </div>
            <p className={cx('tiny', 'faint', styles.joinHint)}>
              按钮会跳转到活动详情页的申请流程，不会伪造「加入成功」。
            </p>
          </>
        ) : (
          <>
            <div className={cx('notice', 'notice--info', styles.markNotice)}>
              <Info size={15} aria-hidden="true" />
              <span>{eligibility.reason ?? '当前无法加入该活动。'}</span>
            </div>
            <div className={styles.joinActions}>
              <Button disabled aria-disabled="true" iconLeft={<UserPlus size={15} aria-hidden="true" />}>
                加入我的活动
              </Button>
              <Button
                to={`/activity/${activity.id}`}
                variant="secondary"
                iconLeft={<RouteIcon size={15} aria-hidden="true" />}
              >
                返回活动详情
              </Button>
            </div>
            {isMember && (
              <p className={cx('tiny', 'faint', styles.joinHint)}>
                你已经是本活动成员，可以在活动详情页进入群聊。
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
