import type {
  Activity,
  ActivityKind,
  ActivityMember,
  ActivityStatus,
  AppState,
  Application,
  ApplicationStatus,
  Category,
  Conversation,
  FeeMode,
  Interaction,
  Message,
  Post,
  Report,
  Review,
  RoutePoint,
  SafetyCheckin,
  Transport,
  User,
} from '@/types';
import { addMinutes, daysFromNow, localISO } from '@/lib/date';

/** 数据结构变更时 +1，旧 localStorage 会被自动重建 */
export const SCHEMA_VERSION = 1;

/** 默认演示身份：普通参与者（也是「周五桌游夜」的组织者，方便一屏内演示两个角色） */
export const DEMO_USER_ID = 'u_lixiaoman';

const D = (days: number, hour: number, minute = 0) => daysFromNow(days, hour, minute);
const iso = (d: Date) => localISO(d);
const ago = (hours: number) => iso(new Date(Date.now() - hours * 3_600_000));
/** 消息时间用分钟粒度（会话种子里的 minutesAgo 就是分钟） */
const agoMinutes = (minutes: number) => iso(new Date(Date.now() - minutes * 60_000));

// ---------------------------------------------------------------- 演示用户（全部虚构）

const users: User[] = [
  {
    id: 'u_lixiaoman',
    nickname: '林小满',
    avatarColor: '#ff5fa2',
    city: '武汉',
    bio: '在武汉做设计，周末喜欢用脚步把地图走一遍。',
    interests: ['City Walk', '展览', '摄影', '咖啡', '桌游'],
    tags: ['慢热', '拍照担当', '不加班的周五'],
    transportPreference: 'walk',
    budgetPreference: 'mid',
    joinedAt: '2026-08-12T10:00:00.000+08:00',
  },
  {
    id: 'u_chenyu',
    nickname: '陈屿',
    avatarColor: '#7b5cff',
    city: '武汉',
    bio: '城市漫游组织者，路线控，喜欢把一条街的故事讲清楚。',
    interests: ['City Walk', '骑行', '老建筑', '美食'],
    tags: ['路线规划', '守时', '会带路'],
    transportPreference: 'walk',
    budgetPreference: 'low',
    joinedAt: '2026-07-02T09:30:00.000+08:00',
  },
  {
    id: 'u_tangtang',
    nickname: '唐糖',
    avatarColor: '#ff8a5b',
    city: '武汉',
    bio: '武汉土著，吃到好吃的会立刻发群。',
    interests: ['美食', '演出', '咖啡', '探店'],
    tags: ['会点菜', '气氛组'],
    transportPreference: 'transit',
    budgetPreference: 'mid',
    joinedAt: '2026-08-20T19:00:00.000+08:00',
  },
  {
    id: 'u_ahu',
    nickname: '阿虎',
    avatarColor: '#22b8a8',
    city: '武汉',
    bio: '夜跑 / 骑行爱好者，配速不快但从不鸽。',
    interests: ['运动', '骑行', '桌游'],
    tags: ['靠谱', '配速 6分'],
    transportPreference: 'bike',
    budgetPreference: 'low',
    joinedAt: '2026-07-18T21:00:00.000+08:00',
  },
  {
    id: 'u_yue',
    nickname: '月野',
    avatarColor: '#8f7bff',
    city: '武汉',
    bio: '博物馆和美术馆常客，看展喜欢慢慢走。',
    interests: ['展览', 'City Walk', '摄影'],
    tags: ['安静', '会讲解'],
    transportPreference: 'transit',
    budgetPreference: 'low',
    joinedAt: '2026-09-01T14:00:00.000+08:00',
  },
  {
    id: 'u_shasha',
    nickname: '沙沙',
    avatarColor: '#d946a6',
    city: '武汉',
    bio: '密室和话剧十级爱好者，组局从不冷场。',
    interests: ['演出', '桌游', '美食'],
    tags: ['社牛', '组局达人'],
    transportPreference: 'transit',
    budgetPreference: 'high',
    joinedAt: '2026-06-11T16:20:00.000+08:00',
  },
];

// ---------------------------------------------------------------- 活动（15 条，覆盖 6 个品类）

interface RouteSeed {
  name: string;
  note: string;
  stayMinutes: number;
}

interface ActivitySeed {
  id: string;
  kind: ActivityKind;
  organizerId: string;
  title: string;
  category: Category;
  start: Date;
  end: Date;
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
  route: RouteSeed[];
  coverTone: number;
  createdAgoDays: number;
}

function buildRoute(activityId: string, seeds: RouteSeed[]): RoutePoint[] {
  return seeds.map((p, i) => ({ id: `${activityId}_route_${i + 1}`, ...p }));
}

function mkActivity(seed: ActivitySeed): Activity {
  return {
    id: seed.id,
    kind: seed.kind,
    organizerId: seed.organizerId,
    title: seed.title,
    category: seed.category,
    city: '武汉',
    startAt: iso(seed.start),
    endAt: iso(seed.end),
    meetingPoint: seed.meetingPoint,
    budgetMin: seed.budgetMin,
    budgetMax: seed.budgetMax,
    feeMode: seed.feeMode,
    maxParticipants: seed.maxParticipants,
    description: seed.description,
    notes: seed.notes,
    tags: seed.tags,
    status: seed.status,
    transport: seed.transport,
    routePoints: buildRoute(seed.id, seed.route),
    coverTone: seed.coverTone,
    createdAt: iso(addMinutes(seed.start, -seed.createdAgoDays * 24 * 60)),
  };
}

