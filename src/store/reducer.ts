import type {
  Activity,
  ActivityMember,
  ActivityStatus,
  AnalyticsEvent,
  AppState,
  Application,
  Conversation,
  Interaction,
  Message,
  Report,
  Review,
  SafetyCheckin,
  User,
} from '@/types';

/** localStorage 键名（E2E 也用它来重置演示数据） */
export const STORAGE_KEY = 'hoppa.state.v1';

export type Decision = 'approved' | 'rejected';

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'reset'; state: AppState }
  | { type: 'switchUser'; userId: string }
  | { type: 'dismissDemoNotice' }
  | {
      type: 'activity/create';
      activity: Activity;
      member: ActivityMember;
      conversation: Conversation;
      event?: AnalyticsEvent;
    }
  | { type: 'application/create'; application: Application; event?: AnalyticsEvent }
  | { type: 'application/withdraw'; applicationId: string; at: string }
  | {
      type: 'application/decide';
      applicationId: string;
      decision: Decision;
      at: string;
      member?: ActivityMember;
    }
  | { type: 'member/leave'; activityId: string; userId: string; at: string }
  | { type: 'activity/status'; activityId: string; status: ActivityStatus; at: string; endAt?: string }
  | {
      type: 'activity/update';
      activityId: string;
      patch: { meetingPoint?: string; notes?: string };
    }
  | { type: 'checkin/create'; checkin: SafetyCheckin }
  | { type: 'message/send'; message: Message }
  | { type: 'review/create'; review: Review }
  | { type: 'profile/update'; patch: Partial<User> }
  | { type: 'interaction/toggle'; interaction: Interaction }
  | { type: 'report/create'; report: Report }
  | { type: 'event/track'; event: AnalyticsEvent };

const EVENT_LIMIT = 300;

