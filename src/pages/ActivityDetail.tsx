import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ApplyBlockCode } from '@/domain/rules';
import {
  activeApplicationOf,
  canApply,
  canReview,
  canWithdrawApplication,
  isFull,
  latestApplicationOf,
  memberCount,
  remainingSeats,
  viewStatusFor,
} from '@/domain/rules';
import {
  ACTIVITY_STATUS_META,
  APPLICATION_STATUS_META,
  FEE_MODE_META,
  TRANSPORT_META,
} from '@/types';
import { countdownLabel, dateTimeRange, durationLabel, fromNowLabel, relativeDayTime, toDate } from '@/lib/date';
import { budgetLabel, cx, percent } from '@/lib/format';
import { useApp } from '@/store/AppStore';
import {
  Avatar,
  Button,
  CategoryTag,
  ConfirmDialog,
  Cover,
  EmptyState,
  Field,
  Modal,
  StatusTag,
  Tag,
  TextArea,
  useToast,
} from '@/components/ui';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Clock,
  Coins,
  Crown,
  Info,
  MapPin,
  MessageCircle,
  Play,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  Star,
  Timer,
  Undo2,
  UserPlus,
  Users,
} from '@/components/ui/icons';
import styles from './ActivityDetail.module.css';

/** 不能申请时按钮上的短文案；具体原因用 rules 返回的 reason，避免两套说法 */
const APPLY_BLOCK_LABEL: Record<ApplyBlockCode, string> = {
  not_open: '暂不可申请',
  cancelled: '活动已取消',
  ended: '活动已结束',
  started: '活动已开始',
  full: '名额已满',
  duplicated: '已提交申请',
  self: '你已加入',
};

type PrimarySpec = {
  label: string;
  hint?: string;
  variant: 'primary' | 'secondary' | 'soft';
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
};

type DetailNavState = { source_page?: string; from?: string } | null;