const activitySeeds: ActivitySeed[] = [
  {
    id: 'a_donghu_sunset',
    kind: 'group',
    organizerId: 'u_chenyu',
    title: '东湖绿道 · 落日 City Walk',
    category: 'citywalk',
    start: D(2, 15, 30),
    end: D(2, 18, 30),
    meetingPoint: '东湖绿道磨山北门（近磨山景区停车场）',
    budgetMin: 0,
    budgetMax: 0,
    feeMode: 'free',
    maxParticipants: 8,
    description:
      '从磨山北门出发，沿湖走 6 公里左右，在湖心亭看落日，终点是听涛景区。全程平路，配速很慢，以聊天和拍照为主。不需要专业装备，穿一双舒服的鞋就行。',
    notes: '如遇下雨顺延到周日同一时间，群里会提前说。请自备饮用水，路上有 2 个补给点。',
    tags: ['落日', '湖边', '轻松', '拍照'],
    status: 'preparing',
    transport: 'walk',
    route: [
      { name: '磨山北门', note: '集合、互相认识，拍一张出发合照', stayMinutes: 10 },
      { name: '湖心亭', note: '第一个观景位，落日最佳机位之一', stayMinutes: 20 },
      { name: '落雁景区入口', note: '补水休息，顺便看看候鸟', stayMinutes: 10 },
      { name: '听涛景区', note: '终点，想继续的可以一起吃晚饭', stayMinutes: 15 },
    ],
    coverTone: 1,
    createdAgoDays: 3,
  },
  {
    id: 'a_huanghelou_night',
    kind: 'group',
    organizerId: 'u_chenyu',
    title: '黄鹤楼夜游 + 户部巷小吃',
    category: 'citywalk',
    start: D(1, 18, 0),
    end: D(1, 21, 0),
    meetingPoint: '黄鹤楼公园西门（司门口地铁站 A 口步行 5 分钟）',
    budgetMin: 60,
    budgetMax: 80,
    feeMode: 'aa',
    maxParticipants: 10,
    description:
      '傍晚上黄鹤楼看长江夜景，下来之后去户部巷挑三样小吃，边走边吃。路线不长，重在把武汉的夜生活走一遍。适合第一次来武汉或者想重新认识武汉的人。',
    notes: '黄鹤楼夜场门票需自行购买（约 35 元，学生票半价）；小吃费用现场 AA。',
    tags: ['夜景', '小吃', '长江', '新手友好'],
    status: 'preparing',
    transport: 'walk',
    route: [
      { name: '黄鹤楼西门', note: '集合后一起检票上楼', stayMinutes: 10 },
      { name: '黄鹤楼主楼', note: '看长江大桥与两江夜景', stayMinutes: 45 },
      { name: '司门口天桥', note: '拍一张车流长曝光', stayMinutes: 15 },
      { name: '户部巷', note: '热干面、豆皮、糊汤粉各来一份分着吃', stayMinutes: 60 },
    ],
    coverTone: 2,
    createdAgoDays: 2,
  },
  {
    id: 'a_tanhu咖啡',
    kind: 'individual',
    organizerId: 'u_tangtang',
    title: '昙华林咖啡地图 · 半日闲逛',
    category: 'food',
    start: D(3, 14, 0),
    end: D(3, 17, 0),
    meetingPoint: '昙华林仁济医院旧址门口',
    budgetMin: 80,
    budgetMax: 120,
    feeMode: 'aa',
    maxParticipants: 6,
    description:
      '昙华林的老房子最近开了好几家小咖啡馆。计划逛 3 家，每家点一杯手冲分着尝，边走边聊各自最近在忙什么。不是探店打卡团，走累了就坐下来。',
    notes: '人均预算按 3 杯咖啡 + 一份甜点估算；不想喝咖啡可以点茶。',
    tags: ['咖啡', '老街', '慢节奏'],
    status: 'preparing',
    transport: 'walk',
    route: [
      { name: '仁济医院旧址', note: '集合，从这条巷子开始', stayMinutes: 10 },
      { name: '第一家：巷口手冲', note: '先来一杯浅烘开场', stayMinutes: 40 },
      { name: '第二家：老宅院子', note: '院子里有猫，适合发呆', stayMinutes: 40 },
      { name: '第三家：天台', note: '看日落收尾', stayMinutes: 40 },
    ],
    coverTone: 3,
    createdAgoDays: 4,
  },
  {
    id: 'a_hubei_museum',
    kind: 'group',
    organizerId: 'u_yue',
    title: '湖北省博 · 曾侯乙特展拼团',
    category: 'exhibition',
    start: D(4, 10, 0),
    end: D(4, 13, 0),
    meetingPoint: '湖北省博物馆南门安检口',
    budgetMin: 0,
    budgetMax: 0,
    feeMode: 'free',
    maxParticipants: 6,
    description:
      '省博的曾侯乙展每次去都能看出新东西。这次约 6 个人一起，进馆后先看编钟，再按展厅慢慢走。我会提前做一点功课，边走边讲，也欢迎你随时补充。',
    notes: '需自行在省博公众号预约免费门票，约不上的话提前一天告诉我。馆内不能带饮料。',
    tags: ['博物馆', '编钟', '讲解', '免费'],
    status: 'preparing',
    transport: 'transit',
    route: [
      { name: '南门安检口', note: '集合、验预约码', stayMinutes: 10 },
      { name: '曾侯乙展厅', note: '编钟与青铜器，重点讲 15 分钟', stayMinutes: 50 },
      { name: '楚文化展厅', note: '自由参观，可随时交流', stayMinutes: 60 },
      { name: '文创商店', note: '想买周边的可以一起逛', stayMinutes: 20 },
    ],
    coverTone: 4,
    createdAgoDays: 5,
  },
  {
    id: 'a_boardgame_night',
    kind: 'group',
    organizerId: 'u_lixiaoman',
    title: '周五桌游夜 · 阿瓦隆 + 卡坦岛',
    category: 'boardgame',
    start: D(2, 19, 30),
    end: D(2, 22, 30),
    meetingPoint: '街道口「骰子与猫」桌游店（珞喻路 1 号 3 楼）',
    budgetMin: 40,
    budgetMax: 40,
    feeMode: 'aa',
    maxParticipants: 6,
    description:
      '常规周五局，这周玩阿瓦隆和卡坦岛。新手完全没问题，规则我会先讲一遍，前两局允许看牌。店里饮料自费，场地费人均 40。结束早的话可以一起吃点夜宵。',
    notes: '请尽量 19:20 前到，迟到的话会先开一局；不接受空降，需要先申请。',
    tags: ['新手友好', '策略', '周五夜'],
    status: 'preparing',
    transport: 'transit',
    route: [],
    coverTone: 5,
    createdAgoDays: 6,
  },
  {
    id: 'a_riverside_run',
    kind: 'group',
    organizerId: 'u_ahu',
    title: '汉口江滩夜跑 5km · 轻松配速',
    category: 'sports',
    start: D(1, 20, 0),
    end: D(1, 21, 0),
    meetingPoint: '汉口江滩三阳广场（江滩正门进来左手边）',
    budgetMin: 0,
    budgetMax: 0,
    feeMode: 'free',
    maxParticipants: 12,
    description:
      '固定的江滩夜跑，5 公里，配速 6 分半左右，跑完在江边拉伸 10 分钟。不追求成绩，能边跑边说话就行。跑完想喝东西的可以一起去便利店。',
    notes: '自备头灯或反光装备；下雨自动取消，群里会通知。',
    tags: ['夜跑', '轻松', '免费', '江边'],
    status: 'preparing',
    transport: 'walk',
    route: [
      { name: '三阳广场', note: '集合热身 5 分钟', stayMinutes: 10 },
      { name: '武汉关', note: '折返点', stayMinutes: 5 },
      { name: '三阳广场', note: '拉伸 + 合照', stayMinutes: 15 },
    ],
    coverTone: 6,
    createdAgoDays: 2,
  },
  {
    id: 'a_zhiyinhao',
    kind: 'group',
    organizerId: 'u_shasha',
    title: '知音号 · 沉浸式话剧拼票',
    category: 'show',
    start: D(5, 19, 0),
    end: D(5, 21, 30),
    meetingPoint: '知音号码头（汉口江滩内，粤汉码头旁）',
    budgetMin: 180,
    budgetMax: 260,
    feeMode: 'aa',
    maxParticipants: 4,
    description:
      '一直想去看知音号但一个人不好意思去，凑 4 个人一起。船上的戏是流动的，建议穿得稍微正式一点，会更有代入感。看完可以一起在江边聊聊各自看到的线索。',
    notes: '票需要提前统一买，确定后我会拉小群收票款（演示版本不涉及真实支付）。',
    tags: ['话剧', '沉浸式', '江边'],
    status: 'preparing',
    transport: 'transit',
    route: [],
    coverTone: 7,
    createdAgoDays: 3,
  },
  {
    id: 'a_qingshan_ride',
    kind: 'individual',
    organizerId: 'u_chenyu',
    title: '青山江滩骑行 · 追一场日落',
    category: 'sports',
    start: D(6, 16, 0),
    end: D(6, 18, 30),
    meetingPoint: '青山江滩公园东门（共享单车停放点）',
    budgetMin: 15,
    budgetMax: 30,
    feeMode: 'self',
    maxParticipants: 8,
    description:
      '沿青山江滩骑 12 公里，速度控制在能聊天的程度，中途在旧码头停一次拍照。共享单车自备，骑自己的车也可以。终点附近有新开的咖啡店，想坐下来聊的可以继续。',
    notes: '请确认刹车和车灯正常；不建议没有长距离骑行经验的人参加。',
    tags: ['骑行', '日落', '江滩'],
    status: 'preparing',
    transport: 'bike',
    route: [
      { name: '青山江滩东门', note: '检查车辆、出发', stayMinutes: 10 },
      { name: '旧码头', note: '拍照点，江面很开阔', stayMinutes: 20 },
      { name: '天兴洲大桥下', note: '折返点，补水', stayMinutes: 10 },
      { name: '咖啡店', note: '可选，坐下来聊一会儿', stayMinutes: 40 },
    ],
    coverTone: 8,
    createdAgoDays: 4,
  },
  {
    id: 'a_wuda_cherry',
    kind: 'group',
    organizerId: 'u_yue',
    title: '武大樱花大道 · 早樱晨走',
    category: 'citywalk',
    start: D(7, 9, 0),
    end: D(7, 12, 0),
    meetingPoint: '武汉大学正门（珞珈山牌坊）',
    budgetMin: 0,
    budgetMax: 0,
    feeMode: 'free',
    maxParticipants: 10,
    description:
      '早樱开的时候人会很多，所以约早上 9 点。从正门走到樱花大道，再上樱顶，最后从梅园下来。路线以看花和拍照为主，走累了随时可以散。',
    notes: '进校可能需要预约，请提前看一下武大公众号；周末人多，注意保管随身物品。',
    tags: ['樱花', '校园', '拍照', '免费'],
    status: 'preparing',
    transport: 'walk',
    route: [
      { name: '珞珈山牌坊', note: '集合、拍合照', stayMinutes: 10 },
      { name: '樱花大道', note: '主拍照段，人流较大', stayMinutes: 40 },
      { name: '樱顶', note: '俯瞰校园，视野最好', stayMinutes: 30 },
      { name: '梅园', note: '从另一侧下山', stayMinutes: 20 },
    ],
    coverTone: 9,
    createdAgoDays: 5,
  },
  {
    id: 'a_chuhe_food',
    kind: 'individual',
    organizerId: 'u_tangtang',
    title: '楚河汉街 · 深夜食堂探店',
    category: 'food',
    start: D(2, 21, 0),
    end: D(2, 23, 0),
    meetingPoint: '楚河汉街地铁站 C 口',
    budgetMin: 60,
    budgetMax: 100,
    feeMode: 'aa',
    maxParticipants: 6,
    description:
      '汉街几家小店晚上十点后才热闹起来。计划吃三轮：先烧烤，再一家粉面，最后来一份甜品收尾。适合下班晚但不想直接回家的人。',
    notes: '人均 60–100，现场 AA；不吃辣或有忌口请在申请留言里说。',
    tags: ['夜宵', '小吃', '下班后'],
    status: 'preparing',
    transport: 'transit',
    route: [],
    coverTone: 10,
    createdAgoDays: 1,
  },
  {
    id: 'a_art_museum',
    kind: 'group',
    organizerId: 'u_yue',
    title: '武汉美术馆 · 当代水墨联展',
    category: 'exhibition',
    start: D(8, 14, 0),
    end: D(8, 16, 0),
    meetingPoint: '武汉美术馆（汉口馆）一层大厅',
    budgetMin: 0,
    budgetMax: 0,
    feeMode: 'free',
    maxParticipants: 8,
    description:
      '当代水墨联展，作品不算多但值得慢慢看。看完之后如果大家有兴趣，可以在附近的咖啡馆坐一会儿，各自说说最喜欢哪一幅。',
    notes: '免费预约入馆；馆内请勿使用闪光灯。',
    tags: ['美术馆', '水墨', '免费', '慢看'],
    status: 'preparing',
    transport: 'transit',
    route: [],
    coverTone: 11,
    createdAgoDays: 6,
  },
  {
    id: 'a_eastlake_ride',
    kind: 'group',
    organizerId: 'u_chenyu',
    title: '东湖绿道晨间骑行 20km',
    category: 'sports',
    start: new Date(Date.now() - 90 * 60_000),
    end: new Date(Date.now() + 60 * 60_000),
    meetingPoint: '东湖绿道湖光序曲驿站',
    budgetMin: 0,
    budgetMax: 20,
    feeMode: 'self',
    maxParticipants: 8,
    description: '周末早上的固定骑行局，20 公里，配速 18–20。骑完在驿站吃个早餐，各自回家补觉。',
    notes: '这是进行中的活动示例，可直接体验「模拟签到」。',
    tags: ['骑行', '晨间', '进行中'],
    status: 'ongoing',
    transport: 'bike',
    route: [
      { name: '湖光序曲驿站', note: '集合出发', stayMinutes: 10 },
      { name: '一棵树', note: '第一个休息点', stayMinutes: 10 },
      { name: '磨山北门', note: '折返', stayMinutes: 10 },
    ],
    coverTone: 12,
    createdAgoDays: 3,
  },
  {
    id: 'a_escape_room',
    kind: 'group',
    organizerId: 'u_shasha',
    title: '光谷密室逃脱 · 恐怖主题',
    category: 'boardgame',
    start: D(-2, 19, 0),
    end: D(-2, 21, 30),
    meetingPoint: '光谷步行街西班牙风情街 4 楼',
    budgetMin: 90,
    budgetMax: 120,
    feeMode: 'aa',
    maxParticipants: 6,
    description:
      '上周刚玩完的恐怖主题密室，6 人本，机关做得不错。已经结束，来评价一下这次体验，也方便下次组局参考。',
    notes: '已结束的活动，仅用于演示「待评价」状态。',
    tags: ['密室', '恐怖', '已结束'],
    status: 'awaiting_review',
    transport: 'transit',
    route: [],
    coverTone: 13,
    createdAgoDays: 6,
  },
  {
    id: 'a_hanyangzao',
    kind: 'group',
    organizerId: 'u_chenyu',
    title: '汉阳造艺术区 · 周末市集漫游',
    category: 'citywalk',
    start: D(-8, 10, 0),
    end: D(-8, 13, 0),
    meetingPoint: '汉阳造艺术区正门',
    budgetMin: 0,
    budgetMax: 30,
    feeMode: 'self',
    maxParticipants: 8,
    description:
      '上周末的市集漫游，走完了整个园区，看了 6 个工作室。有人买到了手作耳环，有人只喝了杯咖啡。已经结束，可以查看评价与旅行名片。',
    notes: '已结束的活动，仅用于演示「已结束 / 旅行名片」。',
    tags: ['市集', '手作', '已结束'],
    status: 'completed',
    transport: 'walk',
    route: [
      { name: '汉阳造正门', note: '集合', stayMinutes: 10 },
      { name: '旧厂房展区', note: '看独立工作室', stayMinutes: 40 },
      { name: '周末市集', note: '手作摊位', stayMinutes: 50 },
      { name: '园区咖啡', note: '坐下来聊各自买的东西', stayMinutes: 30 },
    ],
    coverTone: 14,
    createdAgoDays: 12,
  },
  {
    id: 'a_light_show',
    kind: 'group',
    organizerId: 'u_ahu',
    title: '长江灯光秀 · 夜拍机位踩点',
    category: 'show',
    start: D(3, 19, 30),
    end: D(3, 21, 0),
    meetingPoint: '汉口江滩三阳广场',
    budgetMin: 0,
    budgetMax: 0,
    feeMode: 'free',
    maxParticipants: 6,
    description: '原计划组织一次灯光秀夜拍，因为天气原因取消了。保留这条记录，方便说明取消后成员收到的是同一条通知。',
    notes: '活动已取消，不再接受申请。',
    tags: ['夜拍', '已取消'],
    status: 'cancelled',
    transport: 'walk',
    route: [],
    coverTone: 15,
    createdAgoDays: 4,
  },
];

