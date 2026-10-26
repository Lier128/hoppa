import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Activity, Application } from '@/types';
import { useApp } from '@/store/AppStore';
import {
  canOrganizerAct,
  isMemberOf,
  latestApplicationOf,
  myActivities,
  viewStatusFor,
  type MyActivityTab,
} from '@/domain/rules';
import { ActivityCard } from '@/components/activity/ActivityCard';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  PageHead,
  StatusTag,
  Tag,
  useToast,
} from '@/components/ui';
import {
  Award,
  CalendarClock,
  Check,
  CirclePlay,
  ClipboardList,
  Clock,
  Crown,
  LogOut,
  MessageCircle,
  Plus,
  QrCode,
  Rocket,
  Route,
  ShieldCheck,
  Star,
  TriangleAlert,
  Users,
  type LucideIcon,
} from '@/components/ui/icons';
import { cx } from '@/lib/format';
import styles from './MyActivities.module.css';

const TABS: Array<{ value: MyActivityTab; label: string }> = [
  { value: 'preparing', label: '准备中' },
  { value: 'ongoing', label: '进行中' },
  { value: 'awaiting_review', label: '待评价' },
  { value: 'completed', label: '已结束' },
  { value: 'organized', label: '我发起的' },
];

const TAB_HINT: Record<MyActivityTab, string> = {
  preparing: '已经加入或申请中、等待开始的活动',
  ongoing: '正在发生，可以签到与查看路线',
  awaiting_review: '活动已结束，等待你留下评价',
  completed: '已完成或已取消的活动；已评价的会归到这里',
  organized: '你发起的活动，可审核申请与取消活动',
};

const EMPTY_STATE: Record<
  MyActivityTab,
  { icon: LucideIcon; title: string; description: string }
> = {
  preparing: {
    icon: CalendarClock,
    title: '还没有准备中的活动',
    description: '去「找搭子」看看这周末有什么，或者自己发起一场。',
  },
  ongoing: {
    icon: CirclePlay,
    title: '没有正在进行中的活动',
    description: '活动开始后，签到、路线和安全中心会出现在这里。',
  },
  awaiting_review: {
    icon: Star,
    title: '没有待评价的活动',
    description: '活动结束后，记得回来留下这次的体验。',
  },
  completed: {
    icon: Award,
    title: '还没有结束的活动',
    description: '完成的城市记忆会沉淀在这里，可以生成旅行名片。',
  },
  organized: {
    icon: Rocket,
    title: '你还没有发起过活动',
    description: '把一个具体的周末计划写下来，更容易约到同频的人。',
  },
};