function withEvent(state: AppState, event?: AnalyticsEvent): AppState {
  if (!event) return state;
  const events = [...state.events, event].slice(-EVENT_LIMIT);
  return { ...state, events };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
    case 'reset':
      return action.state;

    case 'switchUser': {
      if (!state.users.some((u) => u.id === action.userId)) return state;
      return { ...state, currentUserId: action.userId };
    }

    case 'dismissDemoNotice':
      return { ...state, demoDataDismissed: true };

    case 'activity/create': {
      const next: AppState = {
        ...state,
        activities: [...state.activities, action.activity],
        members: [...state.members, action.member],
        conversations: [...state.conversations, action.conversation],
      };
      return withEvent(next, action.event);
    }

    case 'application/create': {
      // 防重复：同一用户同一活动只允许一条有效申请
      const duplicated = state.applications.some(
        (a) =>
          a.activityId === action.application.activityId &&
          a.userId === action.application.userId &&
          (a.status === 'pending' || a.status === 'approved'),
      );
      if (duplicated) return state;
      return withEvent({ ...state, applications: [...state.applications, action.application] }, action.event);
    }

    case 'application/withdraw': {
      return {
        ...state,
        applications: state.applications.map((a) =>
          a.id === action.applicationId && a.status === 'pending'
            ? { ...a, status: 'withdrawn', updatedAt: action.at }
            : a,
        ),
      };
    }

    case 'application/decide': {
      const target = state.applications.find((a) => a.id === action.applicationId);
      if (!target || target.status !== 'pending') return state;
      const applications = state.applications.map((a) =>
        a.id === action.applicationId
          ? { ...a, status: action.decision, updatedAt: action.at }
          : a,
      );
      if (action.decision === 'rejected') {
        return { ...state, applications };
      }
      const member = action.member;
      if (!member) return { ...state, applications };
      const conversation = state.conversations.find((c) => c.activityId === target.activityId);
      const conversations = conversation
        ? state.conversations.map((c) =>
            c.id === conversation.id
              ? {
                  ...c,
                  memberIds: c.memberIds.includes(member.userId)
                    ? c.memberIds
                    : [...c.memberIds, member.userId],
                  updatedAt: action.at,
                }
              : c,
          )
        : state.conversations;
      return { ...state, applications, members: [...state.members, member], conversations };
    }

    case 'member/leave': {
      return {
        ...state,
        members: state.members.filter(
          (m) => !(m.activityId === action.activityId && m.userId === action.userId),
        ),
        applications: state.applications.map((a) =>
          a.activityId === action.activityId && a.userId === action.userId && a.status === 'approved'
            ? { ...a, status: 'left', updatedAt: action.at }
            : a,
        ),
        conversations: state.conversations.map((c) =>
          c.activityId === action.activityId
            ? { ...c, memberIds: c.memberIds.filter((id) => id !== action.userId) }
            : c,
        ),
      };
    }

    case 'activity/status': {
      return {
        ...state,
        activities: state.activities.map((a) =>
          a.id === action.activityId
            ? { ...a, status: action.status, ...(action.endAt ? { endAt: action.endAt } : {}) }
            : a,
        ),
      };
    }

    case 'activity/update': {
      return {
        ...state,
        activities: state.activities.map((a) =>
          a.id === action.activityId
            ? {
                ...a,
                ...(action.patch.meetingPoint !== undefined
                  ? { meetingPoint: action.patch.meetingPoint }
                  : {}),
                ...(action.patch.notes !== undefined ? { notes: action.patch.notes } : {}),
              }
            : a,
        ),
      };
    }

    case 'checkin/create': {
      const exists = state.checkins.some(
        (c) => c.activityId === action.checkin.activityId && c.userId === action.checkin.userId,
      );
      if (exists) return state;
      return {
        ...state,
        checkins: [...state.checkins, action.checkin],
        members: state.members.map((m) =>
          m.activityId === action.checkin.activityId && m.userId === action.checkin.userId
            ? { ...m, attendance: 'checked_in' }
            : m,
        ),
      };
    }

    case 'message/send': {
      return {
        ...state,
        messages: [...state.messages, action.message],
        conversations: state.conversations.map((c) =>
          c.id === action.message.conversationId ? { ...c, updatedAt: action.message.createdAt } : c,
        ),
      };
    }

    case 'review/create': {
      const exists = state.reviews.some(
        (r) => r.activityId === action.review.activityId && r.reviewerId === action.review.reviewerId,
      );
      if (exists) return state;
      const next = { ...state, reviews: [...state.reviews, action.review] };
      // 所有已通过成员都评价后，活动标记为已结束（展示层也会按用户折算）
      const memberIds = state.members
        .filter((m) => m.activityId === action.review.activityId)
        .map((m) => m.userId);
      const reviewedIds = new Set(
        next.reviews.filter((r) => r.activityId === action.review.activityId).map((r) => r.reviewerId),
      );
      const allReviewed = memberIds.length > 0 && memberIds.every((id) => reviewedIds.has(id));
      if (!allReviewed) return next;
      return {
        ...next,
        activities: next.activities.map((a) =>
          a.id === action.review.activityId ? { ...a, status: 'completed' } : a,
        ),
      };
    }

    case 'profile/update': {
      return {
        ...state,
        users: state.users.map((u) =>
          u.id === state.currentUserId ? { ...u, ...action.patch, id: u.id } : u,
        ),
      };
    }

    case 'interaction/toggle': {
      const exists = state.interactions.find(
        (i) =>
          i.userId === action.interaction.userId &&
          i.targetType === action.interaction.targetType &&
          i.targetId === action.interaction.targetId &&
          i.actionType === action.interaction.actionType,
      );
      const interactions = exists
        ? state.interactions.filter((i) => i.id !== exists.id)
        : [...state.interactions, action.interaction];
      const posts = state.posts.map((p) => {
        if (action.interaction.targetType !== 'post' || p.id !== action.interaction.targetId) return p;
        if (action.interaction.actionType !== 'like') return p;
        const delta = exists ? -1 : 1;
        return { ...p, likeCount: Math.max(0, p.likeCount + delta) };
      });
      return { ...state, interactions, posts };
    }

    case 'report/create':
      return { ...state, reports: [...state.reports, action.report] };

    case 'event/track':
      return withEvent(state, action.event);

    default:
      return state;
  }
}