// 修正进行中活动的结束时间（构造后统一处理，避免在字面量里写复杂的日期运算）
const activities: Activity[] = activitySeeds.map((seed) => mkActivity(seed));

// ---------------------------------------------------------------- 成员 / 申请

interface MembershipSeed {
  activityId: string;
  userId: string;
  role: ActivityMember['role'];
  attendance?: ActivityMember['attendance'];
  joinedAgoHours?: number;
}

const membershipSeeds: MembershipSeed[] = [
  // a_donghu_sunset：组织者 + 2 位已通过成员（还剩 5 个名额）
  { activityId: 'a_donghu_sunset', userId: 'u_chenyu', role: 'organizer', joinedAgoHours: 72 },
  { activityId: 'a_donghu_sunset', userId: 'u_tangtang', role: 'participant', joinedAgoHours: 40 },
  { activityId: 'a_donghu_sunset', userId: 'u_yue', role: 'participant', joinedAgoHours: 30 },
  // a_huanghelou_night：4 人
  { activityId: 'a_huanghelou_night', userId: 'u_chenyu', role: 'organizer', joinedAgoHours: 48 },
  { activityId: 'a_huanghelou_night', userId: 'u_yue', role: 'participant', joinedAgoHours: 36 },
  { activityId: 'a_huanghelou_night', userId: 'u_ahu', role: 'participant', joinedAgoHours: 30 },
  { activityId: 'a_huanghelou_night', userId: 'u_tangtang', role: 'participant', joinedAgoHours: 20 },
  // a_tanhu咖啡：1 人（月野待审核）
  { activityId: 'a_tanhu咖啡', userId: 'u_tangtang', role: 'organizer', joinedAgoHours: 96 },
  // a_hubei_museum
  { activityId: 'a_hubei_museum', userId: 'u_yue', role: 'organizer', joinedAgoHours: 120 },
  { activityId: 'a_hubei_museum', userId: 'u_shasha', role: 'participant', joinedAgoHours: 80 },
  // a_boardgame_night：小满组织，4/6
  { activityId: 'a_boardgame_night', userId: 'u_lixiaoman', role: 'organizer', joinedAgoHours: 140 },
  { activityId: 'a_boardgame_night', userId: 'u_tangtang', role: 'participant', joinedAgoHours: 100 },
  { activityId: 'a_boardgame_night', userId: 'u_ahu', role: 'participant', joinedAgoHours: 90 },
  { activityId: 'a_boardgame_night', userId: 'u_yue', role: 'participant', joinedAgoHours: 60 },
  // a_riverside_run
  { activityId: 'a_riverside_run', userId: 'u_ahu', role: 'organizer', joinedAgoHours: 48 },
  { activityId: 'a_riverside_run', userId: 'u_chenyu', role: 'participant', joinedAgoHours: 30 },
  // a_zhiyinhao：3/4，快满
  { activityId: 'a_zhiyinhao', userId: 'u_shasha', role: 'organizer', joinedAgoHours: 72 },
  { activityId: 'a_zhiyinhao', userId: 'u_yue', role: 'participant', joinedAgoHours: 50 },
  { activityId: 'a_zhiyinhao', userId: 'u_tangtang', role: 'participant', joinedAgoHours: 40 },
  // a_qingshan_ride
  { activityId: 'a_qingshan_ride', userId: 'u_chenyu', role: 'organizer', joinedAgoHours: 96 },
  // a_wuda_cherry
  { activityId: 'a_wuda_cherry', userId: 'u_yue', role: 'organizer', joinedAgoHours: 120 },
  { activityId: 'a_wuda_cherry', userId: 'u_shasha', role: 'participant', joinedAgoHours: 90 },
  { activityId: 'a_wuda_cherry', userId: 'u_ahu', role: 'participant', joinedAgoHours: 70 },
  // a_chuhe_food：小满是已通过成员（准备中 tab）
  { activityId: 'a_chuhe_food', userId: 'u_tangtang', role: 'organizer', joinedAgoHours: 24 },
  { activityId: 'a_chuhe_food', userId: 'u_lixiaoman', role: 'participant', joinedAgoHours: 12 },
  { activityId: 'a_chuhe_food', userId: 'u_ahu', role: 'participant', joinedAgoHours: 8 },
  // a_art_museum
  { activityId: 'a_art_museum', userId: 'u_yue', role: 'organizer', joinedAgoHours: 140 },
  // a_eastlake_ride（进行中）：小满是成员，可签到
  { activityId: 'a_eastlake_ride', userId: 'u_chenyu', role: 'organizer', joinedAgoHours: 72 },
  { activityId: 'a_eastlake_ride', userId: 'u_lixiaoman', role: 'participant', joinedAgoHours: 48 },
  { activityId: 'a_eastlake_ride', userId: 'u_ahu', role: 'participant', joinedAgoHours: 40 },
  { activityId: 'a_eastlake_ride', userId: 'u_tangtang', role: 'participant', joinedAgoHours: 30 },
  // a_escape_room（待评价）：小满是成员且未评价
  { activityId: 'a_escape_room', userId: 'u_shasha', role: 'organizer', joinedAgoHours: 160 },
  { activityId: 'a_escape_room', userId: 'u_lixiaoman', role: 'participant', joinedAgoHours: 150 },
  { activityId: 'a_escape_room', userId: 'u_tangtang', role: 'participant', joinedAgoHours: 140 },
  // a_hanyangzao（已结束）：小满已评价，可看旅行名片
  { activityId: 'a_hanyangzao', userId: 'u_chenyu', role: 'organizer', joinedAgoHours: 320 },
  { activityId: 'a_hanyangzao', userId: 'u_lixiaoman', role: 'participant', joinedAgoHours: 300 },
  { activityId: 'a_hanyangzao', userId: 'u_yue', role: 'participant', joinedAgoHours: 280 },
  { activityId: 'a_hanyangzao', userId: 'u_ahu', role: 'participant', joinedAgoHours: 260 },
  // a_light_show（已取消）：成员收到取消说明
  { activityId: 'a_light_show', userId: 'u_ahu', role: 'organizer', joinedAgoHours: 96 },
  { activityId: 'a_light_show', userId: 'u_lixiaoman', role: 'participant', joinedAgoHours: 80 },
  { activityId: 'a_light_show', userId: 'u_tangtang', role: 'participant', joinedAgoHours: 70 },
];