function timeOf(activity: Activity): number {
  const time = new Date(activity.startAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

function MyActivityCard({
  activity,
  tab,
  onLeave,
  onCancel,
}: {
  activity: Activity;
  tab: MyActivityTab;
  onLeave: (activity: Activity) => void;
  onCancel: (activity: Activity) => void;
}) {
  const navigate = useNavigate();
  const { state, currentUser, conversationOf, checkin, withdrawApplication } = useApp();
  const toast = useToast();

  const application = latestApplicationOf(state, activity.id, currentUser.id);
  const member = isMemberOf(state, activity.id, currentUser.id);
  const organizer = activity.organizerId === currentUser.id;
  const conversation = conversationOf(activity.id);
  const view = tab === 'organized' ? activity.status : viewStatusFor(state, activity, currentUser.id);
  const pendingCount = state.applications.filter(
    (item) => item.activityId === activity.id && item.status === 'pending',
  ).length;
  const myCheckin = state.checkins.find(
    (item) => item.activityId === activity.id && item.userId === currentUser.id,
  );
  const cancelCheck = canOrganizerAct(activity, currentUser.id, 'cancel');

  const handleCheckin = () => {
    const result = checkin(activity.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('模拟签到成功，已记录（演示）');
  };

  const handleWithdraw = (target: Application) => {
    const result = withdrawApplication(target.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('申请已撤回');
  };

  const roleTag = organizer ? (
    <Tag tone="violet" icon={<Crown size={11} aria-hidden="true" />}>
      组织者
    </Tag>
  ) : member ? (
    <Tag tone="pink">参与者</Tag>
  ) : application?.status === 'pending' ? (
    <Tag tone="amber">待审核</Tag>
  ) : null;

  let hint: string | null = null;
  if (tab === 'preparing') {
    if (organizer) hint = '你是组织者：可在管理页审核申请、查看成员。';
    else if (member) hint = '已加入：可在群聊里和组织者确认细节。';
    else if (application?.status === 'pending') hint = '申请待组织者审核，可随时撤回。';
  } else if (tab === 'ongoing') {
    hint = myCheckin
      ? '已签到：继续查看路线或安全中心。'
      : '模拟签到只记录本地状态，不会获取真实定位。';
  } else if (tab === 'awaiting_review') {
    hint = '评价提交后，这次活动会显示为已结束。';
  } else if (tab === 'completed') {
    hint =
      activity.status === 'cancelled'
        ? '活动已取消，不再提供评价与旅行名片。'
        : '旅行名片可复制分享文案。';
  } else if (tab === 'organized') {
    hint = pendingCount > 0 ? `${pendingCount} 条申请等待你处理。` : '暂无待审核申请。';
  }

  return (
    <ActivityCard
      activity={activity}
      variant="list"
      showStatus={false}
      footer={
        <div className={styles.cardFoot}>
          <div className={styles.footTop}>
            <StatusTag status={view} />
            {roleTag}
          </div>

          <div
            className={styles.footActions}
            onClick={(event) => {
              // footer 在 ActivityCard 的 <Link> 内部：阻止冒泡，避免点按钮时同时跳详情
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {tab === 'preparing' && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/activity/${activity.id}`)}
                >
                  查看详情
                </Button>
                {organizer && (
                  <Button
                    size="sm"
                    iconLeft={<ClipboardList size={14} aria-hidden="true" />}
                    onClick={() => navigate(`/manage/${activity.id}`)}
                  >
                    管理申请{pendingCount > 0 ? `（${pendingCount}）` : ''}
                  </Button>
                )}
                {member && conversation && (
                  <Button
                    size="sm"
                    variant="soft"
                    iconLeft={<MessageCircle size={14} aria-hidden="true" />}
                    onClick={() => navigate(`/messages/${conversation.id}`)}
                  >
                    进入群聊
                  </Button>
                )}
                {!organizer && member && (
                  <Button
                    size="sm"
                    variant="danger-soft"
                    iconLeft={<LogOut size={14} aria-hidden="true" />}
                    onClick={() => onLeave(activity)}
                  >
                    退出活动
                  </Button>
                )}
                {!member && application?.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled
                      iconLeft={<Clock size={14} aria-hidden="true" />}
                    >
                      待审核
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleWithdraw(application)}>
                      撤回申请
                    </Button>
                  </>
                )}
              </>
            )}

            {tab === 'ongoing' && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  iconLeft={<Route size={14} aria-hidden="true" />}
                  onClick={() => navigate(`/route/${activity.id}`)}
                >
                  查看路线
                </Button>
                {myCheckin ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled
                    iconLeft={<Check size={14} aria-hidden="true" />}
                  >
                    已签到
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    iconLeft={<QrCode size={14} aria-hidden="true" />}
                    onClick={handleCheckin}
                  >
                    模拟签到
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  iconLeft={<ShieldCheck size={14} aria-hidden="true" />}
                  onClick={() => navigate(`/safety/${activity.id}`)}
                >
                  安全中心
                </Button>
                {member && conversation && (
                  <Button
                    size="sm"
                    variant="soft"
                    iconLeft={<MessageCircle size={14} aria-hidden="true" />}
                    onClick={() => navigate(`/messages/${conversation.id}`)}
                  >
                    进入群聊
                  </Button>
                )}
              </>
            )}

            {tab === 'awaiting_review' && (
              <>
                <Button
                  size="sm"
                  iconLeft={<Star size={14} aria-hidden="true" />}
                  onClick={() => navigate(`/review/${activity.id}`)}
                >
                  去评价
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/activity/${activity.id}`)}
                >
                  查看详情
                </Button>
              </>
            )}

            {tab === 'completed' && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/activity/${activity.id}`)}
                >
                  查看详情
                </Button>
                {activity.status !== 'cancelled' && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      iconLeft={<Star size={14} aria-hidden="true" />}
                      onClick={() => navigate(`/review/${activity.id}`)}
                    >
                      查看评价
                    </Button>
                    <Button
                      size="sm"
                      variant="soft"
                      iconLeft={<Award size={14} aria-hidden="true" />}
                      onClick={() => navigate(`/card/${activity.id}`)}
                    >
                      旅行名片
                    </Button>
                  </>
                )}
              </>
            )}

            {tab === 'organized' && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/activity/${activity.id}`)}
                >
                  查看详情
                </Button>
                <Button
                  size="sm"
                  iconLeft={<ClipboardList size={14} aria-hidden="true" />}
                  onClick={() => navigate(`/manage/${activity.id}`)}
                >
                  管理申请{pendingCount > 0 ? `（${pendingCount}）` : ''}
                </Button>
                <Button
                  size="sm"
                  variant="danger-soft"
                  iconLeft={<TriangleAlert size={14} aria-hidden="true" />}
                  disabled={!cancelCheck.allowed}
                  title={cancelCheck.reason ?? '取消活动'}
                  onClick={() => onCancel(activity)}
                >
                  取消活动
                </Button>
              </>
            )}
          </div>

          {hint && <p className={styles.footHint}>{hint}</p>}
        </div>
      }
    />
  );
}

