import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import type {
  Activity,
  ActivityDraft,
  ActivityMember,
  AnalyticsEvent,
  AppState,
  Application,
  InteractionAction,
  Message,
  Report,
  ReportReason,
  Review,
  RoutePoint,
  User,
} from '@/types';
import { createInitialState } from '@/data/seed';
import { addMinutes, combineDateTime, localISO } from '@/lib/date';
import { uid } from '@/lib/id';
import { loadState, saveState } from '@/store/persistence';
import { reducer, type Action, type Decision } from '@/store/reducer';
import {
  canApprove,
  canApply,
  canCheckin,
  canEditActivity,
  canLeaveActivity,
  canOrganizerAct,
  canReview,
  canWithdrawApplication,
  hasErrors,
  validateActivityDraft,
} from '@/domain/rules';

export type ActionResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: string; field?: string };

export interface ReviewInput {
  rating: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  comment: string;
}

export interface ReportInput {
  targetType: Report['targetType'];
  targetId: string;
  reason: ReportReason;
  detail: string;
}

export interface AppContextValue {
  state: AppState;
  now: Date;
  currentUser: User;
  // ---- 查询
  userById: (id: string) => User | undefined;
  activityById: (id: string) => Activity | undefined;
  applicationsOf: (activityId: string) => Application[];
  membersOf: (activityId: string) => ActivityMember[];
  conversationOf: (activityId: string) => AppState['conversations'][number] | undefined;
  messagesOf: (conversationId: string) => Message[];
  reviewsOf: (activityId: string) => Review[];
  reviewOf: (activityId: string, userId?: string) => Review | undefined;
  myConversations: AppState['conversations'];
  // ---- 操作
  switchUser: (userId: string) => void;
  dismissDemoNotice: () => void;
  createActivity: (draft: ActivityDraft, routePoints?: Omit<RoutePoint, 'id'>[]) => ActionResult<string>;
  apply: (activityId: string, message: string) => ActionResult;
  decideApplication: (applicationId: string, decision: Decision) => ActionResult;
  withdrawApplication: (applicationId: string) => ActionResult;
  leaveActivity: (activityId: string) => ActionResult;
  startActivity: (activityId: string) => ActionResult;
  finishActivity: (activityId: string) => ActionResult;
  cancelActivity: (activityId: string) => ActionResult;
  updateActivity: (
    activityId: string,
    patch: { meetingPoint?: string; notes?: string },
  ) => ActionResult;
  checkin: (activityId: string) => ActionResult;
  sendMessage: (conversationId: string, content: string) => ActionResult;
  submitReview: (activityId: string, input: ReviewInput) => ActionResult;
  updateProfile: (patch: Partial<Pick<User, 'nickname' | 'avatarColor' | 'bio' | 'interests' | 'tags' | 'transportPreference' | 'budgetPreference'>>) => ActionResult;
  toggleInteraction: (targetType: 'post' | 'activity', targetId: string, actionType: InteractionAction) => void;
  saveReport: (input: ReportInput) => ActionResult<string>;
  track: (name: string, props?: Record<string, string | number | boolean | undefined>) => void;
  resetDemoData: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function makeEvent(
  name: string,
  props: Record<string, string | number | boolean | undefined> = {},
): AnalyticsEvent {
  return { id: uid('evt'), name, props, createdAt: localISO() };
}

export function AppProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: AppState;
}) {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState ?? loadState());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const dispatchAction = useCallback((action: Action) => dispatch(action), []);

  const track = useCallback(
    (name: string, props: Record<string, string | number | boolean | undefined> = {}) => {
      dispatchAction({ type: 'event/track', event: makeEvent(name, props) });
    },
    [dispatchAction],
  );

  const currentUser = useMemo(() => {
    return state.users.find((u) => u.id === state.currentUserId) ?? state.users[0]!;
  }, [state.users, state.currentUserId]);

  const value = useMemo<AppContextValue>(() => {
    const userById = (id: string) => state.users.find((u) => u.id === id);
    const activityById = (id: string) => state.activities.find((a) => a.id === id);
    const applicationsOf = (activityId: string) =>
      state.applications
        .filter((a) => a.activityId === activityId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const membersOf = (activityId: string) =>
      state.members.filter((m) => m.activityId === activityId);
    const conversationOf = (activityId: string) =>
      state.conversations.find((c) => c.activityId === activityId);
    const messagesOf = (conversationId: string) =>
      state.messages
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    const reviewsOf = (activityId: string) => state.reviews.filter((r) => r.activityId === activityId);
    const reviewOf = (activityId: string, userId?: string) =>
      state.reviews.find(
        (r) => r.activityId === activityId && r.reviewerId === (userId ?? state.currentUserId),
      );

    const myConversationIds = new Set(
      state.conversations
        .filter((c) => c.memberIds.includes(currentUser.id))
        .map((c) => c.id),
    );
    const myConversations = state.conversations
      .filter((c) => myConversationIds.has(c.id))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

    return {
      state,
      now,
      currentUser,
      userById,
      activityById,
      applicationsOf,
      membersOf,
      conversationOf,
      messagesOf,
      reviewsOf,
      reviewOf,
      myConversations,

      switchUser(userId: string) {
        dispatchAction({ type: 'switchUser', userId });
        dispatchAction({ type: 'event/track', event: makeEvent('demo_identity_switch', { to: userId }) });
      },

      dismissDemoNotice() {
        dispatchAction({ type: 'dismissDemoNotice' });
      },

      createActivity(draft, routePoints = []) {
        const errors = validateActivityDraft(draft, new Date());
        if (hasErrors(errors)) {
          const [field] = Object.keys(errors);
          return { ok: false, error: errors[field as keyof typeof errors] ?? '请检查表单', field };
        }
        const start = combineDateTime(draft.date, draft.startTime);
        if (!start) return { ok: false, error: '日期或时间格式不正确', field: 'date' };
        const end = addMinutes(start, draft.durationMinutes);
        const activity: Activity = {
          id: uid('act'),
          kind: draft.kind,
          organizerId: currentUser.id,
          title: draft.title.trim(),
          category: draft.category === '' ? 'citywalk' : draft.category,
          city: '武汉',
          startAt: localISO(start),
          endAt: localISO(end),
          meetingPoint: draft.meetingPoint.trim(),
          budgetMin: draft.budgetMin,
          budgetMax: draft.budgetMax,
          feeMode: draft.feeMode === '' ? 'free' : draft.feeMode,
          maxParticipants: draft.maxParticipants,
          description: draft.description.trim(),
          notes: draft.notes.trim(),
          tags: draft.tags.slice(0, 5),
          status: 'preparing',
          transport: draft.transport,
          routePoints: routePoints.map((p, index) => ({ ...p, id: uid(`route${index}`) })),
          coverTone: Math.floor(Math.random() * 15) + 1,
          createdAt: localISO(),
        };
        const member: ActivityMember = {
          id: uid('member'),
          activityId: activity.id,
          userId: currentUser.id,
          role: 'organizer',
          attendance: 'pending',
          joinedAt: localISO(),
        };
        const conversation = {
          id: uid('conv'),
          activityId: activity.id,
          memberIds: [currentUser.id],
          updatedAt: localISO(),
        };
        dispatchAction({
          type: 'activity/create',
          activity,
          member,
          conversation,
          event: makeEvent('activity_create_submit', {
            activity_id: activity.id,
            category: activity.category,
            fee_mode: activity.feeMode,
            participants: activity.maxParticipants,
          }),
        });
        dispatchAction({
          type: 'message/send',
          message: {
            id: uid('msg'),
            conversationId: conversation.id,
            senderId: currentUser.id,
            content: `活动已发布：${activity.title}。集合信息：${activity.meetingPoint}。大家可以在这里沟通细节。`,
            createdAt: localISO(),
          },
        });
        return { ok: true, value: activity.id };
      },

      apply(activityId, message) {
        const activity = activityById(activityId);
        if (!activity) return { ok: false, error: '活动不存在' };
        const eligibility = canApply(state, activity, currentUser.id, new Date());
        if (!eligibility.allowed) {
          return { ok: false, error: eligibility.reason ?? '当前无法申请' };
        }
        const application: Application = {
          id: uid('app'),
          activityId,
          userId: currentUser.id,
          message: message.trim(),
          status: 'pending',
          createdAt: localISO(),
          updatedAt: localISO(),
        };
        dispatchAction({
          type: 'application/create',
          application,
          event: makeEvent('join_apply_submit', {
            activity_id: activityId,
            category: activity.category,
            fee_mode: activity.feeMode,
          }),
        });
        return { ok: true, value: undefined };
      },

      decideApplication(applicationId, decision) {
        const application = state.applications.find((a) => a.id === applicationId);
        if (!application) return { ok: false, error: '申请不存在' };
        const activity = activityById(application.activityId);
        if (!activity) return { ok: false, error: '活动不存在' };
        if (activity.organizerId !== currentUser.id) return { ok: false, error: '只有活动组织者可以审核申请' };
        if (application.status !== 'pending') return { ok: false, error: '该申请已处理过' };
        if (decision === 'approved') {
          const check = canApprove(state, activity);
          if (!check.allowed) return { ok: false, error: check.reason ?? '无法通过申请' };
        }
        const at = localISO();
        const member: ActivityMember | undefined =
          decision === 'approved'
            ? {
                id: uid('member'),
                activityId: application.activityId,
                userId: application.userId,
                role: 'participant',
                attendance: 'pending',
                joinedAt: at,
              }
            : undefined;
        dispatchAction({ type: 'application/decide', applicationId, decision, at, member });
        dispatchAction({
          type: 'event/track',
          event: makeEvent('join_apply_result', {
            activity_id: application.activityId,
            result_status: decision,
          }),
        });
        return { ok: true, value: undefined };
      },

      withdrawApplication(applicationId) {
        const application = state.applications.find((a) => a.id === applicationId);
        if (!application) return { ok: false, error: '申请不存在' };
        if (application.userId !== currentUser.id) return { ok: false, error: '只能撤回自己的申请' };
        const activity = activityById(application.activityId);
        if (!activity) return { ok: false, error: '活动不存在' };
        const check = canWithdrawApplication(activity, application);
        if (!check.allowed) return { ok: false, error: check.reason ?? '当前无法撤回' };
        dispatchAction({ type: 'application/withdraw', applicationId, at: localISO() });
        return { ok: true, value: undefined };
      },

      leaveActivity(activityId) {
        const activity = activityById(activityId);
        if (!activity) return { ok: false, error: '活动不存在' };
        const check = canLeaveActivity(state, activity, currentUser.id);
        if (!check.allowed) return { ok: false, error: check.reason ?? '当前无法退出' };
        dispatchAction({ type: 'member/leave', activityId, userId: currentUser.id, at: localISO() });
        return { ok: true, value: undefined };
      },

      startActivity(activityId) {
        const activity = activityById(activityId);
        if (!activity) return { ok: false, error: '活动不存在' };
        const check = canOrganizerAct(activity, currentUser.id, 'start');
        if (!check.allowed) return { ok: false, error: check.reason ?? '无法开始活动' };
        dispatchAction({ type: 'activity/status', activityId, status: 'ongoing', at: localISO() });
        dispatchAction({
          type: 'event/track',
          event: makeEvent('activity_start', { activity_id: activityId, early: activity.startAt > localISO() }),
        });
        return { ok: true, value: undefined };
      },

      finishActivity(activityId) {
        const activity = activityById(activityId);
        if (!activity) return { ok: false, error: '活动不存在' };
        const check = canOrganizerAct(activity, currentUser.id, 'finish');
        if (!check.allowed) return { ok: false, error: check.reason ?? '无法结束活动' };
        dispatchAction({
          type: 'activity/status',
          activityId,
          status: 'awaiting_review',
          at: localISO(),
          endAt: activity.endAt > localISO() ? localISO() : undefined,
        });
        dispatchAction({
          type: 'event/track',
          event: makeEvent('activity_complete', {
            activity_id: activityId,
            participant_count: state.members.filter((m) => m.activityId === activityId).length,
          }),
        });
        return { ok: true, value: undefined };
      },

      cancelActivity(activityId) {
        const activity = activityById(activityId);
        if (!activity) return { ok: false, error: '活动不存在' };
        const check = canOrganizerAct(activity, currentUser.id, 'cancel');
        if (!check.allowed) return { ok: false, error: check.reason ?? '无法取消活动' };
        dispatchAction({ type: 'activity/status', activityId, status: 'cancelled', at: localISO() });
        dispatchAction({ type: 'event/track', event: makeEvent('activity_cancel', { activity_id: activityId }) });
        return { ok: true, value: undefined };
      },

      updateActivity(activityId, patch) {
        const activity = activityById(activityId);
        if (!activity) return { ok: false, error: '活动不存在' };
        const check = canEditActivity(activity, currentUser.id);
        if (!check.allowed) return { ok: false, error: check.reason ?? '当前无法修改' };
        const nextPatch: { meetingPoint?: string; notes?: string } = { ...patch };
        if (patch.meetingPoint !== undefined) {
          const meetingPoint = patch.meetingPoint.trim();
          if (meetingPoint.length < 2) {
            return { ok: false, error: '集合地点至少 2 个字符', field: 'meetingPoint' };
          }
          nextPatch.meetingPoint = meetingPoint;
        }
        if (patch.notes !== undefined) nextPatch.notes = patch.notes.trim();
        dispatchAction({ type: 'activity/update', activityId, patch: nextPatch });

        // 真实产品里这需要推送通知；演示版把变更写进活动群聊，模拟"通知成员"
        const conversation = conversationOf(activityId);
        if (conversation && nextPatch.meetingPoint) {
          dispatchAction({
            type: 'message/send',
            message: {
              id: uid('msg'),
              conversationId: conversation.id,
              senderId: currentUser.id,
              content: `集合地点更新为：${nextPatch.meetingPoint}。已报名的同学请留意。`,
              createdAt: localISO(),
            },
          });
        }
        dispatchAction({
          type: 'event/track',
          event: makeEvent('activity_update_info', {
            activity_id: activityId,
            field: nextPatch.meetingPoint ? 'meetingPoint' : 'notes',
          }),
        });
        return { ok: true, value: undefined };
      },

      checkin(activityId) {
        const activity = activityById(activityId);
        if (!activity) return { ok: false, error: '活动不存在' };
        const check = canCheckin(state, activity, currentUser.id);
        if (!check.allowed) return { ok: false, error: check.reason ?? '当前无法签到' };
        dispatchAction({
          type: 'checkin/create',
          checkin: {
            id: uid('checkin'),
            activityId,
            userId: currentUser.id,
            status: 'checked_in',
            checkedAt: localISO(),
          },
        });
        dispatchAction({
          type: 'event/track',
          event: makeEvent('activity_checkin_click', { activity_id: activityId, result: 'success' }),
        });
        return { ok: true, value: undefined };
      },

      sendMessage(conversationId, content) {
        const text = content.trim();
        if (!text) return { ok: false, error: '消息不能为空' };
        if (text.length > 500) return { ok: false, error: '消息最多 500 个字符' };
        const conversation = state.conversations.find((c) => c.id === conversationId);
        if (!conversation) return { ok: false, error: '会话不存在' };
        if (!conversation.memberIds.includes(currentUser.id)) {
          return { ok: false, error: '只有活动成员可以发言' };
        }
        dispatchAction({
          type: 'message/send',
          message: {
            id: uid('msg'),
            conversationId,
            senderId: currentUser.id,
            content: text,
            createdAt: localISO(),
          },
        });
        dispatchAction({
          type: 'event/track',
          event: makeEvent('message_send', {
            activity_id: conversation.activityId,
            message_type: 'text',
            length_bucket: text.length < 20 ? 'short' : text.length < 60 ? 'medium' : 'long',
          }),
        });
        return { ok: true, value: undefined };
      },

      submitReview(activityId, input) {
        const activity = activityById(activityId);
        if (!activity) return { ok: false, error: '活动不存在' };
        const check = canReview(state, activity, currentUser.id, new Date());
        if (!check.allowed) return { ok: false, error: check.reason ?? '当前无法评价' };
        if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
          return { ok: false, error: '请选择 1–5 分' };
        }
        if (input.comment.length > 200) return { ok: false, error: '评价最多 200 个字符' };
        const review: Review = {
          id: uid('review'),
          activityId,
          reviewerId: currentUser.id,
          rating: input.rating,
          tags: input.tags.slice(0, 5),
          comment: input.comment.trim(),
          createdAt: localISO(),
        };
        dispatchAction({ type: 'review/create', review });
        dispatchAction({
          type: 'event/track',
          event: makeEvent('review_submit', {
            activity_id: activityId,
            rating: input.rating,
            selected_tags: input.tags.join('|'),
          }),
        });
        return { ok: true, value: undefined };
      },

      updateProfile(patch) {
        if (patch.nickname !== undefined) {
          const nickname = patch.nickname.trim();
          if (nickname.length < 2 || nickname.length > 20) {
            return { ok: false, error: '昵称需为 2–20 个字符', field: 'nickname' };
          }
        }
        if (patch.bio !== undefined && patch.bio.length > 80) {
          return { ok: false, error: '个人简介最多 80 个字符', field: 'bio' };
        }
        if (patch.interests !== undefined && patch.interests.length > 8) {
          return { ok: false, error: '兴趣标签最多 8 个', field: 'interests' };
        }
        if (patch.tags !== undefined && patch.tags.length > 5) {
          return { ok: false, error: '个性标签最多 5 个', field: 'tags' };
        }
        dispatchAction({
          type: 'profile/update',
          patch: { ...patch, ...(patch.nickname ? { nickname: patch.nickname.trim() } : {}) },
        });
        return { ok: true, value: undefined };
      },

      toggleInteraction(targetType, targetId, actionType) {
        dispatchAction({
          type: 'interaction/toggle',
          interaction: {
            id: uid('interaction'),
            userId: currentUser.id,
            targetType,
            targetId,
            actionType,
            createdAt: localISO(),
          },
        });
        dispatchAction({
          type: 'event/track',
          event: makeEvent(actionType === 'like' ? 'post_like_toggle' : 'post_save_toggle', {
            target_type: targetType,
            target_id: targetId,
          }),
        });
      },

      saveReport(input) {
        if (!input.reason) return { ok: false, error: '请选择举报原因' };
        const report: Report = {
          id: uid('report'),
          reporterId: currentUser.id,
          targetType: input.targetType,
          targetId: input.targetId,
          reason: input.reason,
          detail: input.detail.trim().slice(0, 200),
          status: 'recorded',
          createdAt: localISO(),
        };
        dispatchAction({ type: 'report/create', report });
        dispatchAction({
          type: 'event/track',
          event: makeEvent('report_submit', {
            target_type: input.targetType,
            reason: input.reason,
            status: report.status,
          }),
        });
        return { ok: true, value: report.id };
      },

      track,
      resetDemoData() {
        dispatchAction({ type: 'reset', state: createInitialState() });
      },
    };
  }, [state, now, currentUser, track, dispatchAction]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp 必须在 <AppProvider> 内部使用');
  return ctx;
}