const members: ActivityMember[] = membershipSeeds.map((seed, index) => ({
  id: `member_${index + 1}`,
  activityId: seed.activityId,
  userId: seed.userId,
  role: seed.role,
  attendance: seed.attendance ?? 'pending',
  joinedAt: ago(seed.joinedAgoHours ?? 24),
}));

interface ApplicationSeed {
  activityId: string;
  userId: string;
  status: ApplicationStatus;
  message: string;
  createdAgoHours: number;
}

const applicationSeeds: ApplicationSeed[] = [
  // 小满 → 东湖落日：待审核（演示「申请中」）
  {
    activityId: 'a_donghu_sunset',
    userId: 'u_lixiaoman',
    status: 'pending',
    message: '我可以带一台相机，路上帮大家拍照。',
    createdAgoHours: 6,
  },
  {
    activityId: 'a_donghu_sunset',
    userId: 'u_ahu',
    status: 'pending',
    message: '骑完车直接过来，可能会晚 10 分钟。',
    createdAgoHours: 4,
  },
  // 小满组织的桌游局：两条待审核申请（演示组织者审核）
  {
    activityId: 'a_boardgame_night',
    userId: 'u_shasha',
    status: 'pending',
    message: '阿瓦隆熟手，可以带新手。',
    createdAgoHours: 5,
  },
  {
    activityId: 'a_boardgame_night',
    userId: 'u_chenyu',
    status: 'pending',
    message: '第一次玩卡坦岛，可以吗？',
    createdAgoHours: 3,
  },
  // 已通过申请（成员由成员表维护，这里保留申请记录用于状态展示）
  {
    activityId: 'a_boardgame_night',
    userId: 'u_tangtang',
    status: 'approved',
    message: '老玩家，带了扩展包。',
    createdAgoHours: 100,
  },
  {
    activityId: 'a_boardgame_night',
    userId: 'u_ahu',
    status: 'approved',
    message: '准时到。',
    createdAgoHours: 90,
  },
  {
    activityId: 'a_boardgame_night',
    userId: 'u_yue',
    status: 'approved',
    message: '想学，会提前看规则。',
    createdAgoHours: 60,
  },
  {
    activityId: 'a_chuhe_food',
    userId: 'u_lixiaoman',
    status: 'approved',
    message: '不吃香菜，其他都好。',
    createdAgoHours: 12,
  },
  {
    activityId: 'a_eastlake_ride',
    userId: 'u_lixiaoman',
    status: 'approved',
    message: '共享单车可以吗？',
    createdAgoHours: 48,
  },
  {
    activityId: 'a_escape_room',
    userId: 'u_lixiaoman',
    status: 'approved',
    message: '有点怕但想试。',
    createdAgoHours: 150,
  },
  {
    activityId: 'a_hanyangzao',
    userId: 'u_lixiaoman',
    status: 'approved',
    message: '想看看手作市集。',
    createdAgoHours: 300,
  },
  {
    activityId: 'a_light_show',
    userId: 'u_lixiaoman',
    status: 'approved',
    message: '带三脚架。',
    createdAgoHours: 80,
  },
  // 月野 → 昙华林咖啡：待审核（唐糖来审核）
  {
    activityId: 'a_tanhu咖啡',
    userId: 'u_yue',
    status: 'pending',
    message: '可以只喝茶吗？',
    createdAgoHours: 10,
  },
];

