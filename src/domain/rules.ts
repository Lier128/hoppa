import type {
  Activity,
  ActivityDraft,
  ActivityStatus,
  Application,
  AppState,
  Message,
  Review,
} from '@/types';
import { ACTIVITY_STATUS_META } from '@/types';
import { isFuture, toDate } from '@/lib/date';

/**
 * 业务规则（纯函数，便于单元测试）
 *
 * 这些规则来自 PRD §6 / §8 / §13 与开发任务书 §5：
 * - 发起者自动成为组织者，不用申请自己的活动；
 * - 已通过人数不得超过人数上限；
 * - 满员 / 已取消 / 已结束 / 已开始的活动不能申请；
 * - 同一用户不能重复提交有效申请；
 * - 活动时间必须在未来；关键字段缺失不能发布；
 * - 只有活动结束后才允许评价，且每人每活动只能评价一次；
 * - 状态流转不允许跳跃。
 */

const ACTIVE_APPLICATION_STATUSES = new Set(['pending', 'approved']);

export function membersOf(state: Pick<AppState, 'members'>, activityId: string) {
  return state.members.filter((m) => m.activityId === activityId);
}

export function applicationsOf(state: Pick<AppState, 'applications'>, activityId: string) {
  return state.applications.filter((a) => a.activityId === activityId);
}

/** 参与人数 = 组织者 + 已通过成员（组织者计入人数上限） */
export function memberCount(state: Pick<AppState, 'members'>, activityId: string): number {
  return membersOf(state, activityId).length;
}

export function isFull(state: Pick<AppState, 'members'>, activity: Activity): boolean {
  return memberCount(state, activity.id) >= activity.maxParticipants;
}

export function remainingSeats(state: Pick<AppState, 'members'>, activity: Activity): number {
  return Math.max(0, activity.maxParticipants - memberCount(state, activity.id));
}

/** 当前用户对该活动的有效申请（pending / approved） */
export function activeApplicationOf(
  state: Pick<AppState, 'applications'>,
  activityId: string,
  userId: string,
): Application | undefined {
  return state.applications.find(
    (a) => a.activityId === activityId && a.userId === userId && ACTIVE_APPLICATION_STATUSES.has(a.status),
  );
}

export function latestApplicationOf(
  state: Pick<AppState, 'applications'>,
  activityId: string,
  userId: string,
): Application | undefined {
  const list = state.applications
    .filter((a) => a.activityId === activityId && a.userId === userId)
    .sort((a, b) => toDate(b.updatedAt).getTime() - toDate(a.updatedAt).getTime());
  return list[0];
}

export function isMemberOf(state: Pick<AppState, 'members'>, activityId: string, userId: string): boolean {
  return state.members.some((m) => m.activityId === activityId && m.userId === userId);
}

export type ApplyBlockCode = 'not_open' | 'cancelled' | 'ended' | 'started' | 'full' | 'duplicated' | 'self';

export interface ApplyEligibility {
  allowed: boolean;
  code?: ApplyBlockCode;
  reason?: string;
}

/** 能否申请加入 —— 详情页按钮状态与 reducer 共用同一套判断 */
export function canApply(
  state: Pick<AppState, 'activities' | 'applications' | 'members'>,
  activity: Activity,
  userId: string,
  now: Date = new Date(),
): ApplyEligibility {
  if (activity.organizerId === userId || isMemberOf(state, activity.id, userId)) {
    return { allowed: false, code: 'self', reason: '你是本活动的组织者 / 成员，无需申请' };
  }
  if (activity.status === 'cancelled') {
    return { allowed: false, code: 'cancelled', reason: '活动已取消，无法申请' };
  }
  if (activity.status === 'completed' || activity.status === 'awaiting_review') {
    return { allowed: false, code: 'ended', reason: '活动已结束，无法申请' };
  }
  if (activity.status === 'ongoing') {
    return { allowed: false, code: 'started', reason: '活动已开始，无法申请' };
  }
  if (activity.status !== 'preparing') {
    return { allowed: false, code: 'not_open', reason: '活动当前不可申请' };
  }
  if (!isFuture(activity.startAt, now)) {
    return { allowed: false, code: 'started', reason: '活动开始时间已过，无法申请' };
  }
  if (isFull(state, activity)) {
    return { allowed: false, code: 'full', reason: '名额已满' };
  }
  const existing = activeApplicationOf(state, activity.id, userId);
  if (existing) {
    return {
      allowed: false,
      code: 'duplicated',
      reason: existing.status === 'pending' ? '你已提交申请，等待组织者审核' : '你已加入该活动',
    };
  }
  return { allowed: true };
}