export default function MyActivitiesPage() {
  const { state, currentUser, track, leaveActivity, cancelActivity } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState<MyActivityTab>('preparing');
  const [confirm, setConfirm] = useState<{ kind: 'leave' | 'cancel'; activity: Activity } | null>(
    null,
  );

  const { participating, organized } = useMemo(
    () => myActivities(state, currentUser.id),
    [state, currentUser.id],
  );

  const pendingActivityIds = useMemo(
    () =>
      new Set(
        state.applications
          .filter((item) => item.userId === currentUser.id && item.status === 'pending')
          .map((item) => item.activityId),
      ),
    [state.applications, currentUser.id],
  );

  // 「我的活动」也要让我看到「已提交但还没成为成员」的申请，否则悬空的待审核申请没有入口
  const participatingWithPending = useMemo(() => {
    const memberIds = new Set(participating.map((activity) => activity.id));
    const pendingOnly = state.activities.filter(
      (activity) => pendingActivityIds.has(activity.id) && !memberIds.has(activity.id),
    );
    return [...participating, ...pendingOnly];
  }, [participating, pendingActivityIds, state.activities]);

  const list = useMemo(() => {
    if (tab === 'organized') {
      return [...organized].sort((a, b) => timeOf(b) - timeOf(a));
    }
    const filtered = participatingWithPending.filter((activity) => {
      const view = viewStatusFor(state, activity, currentUser.id);
      if (tab === 'completed') return view === 'completed' || view === 'cancelled';
      return view === tab;
    });
    const upcoming = tab === 'preparing' || tab === 'ongoing';
    return filtered.sort((a, b) => (upcoming ? timeOf(a) - timeOf(b) : timeOf(b) - timeOf(a)));
  }, [tab, organized, participatingWithPending, state, currentUser.id]);

  const changeTab = (value: MyActivityTab) => {
    if (value === tab) return;
    setTab(value);
    track('my_activities_tab', { tab: value });
  };

  const handleConfirm = () => {
    if (!confirm) return;
    const { kind, activity } = confirm;
    const result = kind === 'leave' ? leaveActivity(activity.id) : cancelActivity(activity.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(kind === 'leave' ? '已退出活动' : '活动已取消，成员会看到取消状态');
    setConfirm(null);
  };

  const empty = EMPTY_STATE[tab];
  const EmptyIcon = empty.icon;

  return (
    <div className="page">
      <PageHead
        title="我的活动"
        sub={`当前身份：${currentUser.nickname} · 参与 ${participating.length} 场 · 发起 ${organized.length} 场`}
        actions={
          <Button to="/create" iconLeft={<Plus size={15} aria-hidden="true" />}>
            发起活动
          </Button>
        }
      />

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="我的活动分类">
          <div className="seg">
            {TABS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={tab === item.value}
                className={cx('seg__item', tab === item.value && 'is-active')}
                onClick={() => changeTab(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <p className={styles.tabHint}>{TAB_HINT[tab]}</p>
      </div>

      {list.length > 0 ? (
        <div className={styles.list}>
          {list.map((activity) => (
            <MyActivityCard
              key={activity.id}
              activity={activity}
              tab={tab}
              onLeave={(target) => setConfirm({ kind: 'leave', activity: target })}
              onCancel={(target) => setConfirm({ kind: 'cancel', activity: target })}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<EmptyIcon size={22} aria-hidden="true" />}
          title={empty.title}
          description={empty.description}
          action={
            <div className={styles.emptyActions}>
              <Button to="/buddy" variant="secondary" iconLeft={<Users size={15} />}>
                去找搭子
              </Button>
              <Button to="/create" iconLeft={<Plus size={15} />}>
                发起活动
              </Button>
            </div>
          }
        />
      )}

      <ConfirmDialog
        open={confirm?.kind === 'leave'}
        title="退出这个活动？"
        description={
          confirm?.kind === 'leave' ? (
            <>
              「{confirm.activity.title}」退出后会释放你的名额，已通过的申请会变为「已退出」，重新加入需要再次申请。演示版会立即更新本地状态。
            </>
          ) : null
        }
        confirmText="退出活动"
        cancelText="再想想"
        danger
        onConfirm={handleConfirm}
        onClose={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm?.kind === 'cancel'}
        title="取消这个活动？"
        description={
          confirm?.kind === 'cancel' ? (
            <>
              「{confirm.activity.title}」取消后不会再接受申请，已加入的成员会在「我的活动」里看到「已取消」。真实产品会通知成员，但演示版不会发送真实推送，只更新本地状态。
            </>
          ) : null
        }
        confirmText="取消活动"
        cancelText="保留活动"
        danger
        onConfirm={handleConfirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