const applications: Application[] = applicationSeeds.map((seed, index) => ({
  id: `app_${index + 1}`,
  activityId: seed.activityId,
  userId: seed.userId,
  message: seed.message,
  status: seed.status,
  createdAt: ago(seed.createdAgoHours),
  updatedAt: ago(seed.createdAgoHours),
}));

// ---------------------------------------------------------------- 群聊

interface ConversationSeed {
  activityId: string;
  messages: Array<{ senderId: string; content: string; minutesAgo: number }>;
}

const conversationSeeds: ConversationSeed[] = [
  {
    activityId: 'a_boardgame_night',
    messages: [
      { senderId: 'u_lixiaoman', content: '这周五老地方，19:30 开始，第一次来的话 19:20 到就好。', minutesAgo: 280 },
      { senderId: 'u_tangtang', content: '收到，我带点小零食。', minutesAgo: 260 },
      { senderId: 'u_ahu', content: '我可能会晚五分钟，先帮我留个位置。', minutesAgo: 180 },
      { senderId: 'u_yue', content: '请问需要提前看规则吗？', minutesAgo: 120 },
      { senderId: 'u_lixiaoman', content: '不用，来了我讲一遍，前两局可以看牌。', minutesAgo: 110 },
    ],
  },
  {
    activityId: 'a_eastlake_ride',
    messages: [
      { senderId: 'u_chenyu', content: '今天 7 点在湖光序曲驿站集合，记得带水。', minutesAgo: 200 },
      { senderId: 'u_lixiaoman', content: '到了，在驿站门口等大家。', minutesAgo: 70 },
      { senderId: 'u_ahu', content: '我从光谷方向骑过来，大概还有 10 分钟。', minutesAgo: 40 },
      { senderId: 'u_tangtang', content: '第一次骑 20km，我会不会拖后腿哈哈。', minutesAgo: 20 },
    ],
  },
  {
    activityId: 'a_escape_room',
    messages: [
      { senderId: 'u_shasha', content: '今晚 19:00 光谷步行街 4 楼集合，迟到的话让店员先带你们进场。', minutesAgo: 2900 },
      { senderId: 'u_tangtang', content: '到了，这个主题比想象中吓人。', minutesAgo: 2850 },
      { senderId: 'u_lixiaoman', content: '出来了，最后一关好难。', minutesAgo: 2800 },
    ],
  },
  {
    activityId: 'a_hanyangzao',
    messages: [
      { senderId: 'u_chenyu', content: '周六 10 点正门见，市集在园区最里面。', minutesAgo: 11900 },
      { senderId: 'u_lixiaoman', content: '我到了，门口的银杏树好漂亮。', minutesAgo: 11850 },
      { senderId: 'u_yue', content: '手作耳环摊在三号厂房，可以去看看。', minutesAgo: 11800 },
    ],
  },
  {
    activityId: 'a_donghu_sunset',
    messages: [
      { senderId: 'u_chenyu', content: '路线定了：磨山北门 → 湖心亭 → 落雁 → 听涛，全程 6 公里。', minutesAgo: 1500 },
      { senderId: 'u_yue', content: '落日大概几点？想赶上最好的光。', minutesAgo: 1400 },
      { senderId: 'u_chenyu', content: '17:50 左右到湖心亭正好。', minutesAgo: 1390 },
    ],
  },
  {
    activityId: 'a_light_show',
    messages: [
      { senderId: 'u_ahu', content: '周六灯光秀的夜拍先取消了，天气预报说有大雨。', minutesAgo: 900 },
      { senderId: 'u_tangtang', content: '好的，下次再约。', minutesAgo: 880 },
    ],
  },
];