export default function ActivityDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    state,
    now,
    currentUser,
    userById,
    activityById,
    membersOf,
    apply,
    withdrawApplication,
    track,
  } = useApp();
  const toast = useToast();

  const activity = activityById(id);
  const organizer = activity ? userById(activity.organizerId) : undefined;
  const members = activity ? membersOf(activity.id) : [];

  const [applyOpen, setApplyOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [message, setMessage] = useState('');
  const messageId = useId();

  // 页面进入埋点：key 去重，避免 StrictMode 双挂载刷两条；换身份或活动状态变化算一次新浏览
  const navState = (location.state ?? null) as DetailNavState;
  const sourcePage = navState?.source_page ?? navState?.from ?? 'direct';
  const trackedKey = useRef('');
  useEffect(() => {
    if (!activity) return;
    const key = `${currentUser.id}:${activity.id}:${activity.status}`;
    if (trackedKey.current === key) return;
    trackedKey.current = key;
    track('activity_detail_view', {
      activity_id: activity.id,
      status: activity.status,
      source_page: sourcePage,
    });
  }, [activity, currentUser.id, sourcePage, track]);

  const goBack = () => {
    // location.key === 'default' 说明是直接打开（深链接 / 刷新），此时回首页而不是离开应用
    if (location.key !== 'default') navigate(-1);
    else navigate('/');
  };

  if (!activity) {
    return (
      <div className="page">
        <EmptyState
          icon={<Search size={22} />}
          title="找不到这个活动"
          description={`链接里的活动 ID「${id}」没有对应的演示数据，可能已被删除或链接不完整。`}
          action={<Button to="/">返回首页</Button>}
        />
      </div>
    );
  }

  // ------------------------------------------------------------ 派生状态
  const isOrganizer = activity.organizerId === currentUser.id;
  const myMembership = members.find((m) => m.userId === currentUser.id);
  const isMember = Boolean(myMembership);
  const activeApp = activeApplicationOf(state, activity.id, currentUser.id);
  const latestApp = latestApplicationOf(state, activity.id, currentUser.id);
  const eligibility = canApply(state, activity, currentUser.id, now);
  const reviewable = canReview(state, activity, currentUser.id, now);
  const viewStatus = viewStatusFor(state, activity, currentUser.id);
  const full = isFull(state, activity);
  const participantCount = memberCount(state, activity.id);
  const remaining = remainingSeats(state, activity);
  const durationMinutes = Math.round(
    (toDate(activity.endAt).getTime() - toDate(activity.startAt).getTime()) / 60_000,
  );
  const organizedCount = state.activities.filter((a) => a.organizerId === activity.organizerId).length;
  const organizerJoinedCount = state.members.filter((m) => m.userId === activity.organizerId).length;
  const canWithdraw = activeApp?.status === 'pending' ? canWithdrawApplication(activity, activeApp) : null;
  const memberRows = members
    .map((m) => ({ member: m, user: userById(m.userId) }))
    .sort((a, b) => (a.member.role === 'organizer' ? -1 : b.member.role === 'organizer' ? 1 : 0));

  // ------------------------------------------------------------ 主操作（桌面侧栏 / 移动底栏共用）
  const buildPrimary = (): PrimarySpec => {
    if (isOrganizer) {
      if (viewStatus === 'awaiting_review' && reviewable.allowed) {
        return {
          label: '去评价',
          to: `/review/${activity.id}`,
          variant: 'primary',
          icon: <Star size={16} aria-hidden="true" />,
          hint: '活动已结束，你的评价会帮助改进下一次活动。',
        };
      }
      if (viewStatus === 'completed') {
        return {
          label: '查看旅行名片',
          to: `/card/${activity.id}`,
          variant: 'primary',
          icon: <CalendarDays size={16} aria-hidden="true" />,
          hint: '活动已完成，可以查看本次回顾卡片。',
        };
      }
      return {
        label: '管理活动',
        to: `/manage/${activity.id}`,
        variant: 'primary',
        icon: <Crown size={16} aria-hidden="true" />,
        hint:
          activity.status === 'cancelled'
            ? '活动已取消，仍可在管理页查看申请与成员记录。'
            : '你是本活动组织者，可审核申请、推进状态。',
      };
    }

    if (isMember) {
      if (viewStatus === 'awaiting_review' && reviewable.allowed) {
        return {
          label: '去评价',
          to: `/review/${activity.id}`,
          variant: 'primary',
          icon: <Star size={16} aria-hidden="true" />,
          hint: '活动已结束，等待你留下评价。',
        };
      }
      if (viewStatus === 'completed') {
        return {
          label: '查看旅行名片',
          to: `/card/${activity.id}`,
          variant: 'primary',
          icon: <CalendarDays size={16} aria-hidden="true" />,
          hint: '活动已完成，可以查看本次回顾卡片。',
        };
      }
      if (viewStatus === 'cancelled') {
        return {
          label: '活动已取消',
          disabled: true,
          variant: 'secondary',
          hint: '活动已取消，可在群聊中查看组织者说明。',
        };
      }
      return {
        label: '进入群聊',
        to: '/messages',
        variant: 'primary',
        icon: <MessageCircle size={16} aria-hidden="true" />,
        hint:
          viewStatus === 'ongoing'
            ? '活动进行中，可在群聊里联系成员、确认集合进度。'
            : '你是本活动成员，群聊里可以沟通集合与细节。',
      };
    }

    if (activeApp?.status === 'pending') {
      return {
        label: '已申请，等待审核',
        disabled: true,
        variant: 'secondary',
        hint: '申请已提交，组织者审核后会同步到「我的活动」。',
      };
    }
    if (activity.status === 'cancelled') {
      return {
        label: '活动已取消',
        disabled: true,
        variant: 'secondary',
        hint: '已取消的活动不再接受申请。',
      };
    }
    if (viewStatus === 'awaiting_review' || viewStatus === 'completed') {
      return {
        label: '活动已结束',
        disabled: true,
        variant: 'secondary',
        hint: '已结束的活动不再接受申请。',
      };
    }
    if (activity.status === 'ongoing') {
      return {
        label: '活动已开始',
        disabled: true,
        variant: 'secondary',
        hint: '活动进行中，无法再加入。',
      };
    }
    if (eligibility.allowed) {
      return {
        label: '申请加入',
        onClick: () => setApplyOpen(true),
        variant: 'primary',
        icon: <UserPlus size={16} aria-hidden="true" />,
        hint: full ? '名额已满，无法申请。' : `还剩 ${remaining} 个名额，提交后由组织者审核。`,
      };
    }
    return {
      label: APPLY_BLOCK_LABEL[eligibility.code ?? 'not_open'],
      disabled: true,
      variant: 'secondary',
      hint: eligibility.reason ?? '当前无法申请。',
    };
  };

  const primarySpec = buildPrimary();

  const secondaryLinks: Array<{ to: string; label: string; icon: ReactNode }> = [
    {
      to: `/route/${activity.id}`,
      label: '查看路线',
      icon: <RouteIcon size={15} aria-hidden="true" />,
    },
    {
      to: `/safety/${activity.id}`,
      label: '安全中心',
      icon: <ShieldCheck size={15} aria-hidden="true" />,
    },
  ];
  if (isMember && primarySpec.to !== '/messages') {
    secondaryLinks.push({
      to: '/messages',
      label: '活动群聊',
      icon: <MessageCircle size={15} aria-hidden="true" />,
    });
  }
  if (isOrganizer && primarySpec.to !== `/manage/${activity.id}`) {
    secondaryLinks.push({
      to: `/manage/${activity.id}`,
      label: '管理活动',
      icon: <Crown size={15} aria-hidden="true" />,
    });
  }
  const visibleSecondary = secondaryLinks.filter((link) => link.to !== primarySpec.to);

  const renderPrimary = (block: boolean) => {
    const size = block ? 'lg' : 'md';
    if (primarySpec.disabled) {
      return (
        <Button variant={primarySpec.variant} size={size} block={block} disabled aria-disabled="true">
          {primarySpec.label}
        </Button>
      );
    }
    if (primarySpec.to) {
      return (
        <Button
          variant={primarySpec.variant}
          size={size}
          block={block}
          iconLeft={primarySpec.icon}
          to={primarySpec.to}
        >
          {primarySpec.label}
        </Button>
      );
    }
    return (
      <Button
        variant={primarySpec.variant}
        size={size}
        block={block}
        iconLeft={primarySpec.icon}
        onClick={primarySpec.onClick}
      >
        {primarySpec.label}
      </Button>
    );
  };

  // ------------------------------------------------------------ 申请 / 撤回
  const submitApplication = () => {
    const result = apply(activity.id, message);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    // join_apply_submit 由 store 内部上报，这里不再重复 track
    setMessage('');
    setApplyOpen(false);
    toast.success('申请已提交，等待组织者审核');
  };

  const doWithdraw = () => {
    if (!latestApp) return;
    const result = withdrawApplication(latestApp.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('申请已撤回');
  };

  return (
    <div className={cx('page', styles.pageRoot)}>
      <div className={styles.backRow}>
        <button type="button" className={styles.backLink} onClick={goBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          返回
        </button>
        <span className="demo-badge">演示数据</span>
      </div>

      <Cover activity={activity} height={220} iconSize={150} className={styles.cover}>
        <div className={styles.coverOverlay}>
          <div className="row row--wrap" style={{ gap: 6 }}>
            {isOrganizer && <span className="tag tag--glass">我发起的</span>}
            {full && activity.status === 'preparing' && <span className="tag tag--glass">已满员</span>}
            {viewStatus === 'ongoing' && <span className="tag tag--glass">活动进行中</span>}
          </div>
          <div className={styles.coverFoot}>
            <span className={styles.coverTime}>{relativeDayTime(activity.startAt, now)}</span>
            <span className={styles.coverPrice}>{budgetLabel(activity)}</span>
          </div>
        </div>
      </Cover>

      <header className={styles.head}>
        <div className="row row--wrap" style={{ gap: 6 }}>
          <StatusTag status={viewStatus} />
          <CategoryTag category={activity.category} />
          {activity.kind === 'individual' && <Tag tone="violet">个人活动</Tag>}
        </div>
        <h1 className={styles.title}>{activity.title}</h1>
        <div className={styles.subline}>
          <span className="row" style={{ gap: 6 }}>
            <Avatar user={organizer} size="xs" />
            <span>{organizer?.nickname ?? '演示用户'} 发起</span>
          </span>
          <span className={styles.dot}>·</span>
          <span>{activity.city}</span>
          <span className={styles.dot}>·</span>
          <span>{TRANSPORT_META[activity.transport]}</span>
          <span className={styles.dot}>·</span>
          <span>发起过 {organizedCount} 个活动</span>
        </div>
        {activity.tags.length > 0 && (
          <div className={styles.tagRow}>
            {activity.tags.map((tag) => (
              <Tag key={tag} tone="pink" outline>
                {tag}
              </Tag>
            ))}
          </div>
        )}
      </header>

      {activity.status === 'cancelled' && (
        <div className={cx('notice', 'notice--warn', styles.banner)}>
          <CircleAlert size={16} aria-hidden="true" />
          <span>
            <strong>活动已取消。</strong>组织者已停止本次活动，不再接受新的申请。
            {isMember
              ? '你仍可在群聊里查看组织者的说明；如涉及费用问题，可通过安全中心举报反馈。'
              : '如需反馈问题，可通过安全中心举报。'}
          </span>
        </div>
      )}

      {viewStatus === 'ongoing' && (
        <div className={cx('notice', 'notice--info', styles.banner)}>
          <Play size={16} aria-hidden="true" />
          <span>
            <strong>活动进行中。</strong>集合地点：{activity.meetingPoint}。
            {isMember
              ? '可以在群聊里联系成员，或进入安全中心查看线下安全提示。'
              : '活动已开始，无法再加入。'}
          </span>
        </div>
      )}

      {viewStatus === 'awaiting_review' && (
        <div className={cx('notice', 'notice--success', styles.banner)}>
          <Star size={16} aria-hidden="true" />
          <span>
            <strong>活动已结束，等待评价。</strong>
            {reviewable.allowed ? '提交评价后会同步到旅行名片。' : (reviewable.reason ?? '当前不可评价。')}
          </span>
        </div>
      )}

      {viewStatus === 'completed' && (
        <div className={cx('notice', 'notice--success', styles.banner)}>
          <CircleCheck size={16} aria-hidden="true" />
          <span>
            <strong>活动已完成。</strong>
            {isMember ? '详情会保留，你可以查看评价与旅行名片。' : '活动详情会保留，方便回顾。'}
          </span>
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.main}>
          {/* 关键信息 */}
          <section className={cx('card', 'card--pad')} aria-labelledby="detail-info">
            <h2 className={styles.blockTitle} id="detail-info">
              <CalendarDays size={17} aria-hidden="true" />
              关键信息
            </h2>
            <div className="meta-list">
              <div className="meta-item">
                <Clock size={16} className="meta-item__icon" aria-hidden="true" />
                <span className="meta-item__label">时间</span>
                <span className="meta-item__value">
                  {dateTimeRange(activity.startAt, activity.endAt)}
                  <span className={styles.valueHint}>
                    {activity.status === 'preparing'
                      ? countdownLabel(activity.startAt, now)
                      : ACTIVITY_STATUS_META[activity.status].hint}
                  </span>
                </span>
              </div>
              <div className="meta-item">
                <Timer size={16} className="meta-item__icon" aria-hidden="true" />
                <span className="meta-item__label">时长</span>
                <span className="meta-item__value">
                  {durationLabel(durationMinutes)}
                  <span className={styles.valueHint}>按开始与结束时间计算，仅供参考</span>
                </span>
              </div>
              <div className="meta-item">
                <MapPin size={16} className="meta-item__icon" aria-hidden="true" />
                <span className="meta-item__label">集合</span>
                <span className="meta-item__value">{activity.meetingPoint}</span>
              </div>
              <div className="meta-item">
                <Coins size={16} className="meta-item__icon" aria-hidden="true" />
                <span className="meta-item__label">费用</span>
                <span className="meta-item__value">
                  {budgetLabel(activity)}
                  <span className={styles.valueHint}>
                    {FEE_MODE_META[activity.feeMode].label}：{FEE_MODE_META[activity.feeMode].hint}
                    ，预算为人均预估，不构成支付承诺
                  </span>
                </span>
              </div>
              <div className="meta-item">
                <Users size={16} className="meta-item__icon" aria-hidden="true" />
                <span className="meta-item__label">人数</span>
                <span className="meta-item__value" style={{ flex: 1 }}>
                  {participantCount}/{activity.maxParticipants} 人
                  <span className={styles.valueHint}>
                    {full ? '名额已满' : `还剩 ${remaining} 个名额`} · 组织者计入人数上限
                  </span>
                  <span className="progress" style={{ display: 'block', marginTop: 8 }}>
                    <span
                      className="progress__bar"
                      style={{
                        display: 'block',
                        width: `${percent(participantCount, activity.maxParticipants)}%`,
                      }}
                    />
                  </span>
                </span>
              </div>
              <div className="meta-item">
                <RouteIcon size={16} className="meta-item__icon" aria-hidden="true" />
                <span className="meta-item__label">出行</span>
                <span className="meta-item__value">
                  {TRANSPORT_META[activity.transport]}
                  <span className={styles.valueHint}>
                    {activity.routePoints.length > 0
                      ? `含 ${activity.routePoints.length} 个路线节点`
                      : '本活动没有路线节点'}
                  </span>
                </span>
              </div>
            </div>
          </section>

          {/* 活动介绍 */}
          <section className={cx('card', 'card--pad')} aria-labelledby="detail-intro">
            <h2 className={styles.blockTitle} id="detail-intro">
              <Info size={17} aria-hidden="true" />
              活动介绍
            </h2>
            <p className={styles.paragraph}>{activity.description}</p>
            <div className={styles.notesBox}>
              <div className={styles.notesHead}>
                <CircleAlert size={15} aria-hidden="true" />
                注意事项
              </div>
              <p className={cx(styles.notesText, !activity.notes.trim() && 'faint')}>
                {activity.notes.trim() || '组织者没有填写额外的注意事项。'}
              </p>
            </div>
          </section>

          {/* 路线节点 */}
          <section className={cx('card', 'card--pad')} aria-labelledby="detail-route">
            <div className={cx('row', 'row--between', styles.blockHead)}>
              <h2 className={cx(styles.blockTitle, styles.blockTitleFlush)} id="detail-route">
                <RouteIcon size={17} aria-hidden="true" />
                路线节点
              </h2>
              <span className="tiny faint">
                {activity.routePoints.length > 0 ? `共 ${activity.routePoints.length} 个节点` : '未设置'}
              </span>
            </div>

            {activity.routePoints.length === 0 ? (
              <div className={cx('notice', 'notice--info', styles.emptyNode)}>
                <Info size={15} aria-hidden="true" />
                <span>本活动没有路线节点，集合地点就是唯一的集合信息。</span>
              </div>
            ) : (
              <>
                <ol className="timeline">
                  {activity.routePoints.slice(0, 3).map((point, index) => (
                    <li key={point.id} className="timeline__item">
                      <div className="timeline__title">
                        {index + 1}. {point.name}
                      </div>
                      <p className={styles.nodeNote}>{point.note}</p>
                      <div className="timeline__meta">建议停留 {durationLabel(point.stayMinutes)}</div>
                    </li>
                  ))}
                </ol>
                {activity.routePoints.length > 3 && (
                  <p className="tiny faint" style={{ marginTop: 2 }}>
                    还有 {activity.routePoints.length - 3} 个节点未展示。
                  </p>
                )}
                <div className={styles.blockFoot}>
                  <span className="tiny faint">节点顺序与停留时间为组织者的计划，非实时导航。</span>
                  <Button
                    to={`/route/${activity.id}`}
                    variant="soft"
                    size="sm"
                    iconRight={<ArrowRight size={14} aria-hidden="true" />}
                  >
                    查看完整路线
                  </Button>
                </div>
              </>
            )}
          </section>

          {/* 参与者 */}
          <section className={cx('card', 'card--pad')} aria-labelledby="detail-members">
            <div className={cx('row', 'row--between', styles.blockHead)}>
              <h2 className={cx(styles.blockTitle, styles.blockTitleFlush)} id="detail-members">
                <Users size={17} aria-hidden="true" />
                参与者
              </h2>
              <span className="tiny faint">
                共 {participantCount}/{activity.maxParticipants} 人
              </span>
            </div>

            {memberRows.length === 0 ? (
              <p className="tiny faint">还没有成员加入。</p>
            ) : (
              <ul className={styles.participants}>
                {memberRows.map(({ member, user }) => (
                  <li key={member.id} className={styles.participant}>
                    <Avatar user={user} size="md" />
                    <span className={styles.participantInfo}>
                      <span className={styles.participantName}>
                        {user?.nickname ?? '演示成员'}
                        {member.userId === currentUser.id && <span className="tag tag--pink">我</span>}
                      </span>
                      <span className={styles.participantRole}>
                        {member.role === 'organizer' ? '组织者' : '参与者'}
                        {member.attendance === 'checked_in' ? ' · 已签到' : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className={cx('tiny', 'faint', styles.memberNote)}>
              参与者信息均为演示数据，不包含手机号、住址等真实敏感信息。
            </p>
          </section>
        </div>

        {/* 桌面侧栏 */}
        <aside className={styles.side}>
          <section className={cx('card', 'card--pad')} aria-labelledby="detail-org">
            <h2 className={styles.blockTitle} id="detail-org">
              <Crown size={17} aria-hidden="true" />
              组织者
            </h2>
            <div className={styles.orgHead}>
              <Avatar user={organizer} size="lg" />
              <div style={{ minWidth: 0 }}>
                <div className={styles.orgName}>{organizer?.nickname ?? '演示用户'}</div>
                <div className={styles.orgMeta}>
                  发起 {organizedCount} 个活动 · 参与 {organizerJoinedCount} 次
                </div>
              </div>
            </div>
            {organizer?.bio ? (
              <p className={styles.orgBio}>{organizer.bio}</p>
            ) : (
              <p className={cx(styles.orgBio, 'faint')}>这位组织者还没有填写简介。</p>
            )}
            {organizer && organizer.tags.length > 0 && (
              <div className={styles.orgTags}>
                {organizer.tags.slice(0, 3).map((tag) => (
                  <Tag key={tag} outline>
                    {tag}
                  </Tag>
                ))}
              </div>
            )}
            <p className={styles.faintNote}>演示版暂不提供他人资料页，这里只做展示，不提供跳转。</p>
          </section>

          <section className={cx('card', 'card--pad', styles.actionCard)} aria-labelledby="detail-action">
            <h2 className={styles.blockTitle} id="detail-action">
              <UserPlus size={17} aria-hidden="true" />
              活动操作
            </h2>
            {primarySpec.hint && <p className={styles.actionHint}>{primarySpec.hint}</p>}
            {renderPrimary(false)}

            {latestApp && (
              <div className={styles.appBox}>
                <div className={styles.appHead}>
                  <span className={styles.appTitle}>我的申请</span>
                  <Tag tone={APPLICATION_STATUS_META[latestApp.status].tone}>
                    {APPLICATION_STATUS_META[latestApp.status].label}
                  </Tag>
                </div>
                {latestApp.message ? (
                  <p className={styles.appMessage}>「{latestApp.message}」</p>
                ) : (
                  <p className={cx(styles.appMessage, 'faint')}>这条申请没有填写留言。</p>
                )}
                <p className={styles.appMeta}>
                  {latestApp.status === 'pending' ? '已提交，等待组织者审核' : '状态已更新'} ·{' '}
                  {fromNowLabel(latestApp.updatedAt, now)}
                </p>
                {canWithdraw?.allowed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={<Undo2 size={14} aria-hidden="true" />}
                    onClick={() => setWithdrawOpen(true)}
                  >
                    撤回申请
                  </Button>
                )}
              </div>
            )}

            <div className={styles.secondaryList}>
              {visibleSecondary.map((link) => (
                <Button
                  key={link.to}
                  to={link.to}
                  variant="secondary"
                  size="sm"
                  block
                  iconLeft={link.icon}
                >
                  {link.label}
                </Button>
              ))}
            </div>

            <p className={styles.safetyStrip}>
              <ShieldCheck size={15} aria-hidden="true" />
              <span>出行前告知亲友行程，尽量结伴往返；紧急情况请直接拨打 110 / 120。</span>
            </p>
          </section>
        </aside>
      </div>

      {/* 移动端固定操作栏：定位在底部导航之上，页面已留出安全距离 */}
      <div className={styles.bottomBar} role="region" aria-label="活动主要操作">
        <div className={styles.bottomHint}>
          <span className={styles.bottomHintText}>
            {primarySpec.hint ?? ACTIVITY_STATUS_META[viewStatus].hint}
          </span>
          <span className={styles.bottomQuick}>
            <Link
              to={`/safety/${activity.id}`}
              className={styles.quickLink}
              aria-label="打开安全中心"
              title="安全中心"
            >
              <ShieldCheck size={17} aria-hidden="true" />
            </Link>
            <Link
              to={`/route/${activity.id}`}
              className={styles.quickLink}
              aria-label="查看路线"
              title="查看路线"
            >
              <RouteIcon size={17} aria-hidden="true" />
            </Link>
          </span>
        </div>
        <div className={styles.bottomAction}>{renderPrimary(true)}</div>
      </div>

      {/* 申请留言 */}
      <Modal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        title="申请加入活动"
        description="提交申请后由组织者审核，通过后会出现在「我的活动」并进入活动群聊。"
        footer={
          <>
            <Button variant="secondary" onClick={() => setApplyOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                setApplyOpen(false);
                setConfirmOpen(true);
              }}
              iconRight={<ArrowRight size={15} aria-hidden="true" />}
            >
              下一步：确认信息
            </Button>
          </>
        }
      >
        <div className="stack">
          <Field
            label="申请留言（选填）"
            htmlFor={messageId}
            hint={
              <span className={styles.fieldHintRow}>
                <span>写给组织者看的说明，通过后不可修改</span>
                <span className="mono">{message.length}/100</span>
              </span>
            }
          >
            <TextArea
              id={messageId}
              value={message}
              maxLength={100}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="简单介绍一下自己，或说明你能带什么、有什么需要提前说明的"
            />
          </Field>
          <p className="tiny faint">提交前还会再确认一次时间、地点与费用规则。</p>
        </div>
      </Modal>

      {/* 申请前确认：时间 / 地点 / 费用规则 */}
      <ConfirmDialog
        open={confirmOpen}
        title="确认申请信息"
        confirmText="提交申请"
        onClose={() => setConfirmOpen(false)}
        onConfirm={submitApplication}
        description={
          <span className={styles.confirmBlock}>
            <span className={styles.confirmRow}>
              <span className={styles.confirmLabel}>时间</span>
              <span className={styles.confirmValue}>
                {dateTimeRange(activity.startAt, activity.endAt)}
              </span>
            </span>
            <span className={styles.confirmRow}>
              <span className={styles.confirmLabel}>地点</span>
              <span className={styles.confirmValue}>{activity.meetingPoint}</span>
            </span>
            <span className={styles.confirmRow}>
              <span className={styles.confirmLabel}>费用</span>
              <span className={styles.confirmValue}>
                {budgetLabel(activity)}（{FEE_MODE_META[activity.feeMode].label}：
                {FEE_MODE_META[activity.feeMode].hint}）
              </span>
            </span>
            <span className={styles.confirmRow}>
              <span className={styles.confirmLabel}>人数</span>
              <span className={styles.confirmValue}>
                上限 {activity.maxParticipants} 人，目前已 {participantCount} 人
              </span>
            </span>
            <span className={styles.confirmNote}>
              请确认信息无误后再提交；提交后需要组织者审核。演示环境不会产生任何真实支付。
            </span>
          </span>
        }
      />

      <ConfirmDialog
        open={withdrawOpen}
        title="撤回这条申请？"
        description="撤回后组织者将看不到你的申请；如果活动仍可申请，你可以重新提交。"
        confirmText="撤回申请"
        danger
        onClose={() => setWithdrawOpen(false)}
        onConfirm={doWithdraw}
      />
    </div>
  );
}