export type OrgAction = 'start' | 'finish' | 'cancel';

export interface OrgActionEligibility {
  allowed: boolean;
  reason?: string;
}

export function canOrganizerAct(
  activity: Activity,
  userId: string,
  action: OrgAction,
): OrgActionEligibility {
  if (activity.organizerId !== userId) {
    return { allowed: false, reason: '只有组织者可以操作' };
  }
  if (action === 'start') {
    if (activity.status !== 'preparing') return { allowed: false, reason: '只有「准备中」的活动可以开始' };
    return { allowed: true };
  }
  if (action === 'finish') {
    if (activity.status !== 'ongoing') return { allowed: false, reason: '只有「进行中」的活动可以结束' };
    return { allowed: true };
  }
  // cancel
  if (activity.status === 'cancelled') return { allowed: false, reason: '活动已取消' };
  if (activity.status === 'completed' || activity.status === 'awaiting_review') {
    return { allowed: false, reason: '活动已结束，不能取消' };
  }
  return { allowed: true };
}

/** 组织者通过申请：受人数上限约束 */
export function canApprove(
  state: Pick<AppState, 'members'>,
  activity: Activity,
): OrgActionEligibility {
  if (isFull(state, activity)) {
    return { allowed: false, reason: `名额已满（${activity.maxParticipants} 人），无法再通过申请` };
  }
  return { allowed: true };
}

/** 组织者是否可以修改集合地点 / 注意事项（仅准备中；已开始需通知成员，演示版不做） */
export function canEditActivity(activity: Activity, userId: string): OrgActionEligibility {
  if (activity.organizerId !== userId) {
    return { allowed: false, reason: '只有组织者可以修改活动信息' };
  }
  if (activity.status !== 'preparing') {
    return {
      allowed: false,
      reason:
        activity.status === 'cancelled'
          ? '活动已取消，不能再修改'
          : '活动已开始，修改集合信息需要通知成员，本演示版暂不支持',
    };
  }
  return { allowed: true };
}

export function canWithdrawApplication(activity: Activity, application: Application): OrgActionEligibility {  if (application.status !== 'pending') {
    return { allowed: false, reason: '只有待审核的申请可以撤回' };
  }
  if (activity.status === 'cancelled' || activity.status === 'completed') {
    return { allowed: false, reason: '活动已结束或已取消' };
  }
  return { allowed: true };
}

export function canLeaveActivity(
  state: Pick<AppState, 'members'>,
  activity: Activity,
  userId: string,
): OrgActionEligibility {
  if (activity.organizerId === userId) {
    return { allowed: false, reason: '组织者不能退出自己的活动，可在活动管理中取消活动' };
  }
  if (!isMemberOf(state, activity.id, userId)) {
    return { allowed: false, reason: '你还不是该活动成员' };
  }
  if (activity.status === 'completed' || activity.status === 'cancelled') {
    return { allowed: false, reason: '活动已结束或已取消，无需退出' };
  }
  return { allowed: true };
}

/** 评价资格：活动进入「待评价」后，已通过成员每人一次 */
export function canReview(
  state: Pick<AppState, 'reviews' | 'members'>,
  activity: Activity,
  userId: string,
  now: Date = new Date(),
): OrgActionEligibility {
  if (activity.status !== 'awaiting_review' && activity.status !== 'completed') {
    return {
      allowed: false,
      reason: activity.status === 'cancelled' ? '活动已取消，不能评价' : '活动结束后才可以评价',
    };
  }
  if (!isMemberOf(state, activity.id, userId)) {
    return { allowed: false, reason: '只有活动成员可以评价' };
  }
  if (!isPastStart(activity, now)) {
    return { allowed: false, reason: '活动尚未开始' };
  }
  if (state.reviews.some((r) => r.activityId === activity.id && r.reviewerId === userId)) {
    return { allowed: false, reason: '你已经评价过该活动' };
  }
  return { allowed: true };
}

function isPastStart(activity: Activity, now: Date): boolean {
  return toDate(activity.startAt).getTime() <= now.getTime() || activity.status === 'awaiting_review';
}

export function canCheckin(
  state: Pick<AppState, 'members' | 'checkins'>,
  activity: Activity,
  userId: string,
): OrgActionEligibility {
  if (activity.status !== 'ongoing') {
    return { allowed: false, reason: '活动进行中才可以签到' };
  }
  if (!isMemberOf(state, activity.id, userId)) {
    return { allowed: false, reason: '只有活动成员可以签到' };
  }
  if (state.checkins.some((c) => c.activityId === activity.id && c.userId === userId)) {
    return { allowed: false, reason: '你已经签到过了' };
  }
  return { allowed: true };
}