const conversations: Conversation[] = conversationSeeds.map((seed, index) => ({
  id: `conv_${index + 1}`,
  activityId: seed.activityId,
  memberIds: members.filter((m) => m.activityId === seed.activityId).map((m) => m.userId),
  updatedAt: agoMinutes(Math.min(...seed.messages.map((m) => m.minutesAgo))),
}));

const messages: Message[] = conversationSeeds.flatMap((seed, convIndex) =>
  seed.messages.map((m, msgIndex) => ({
    id: `msg_${convIndex + 1}_${msgIndex + 1}`,
    conversationId: `conv_${convIndex + 1}`,
    senderId: m.senderId,
    content: m.content,
    createdAt: agoMinutes(m.minutesAgo),
  })),
);

// ---------------------------------------------------------------- 评价 / 同城内容 / 互动

const reviews: Review[] = [
  {
    id: 'review_1',
    activityId: 'a_hanyangzao',
    reviewerId: 'u_lixiaoman',
    rating: 5,
    tags: ['路线有趣', '氛围轻松', '时间安排合理'],
    comment: '路线比想象中丰富，旧厂房里的小工作室很好逛。组织者很会控节奏，不会让人一直站着等。',
    createdAt: ago(150),
  },
  {
    id: 'review_2',
    activityId: 'a_hanyangzao',
    reviewerId: 'u_yue',
    rating: 4,
    tags: ['组织清晰', '路线有趣'],
    comment: '市集有点小，但整体体验不错，咖啡店可以坐下来慢慢聊。',
    createdAt: ago(140),
  },
  {
    id: 'review_3',
    activityId: 'a_hanyangzao',
    reviewerId: 'u_ahu',
    rating: 4,
    tags: ['时间安排合理'],
    comment: '三小时刚好，不会太赶。',
    createdAt: ago(130),
  },
];

