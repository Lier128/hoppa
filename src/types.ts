/**
 * HOPPA 领域模型（前端 MVP）
 *
 * 设计原则：
 * 1. 所有实体字段与 `docs/product/HOPPA_PRD_v1.0.md` §9 的数据模型一一对应；
 * 2. 状态枚举集中在这里定义，禁止在页面里散落硬编码的状态字符串；
 * 3. 前端 MVP 不保存任何真实敏感信息（无手机号、身份证、精确坐标）。
 */

// ---------------------------------------------------------------- 枚举 / 常量

export const CATEGORIES = ['citywalk', 'food', 'exhibition', 'boardgame', 'sports', 'show'] as const;
export type Category = (typeof CATEGORIES)[number];

export const ACTIVITY_STATUSES = [
  'preparing',
  'ongoing',
  'awaiting_review',
  'completed',
  'cancelled',
] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const APPLICATION_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'withdrawn',
  'left',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const FEE_MODES = ['aa', 'self', 'free', 'negotiable'] as const;
export type FeeMode = (typeof FEE_MODES)[number];

export const TRANSPORTS = ['walk', 'transit', 'bike', 'drive', 'other'] as const;
export type Transport = (typeof TRANSPORTS)[number];

/** 社群活动 = 有固定组织者与规则；个人活动 = 一对一发起的轻量邀约（PRD §2.4 找搭子顶部切换） */
export const ACTIVITY_KINDS = ['group', 'individual'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const MEMBER_ROLES = ['organizer', 'participant'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const ATTENDANCE_STATUSES = ['pending', 'checked_in', 'absent'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const REPORT_REASONS = ['harassment', 'fake_info', 'fee_dispute', 'safety_risk', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['recorded', 'reviewing', 'closed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const INTERACTION_ACTIONS = ['like', 'save'] as const;
export type InteractionAction = (typeof INTERACTION_ACTIONS)[number];

// ---------------------------------------------------------------- 文案元数据

export interface CategoryMeta {
  key: Category;
  label: string;
  short: string;
  /** 封面渐变（与 tokens 里的分类色保持一致，在 CSS 里也可以用 data-category 选中） */
  gradient: string;
  accent: string;
  description: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  citywalk: {
    key: 'citywalk',
    label: 'City Walk',
    short: '城市漫游',
    gradient: 'linear-gradient(135deg, #ff8fb1 0%, #ff5fa2 48%, #b45cff 100%)',
    accent: '#e83e8c',
    description: '用脚步丈量城市，从一条街走到另一条街',
  },
  food: {
    key: 'food',
    label: '美食',
    short: '觅食',
    gradient: 'linear-gradient(135deg, #ffb26b 0%, #ff7a59 52%, #ff4d8d 100%)',
    accent: '#e8602e',
    description: '把周末过成一场有计划的觅食',
  },
  exhibition: {
    key: 'exhibition',
    label: '展览',
    short: '看展',
    gradient: 'linear-gradient(135deg, #8f7bff 0%, #b45cff 50%, #ff5fa2 100%)',
    accent: '#7b5cff',
    description: '在美术馆里慢下来，和同好聊同一件作品',
  },
  boardgame: {
    key: 'boardgame',
    label: '桌游',
    short: '开局',
    gradient: 'linear-gradient(135deg, #4fd1c5 0%, #38bdf8 52%, #8f7bff 100%)',
    accent: '#0f9e94',
    description: '一局游戏认识一群人，规则比寒暄更快',
  },
  sports: {
    key: 'sports',
    label: '运动',
    short: '动起来',
    gradient: 'linear-gradient(135deg, #a3e635 0%, #34d399 50%, #22d3ee 100%)',
    accent: '#2f9e44',
    description: '一起流汗，比一个人坚持容易',
  },
  show: {
    key: 'show',
    label: '演出',
    short: '现场',
    gradient: 'linear-gradient(135deg, #f472b6 0%, #c026d3 50%, #6d28d9 100%)',
    accent: '#a21caf',
    description: '为一场现场，约上一群同频的人',
  },
};

export interface StatusMeta {
  key: ActivityStatus;
  label: string;
  tone: 'pink' | 'amber' | 'green' | 'violet' | 'slate';
  hint: string;
}

export const ACTIVITY_STATUS_META: Record<ActivityStatus, StatusMeta> = {
  preparing: { key: 'preparing', label: '准备中', tone: 'pink', hint: '正在招募，可以提交申请' },
  ongoing: { key: 'ongoing', label: '进行中', tone: 'amber', hint: '活动已开始，可签到与群聊' },
  awaiting_review: { key: 'awaiting_review', label: '待评价', tone: 'violet', hint: '活动已结束，等待你留下评价' },
  completed: { key: 'completed', label: '已结束', tone: 'green', hint: '活动已完成，可以查看回顾' },
  cancelled: { key: 'cancelled', label: '已取消', tone: 'slate', hint: '活动已取消，不再接受申请' },
};

export const APPLICATION_STATUS_META: Record<
  ApplicationStatus,
  { key: ApplicationStatus; label: string; tone: 'pink' | 'amber' | 'green' | 'violet' | 'slate' }
> = {
  pending: { key: 'pending', label: '待审核', tone: 'amber' },
  approved: { key: 'approved', label: '已通过', tone: 'green' },
  rejected: { key: 'rejected', label: '已拒绝', tone: 'slate' },
  withdrawn: { key: 'withdrawn', label: '已撤回', tone: 'slate' },
  left: { key: 'left', label: '已退出', tone: 'slate' },
};

export const FEE_MODE_META: Record<FeeMode, { label: string; hint: string }> = {
  aa: { label: 'AA 制', hint: '现场按人均分摊' },
  self: { label: '各自承担', hint: '各自消费各自付' },
  free: { label: '免费', hint: '无固定费用' },
  negotiable: { label: '费用待协商', hint: '报名后群里商量' },
};

export const TRANSPORT_META: Record<Transport, string> = {
  walk: '步行',
  transit: '公共交通',
  bike: '骑行',
  drive: '自驾',
  other: '其他',
};

export const REPORT_REASON_META: Record<ReportReason, string> = {
  harassment: '骚扰',
  fake_info: '虚假信息',
  fee_dispute: '费用争议',
  safety_risk: '安全风险',
  other: '其他',
};

// ---------------------------------------------------------------- 实体

export interface User {
  id: string;
  nickname: string;
  /** 头像用「首字 + 渐变底色」生成，不引用任何真实照片 */
  avatarColor: string;
  city: string;
  bio: string;
  interests: string[];
  tags: string[];
  transportPreference: Transport;
  budgetPreference: 'low' | 'mid' | 'high';
  joinedAt: string;
}

export interface RoutePoint {
  id: string;
  name: string;
  note: string;
  stayMinutes: number;
}

export interface Activity {
  id: string;
  kind: ActivityKind;
  organizerId: string;
  title: string;
  category: Category;
  city: string;
  /** ISO 8601 字符串（本地时区语义，演示版不做时区换算） */
  startAt: string;
  endAt: string;
  meetingPoint: string;
  budgetMin: number;
  budgetMax: number;
  feeMode: FeeMode;
  maxParticipants: number;
  description: string;
  notes: string;
  tags: string[];
  status: ActivityStatus;
  transport: Transport;
  routePoints: RoutePoint[];
  /** 1–5，用于封面视觉分层，纯前端展示 */
  coverTone: number;
  createdAt: string;
}

export interface Application {
  id: string;
  activityId: string;
  userId: string;
  message: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityMember {
  id: string;
  activityId: string;
  userId: string;
  role: MemberRole;
  attendance: AttendanceStatus;
  joinedAt: string;
}

export interface Conversation {
  id: string;
  activityId: string;
  memberIds: string[];
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface Review {
  id: string;
  activityId: string;
  reviewerId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  comment: string;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  activityId: string | null;
  title: string;
  content: string;
  location: string;
  category: Category;
  likeCount: number;
  createdAt: string;
}

export interface Interaction {
  id: string;
  userId: string;
  targetType: 'post' | 'activity';
  targetId: string;
  actionType: InteractionAction;
  createdAt: string;
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: 'activity' | 'user' | 'message';
  targetId: string;
  reason: ReportReason;
  detail: string;
  status: ReportStatus;
  createdAt: string;
}

export interface SafetyCheckin {
  id: string;
  activityId: string;
  userId: string;
  status: 'checked_in';
  checkedAt: string;
}

/** 本地模拟埋点事件（PRD §3.2 / 验收表「事件埋点」页） */
export interface AnalyticsEvent {
  id: string;
  name: string;
  props: Record<string, string | number | boolean | undefined>;
  createdAt: string;
}

// ---------------------------------------------------------------- 聚合状态

export interface AppState {
  schemaVersion: number;
  currentUserId: string;
  demoDataDismissed: boolean;
  users: User[];
  activities: Activity[];
  applications: Application[];
  members: ActivityMember[];
  conversations: Conversation[];
  messages: Message[];
  reviews: Review[];
  posts: Post[];
  interactions: Interaction[];
  reports: Report[];
  checkins: SafetyCheckin[];
  events: AnalyticsEvent[];
}

// ---------------------------------------------------------------- 结构化结果

export type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { value?: undefined } : { value: T }))
  | { ok: false; error: string; field?: string };

export interface ActivityDraft {
  title: string;
  kind: ActivityKind;
  category: Category | '';
  date: string; // yyyy-mm-dd
  startTime: string; // HH:mm
  durationMinutes: number;
  meetingPoint: string;
  maxParticipants: number;
  feeMode: FeeMode | '';
  budgetMin: number;
  budgetMax: number;
  transport: Transport;
  description: string;
  notes: string;
  tags: string[];
}

export const EMPTY_ACTIVITY_DRAFT: ActivityDraft = {
  title: '',
  kind: 'group',
  category: '',
  date: '',
  startTime: '',
  durationMinutes: 120,
  meetingPoint: '',
  maxParticipants: 6,
  feeMode: '',
  budgetMin: 0,
  budgetMax: 0,
  transport: 'walk',
  description: '',
  notes: '',
  tags: [],
};