/** 展示用状态：把「待评价」按当前用户是否已评价折算成「已结束」 */
export function viewStatusFor(
  state: Pick<AppState, 'reviews'>,
  activity: Activity,
  userId: string,
): ActivityStatus {
  if (activity.status !== 'awaiting_review') return activity.status;
  const reviewed = state.reviews.some((r) => r.activityId === activity.id && r.reviewerId === userId);
  return reviewed ? 'completed' : 'awaiting_review';
}

export function statusLabel(status: ActivityStatus): string {
  return ACTIVITY_STATUS_META[status].label;
}

/** 只有活动成员（组织者 + 已通过）能进入群聊 */
export function conversationFor(
  state: Pick<AppState, 'conversations'>,
  activityId: string,
): AppState['conversations'][number] | undefined {
  return state.conversations.find((c) => c.activityId === activityId);
}

export function messagesFor(state: Pick<AppState, 'messages'>, conversationId: string): Message[] {
  return state.messages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime());
}

export function reviewOf(
  state: Pick<AppState, 'reviews'>,
  activityId: string,
  userId: string,
): Review | undefined {
  return state.reviews.find((r) => r.activityId === activityId && r.reviewerId === userId);
}

/** 我的活动 tab 归属 */
export type MyActivityTab = 'preparing' | 'ongoing' | 'awaiting_review' | 'completed' | 'organized';

export function myActivities(state: AppState, userId: string) {
  const memberActivityIds = new Set(
    state.members.filter((m) => m.userId === userId).map((m) => m.activityId),
  );
  const participating = state.activities.filter((a) => memberActivityIds.has(a.id));
  const organized = state.activities.filter((a) => a.organizerId === userId);
  return { participating, organized };
}

// ---------------------------------------------------------------- 表单校验

export type DraftErrors = Partial<Record<keyof ActivityDraft | 'startAt', string>>;

export function validateActivityDraft(draft: ActivityDraft, now: Date = new Date()): DraftErrors {
  const errors: DraftErrors = {};
  const title = draft.title.trim();
  if (title.length < 2 || title.length > 40) errors.title = '标题需为 2–40 个字符';
  if (!draft.category) errors.category = '请选择活动类型';
  if (!draft.date) errors.date = '请选择活动日期';
  if (!draft.startTime) errors.startTime = '请选择开始时间';
  if (draft.date && draft.startTime) {
    const start = new Date(`${draft.date}T${draft.startTime}:00`);
    if (Number.isNaN(start.getTime())) {
      errors.date = '日期格式不正确';
    } else if (start.getTime() <= now.getTime()) {
      errors.startAt = '活动开始时间必须在未来';
    }
  }
  const meeting = draft.meetingPoint.trim();
  if (meeting.length < 2) errors.meetingPoint = '请填写集合地点（至少 2 个字符）';
  if (!Number.isFinite(draft.maxParticipants) || draft.maxParticipants < 2 || draft.maxParticipants > 30) {
    errors.maxParticipants = '人数上限需在 2–30 人之间';
  } else if (!Number.isInteger(draft.maxParticipants)) {
    errors.maxParticipants = '人数上限需为整数';
  }
  if (!draft.feeMode) errors.feeMode = '请选择费用方式';
  if (!Number.isFinite(draft.budgetMin) || draft.budgetMin < 0) errors.budgetMin = '预算不能为负数';
  if (!Number.isFinite(draft.budgetMax) || draft.budgetMax < 0) errors.budgetMax = '预算不能为负数';
  if (draft.budgetMax > 0 && draft.budgetMin > draft.budgetMax) {
    errors.budgetMax = '预算上限需不小于下限';
  }
  const desc = draft.description.trim();
  if (desc.length < 10 || desc.length > 500) errors.description = '活动介绍需为 10–500 个字符';
  if (draft.tags.length > 5) errors.tags = '兴趣标签最多 5 个';
  if (
    !Number.isFinite(draft.durationMinutes) ||
    draft.durationMinutes < 30 ||
    draft.durationMinutes > 12 * 60
  ) {
    errors.durationMinutes = '预计时长需在 30 分钟–12 小时之间';
  }
  return errors;
}

export function hasErrors(errors: DraftErrors): boolean {
  return Object.keys(errors).length > 0;
}