const posts: Post[] = [
  {
    id: 'post_1',
    userId: 'u_chenyu',
    activityId: 'a_hanyangzao',
    title: '汉阳造的旧厂房里，藏着一排安静的工作室',
    content: '周末市集之外的意外收获：三号厂房二楼有几间开放的工作室，做陶、做皮具、做版画，老板都很愿意聊天。',
    location: '汉阳造艺术区',
    category: 'citywalk',
    likeCount: 36,
    createdAt: ago(160),
  },
  {
    id: 'post_2',
    userId: 'u_tangtang',
    activityId: null,
    title: '户部巷往里走，第三家热干面才是本地人的选择',
    content: '不排队的巷子口那家，芝麻酱调得更稠，配一杯蛋酒刚好。',
    location: '户部巷',
    category: 'food',
    likeCount: 128,
    createdAt: ago(240),
  },
  {
    id: 'post_3',
    userId: 'u_yue',
    activityId: 'a_hubei_museum',
    title: '曾侯乙展厅里，我最喜欢的是一件不起眼的漆器',
    content: '大家都会在编钟前停很久，但角落那件漆器上的纹样更有意思，颜色过了两千年还是亮的。',
    location: '湖北省博物馆',
    category: 'exhibition',
    likeCount: 89,
    createdAt: ago(300),
  },
  {
    id: 'post_4',
    userId: 'u_ahu',
    activityId: 'a_riverside_run',
    title: '江滩夜跑的第三个星期：从 3 公里到 5 公里',
    content: '配速没怎么变，但跑完不那么喘了。江边的风是真的舒服。',
    location: '汉口江滩',
    category: 'sports',
    likeCount: 52,
    createdAt: ago(400),
  },
  {
    id: 'post_5',
    userId: 'u_shasha',
    activityId: 'a_escape_room',
    title: '光谷这家密室的机关，值得专门去一次',
    content: '不剧透。只说一句：第二个房间的门不是用来推的。',
    location: '光谷步行街',
    category: 'boardgame',
    likeCount: 73,
    createdAt: ago(500),
  },
  {
    id: 'post_6',
    userId: 'u_lixiaoman',
    activityId: null,
    title: '昙华林的猫，比咖啡更值得拍',
    content: '下午三点，阳光刚好穿过巷子。那只橘猫每天同一时间趴在同一个窗台上。',
    location: '昙华林',
    category: 'citywalk',
    likeCount: 41,
    createdAt: ago(600),
  },
];

const interactions: Interaction[] = [
  {
    id: 'interaction_1',
    userId: 'u_lixiaoman',
    targetType: 'post',
    targetId: 'post_1',
    actionType: 'like',
    createdAt: ago(150),
  },
  {
    id: 'interaction_2',
    userId: 'u_lixiaoman',
    targetType: 'post',
    targetId: 'post_3',
    actionType: 'save',
    createdAt: ago(290),
  },
  {
    id: 'interaction_3',
    userId: 'u_lixiaoman',
    targetType: 'post',
    targetId: 'post_6',
    actionType: 'like',
    createdAt: ago(590),
  },
];

const reports: Report[] = [];
const checkins: SafetyCheckin[] = [];

export function createInitialState(now: Date = new Date()): AppState {
  // 说明：seed 里的相对时间在模块加载时就已经算好，这里保留参数以便测试注入
  void now;
  return {
    schemaVersion: SCHEMA_VERSION,
    currentUserId: DEMO_USER_ID,
    demoDataDismissed: false,
    users: users.map((u) => ({ ...u })),
    activities: activities.map((a) => ({ ...a, routePoints: a.routePoints.map((p) => ({ ...p })) })),
    applications: applications.map((a) => ({ ...a })),
    members: members.map((m) => ({ ...m })),
    conversations: conversations.map((c) => ({ ...c, memberIds: [...c.memberIds] })),
    messages: messages.map((m) => ({ ...m })),
    reviews: reviews.map((r) => ({ ...r, tags: [...r.tags] })),
    posts: posts.map((p) => ({ ...p })),
    interactions: interactions.map((i) => ({ ...i })),
    reports: reports.map((r) => ({ ...r })),
    checkins: checkins.map((c) => ({ ...c })),
    events: [],
  };
}

/** 调试用：让 E2E 可以在页面里读到「当前 seed 里一共有多少条活动」 */
export const SEED_ACTIVITY_COUNT = activities.length;
