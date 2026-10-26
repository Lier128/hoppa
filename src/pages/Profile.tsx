import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Transport, User } from '@/types';
import { TRANSPORT_META } from '@/types';
import { useApp } from '@/store/AppStore';
import { myActivities } from '@/domain/rules';
import { ActivityCard } from '@/components/activity/ActivityCard';
import {
  Avatar,
  Button,
  EmptyState,
  Field,
  InputField,
  Modal,
  PageHead,
  TextArea,
  useToast,
} from '@/components/ui';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Compass,
  Info,
  MapPinned,
  Pencil,
  Plus,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from '@/components/ui/icons';
import { monthDay, toDate } from '@/lib/date';
import { cx } from '@/lib/format';
import styles from './Profile.module.css';

// ---------------------------------------------------------------- 编辑资料常量

type ProfileDraft = {
  nickname: string;
  bio: string;
  interests: string[];
  tags: string[];
  transportPreference: Transport;
  budgetPreference: User['budgetPreference'];
  avatarColor: string;
};

type DraftErrors = {
  nickname?: string;
  bio?: string;
  interests?: string;
  tags?: string;
  submit?: string;
};

const PRESET_INTERESTS = [
  'City Walk',
  '展览',
  '摄影',
  '咖啡',
  '桌游',
  '美食',
  '骑行',
  '演出',
  '运动',
  '老建筑',
  '电影',
  '露营',
];

const PRESET_TAGS = ['慢热', '拍照担当', '路线控', '气氛组', '社牛', '守时', '会带路', '安静', '靠谱', '夜猫子'];

const AVATAR_COLORS = [
  '#ff5fa2',
  '#d946a6',
  '#7b5cff',
  '#8f7bff',
  '#ff8a5b',
  '#f4762f',
  '#22b8a8',
  '#0f9e94',
];

const TRANSPORT_OPTIONS: Transport[] = ['walk', 'transit', 'bike', 'drive', 'other'];

const BUDGET_OPTIONS: Array<{ value: User['budgetPreference']; label: string }> = [
  { value: 'low', label: '能省则省' },
  { value: 'mid', label: '适中舒适' },
  { value: 'high', label: '愿意多花' },
];

function toDraft(user: User): ProfileDraft {
  return {
    nickname: user.nickname,
    bio: user.bio,
    interests: [...user.interests],
    tags: [...user.tags],
    transportPreference: user.transportPreference,
    budgetPreference: user.budgetPreference,
    avatarColor: user.avatarColor,
  };
}

/** 快捷入口卡片：有目标时是可点击链接，没有目标时保持静态并标注「暂无」 */
function QuickCard({
  icon,
  title,
  desc,
  to,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  to?: string;
}) {
  const content = (
    <>
      <span className={styles.quickIcon}>{icon}</span>
      <span className={styles.quickText}>
        <strong>{title}</strong>
        <span>{desc}</span>
      </span>
      {to ? (
        <ArrowRight size={16} className={styles.quickArrow} aria-hidden="true" />
      ) : (
        <span className={styles.quickTag}>暂无</span>
      )}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cx('card card--hover', styles.quickCard)}>
        {content}
      </Link>
    );
  }
  return (
    <div className={cx('card', styles.quickCard, styles.quickCardMuted)} aria-disabled="true">
      {content}
    </div>
  );
}

export default function ProfilePage() {
  const { state, now, currentUser, updateProfile } = useApp();
  const toast = useToast();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>(() => toDraft(currentUser));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [customInterest, setCustomInterest] = useState('');
  const [customTag, setCustomTag] = useState('');

  const me = currentUser;
  const myMemberships = state.members.filter((member) => member.userId === me.id);
  const { participating } = myActivities(state, me.id);

  const participatedCount = myMemberships.length;
  const organizedCount = state.activities.filter((activity) => activity.organizerId === me.id).length;
  const organizedIds = new Set(
    state.activities.filter((activity) => activity.organizerId === me.id).map((activity) => activity.id),
  );
  // 获得评价：我组织的活动收到的评价条数（演示口径，在下方注明）
  const receivedReviewCount = state.reviews.filter((review) => organizedIds.has(review.activityId)).length;

  // 「最近活动」：参与 / 发起过的活动里，开始时间离现在最近的 3 条
  const nowTime = now.getTime();
  const recentActivities = [...participating]
    .sort(
      (a, b) =>
        Math.abs(toDate(a.startAt).getTime() - nowTime) -
        Math.abs(toDate(b.startAt).getTime() - nowTime),
    )
    .slice(0, 3);

  // 旅行名片入口：优先取「我评价过的已结束活动」，否则取我参与过的已结束活动
  const reviewedActivity = state.activities.find((activity) =>
    state.reviews.some((review) => review.activityId === activity.id && review.reviewerId === me.id),
  );
  const completedActivity = state.activities.find(
    (activity) =>
      activity.status === 'completed' &&
      myMemberships.some((member) => member.activityId === activity.id),
  );
  const cardActivity = reviewedActivity ?? completedActivity;

  // 安全中心：只有「进行中 + 我是成员」时才有可用入口，否则隐藏
  const ongoingActivity = state.activities.find(
    (activity) =>
      activity.status === 'ongoing' &&
      myMemberships.some((member) => member.activityId === activity.id),
  );

  const avatarColors = AVATAR_COLORS.includes(me.avatarColor)
    ? AVATAR_COLORS
    : [me.avatarColor, ...AVATAR_COLORS];

  const openEdit = () => {
    setDraft(toDraft(me));
    setErrors({});
    setCustomInterest('');
    setCustomTag('');
    setEditing(true);
  };

  const closeEdit = () => {
    // 取消编辑不落库：直接丢弃 draft，已保存值不变
    setEditing(false);
  };

  const toggleInterest = (tag: string) => {
    if (draft.interests.includes(tag)) {
      setDraft((current) => ({
        ...current,
        interests: current.interests.filter((item) => item !== tag),
      }));
      return;
    }
    if (draft.interests.length >= 8) {
      toast.info('兴趣标签最多 8 个');
      return;
    }
    setDraft((current) => ({ ...current, interests: [...current.interests, tag] }));
  };

  const addInterest = () => {
    const value = customInterest.trim();
    if (!value) return;
    if (draft.interests.includes(value)) {
      toast.info('这个兴趣标签已经加过了');
      return;
    }
    if (draft.interests.length >= 8) {
      toast.info('兴趣标签最多 8 个');
      return;
    }
    setDraft((current) => ({ ...current, interests: [...current.interests, value] }));
    setCustomInterest('');
  };

  const toggleTag = (tag: string) => {
    if (draft.tags.includes(tag)) {
      setDraft((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }));
      return;
    }
    if (draft.tags.length >= 5) {
      toast.info('个性标签最多 5 个');
      return;
    }
    setDraft((current) => ({ ...current, tags: [...current.tags, tag] }));
  };

  const addTag = () => {
    const value = customTag.trim();
    if (!value) return;
    if (draft.tags.includes(value)) {
      toast.info('这个个性标签已经加过了');
      return;
    }
    if (draft.tags.length >= 5) {
      toast.info('个性标签最多 5 个');
      return;
    }
    setDraft((current) => ({ ...current, tags: [...current.tags, value] }));
    setCustomTag('');
  };

  const saveProfile = () => {
    const nickname = draft.nickname.trim();
    const nextErrors: DraftErrors = {};
    if (nickname.length < 2 || nickname.length > 20) nextErrors.nickname = '昵称需为 2–20 个字符';
    if (draft.bio.length > 80) nextErrors.bio = '个人简介最多 80 个字符';
    if (draft.interests.length > 8) nextErrors.interests = '兴趣标签最多 8 个';
    if (draft.tags.length > 5) nextErrors.tags = '个性标签最多 5 个';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const result = updateProfile({
      nickname,
      bio: draft.bio.trim(),
      interests: draft.interests,
      tags: draft.tags,
      transportPreference: draft.transportPreference,
      budgetPreference: draft.budgetPreference,
      avatarColor: draft.avatarColor,
    });
    if (!result.ok) {
      setErrors({
        submit: result.error,
        ...(result.field === 'nickname' ? { nickname: result.error } : {}),
        ...(result.field === 'bio' ? { bio: result.error } : {}),
        ...(result.field === 'interests' ? { interests: result.error } : {}),
        ...(result.field === 'tags' ? { tags: result.error } : {}),
      });
      return;
    }

    setEditing(false);
    toast.success('资料已保存，活动与消息里的头像昵称会同步更新');
  };

  return (
    <div className="page">
      <PageHead
        title="个人中心"
        sub="演示身份资料保存在本机浏览器；不带真实手机号、住址或证件信息。"
        actions={
          <Button variant="soft" iconLeft={<Pencil size={15} />} onClick={openEdit}>
            编辑资料
          </Button>
        }
      />

      {/* 个人头部 */}
      <section className={styles.hero} aria-label="个人资料">
        <div className={styles.heroBanner} aria-hidden="true">
          <span className={styles.heroBrand}>HOPPA</span>
        </div>
        <div className={styles.heroBody}>
          <span className={styles.avatarRing}>
            <Avatar user={me} size="xl" />
          </span>
          <div className={styles.heroMain}>
            <div className={styles.nameRow}>
              <h2 className={styles.name}>{me.nickname}</h2>
              <span className="tag tag--pink">{me.city}</span>
              <span className="demo-badge">演示账号</span>
            </div>
            <p className={styles.bio}>{me.bio || '还没有填写个人简介，可以点右上角「编辑资料」补一句。'}</p>
            {me.interests.length > 0 && (
              <div className={styles.tagRow} aria-label="兴趣标签">
                {me.interests.map((tag) => (
                  <span key={tag} className="tag tag--pink">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {me.tags.length > 0 && (
              <div className={styles.tagRow} aria-label="个性标签">
                {me.tags.map((tag) => (
                  <span key={tag} className="tag tag--outline">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className={styles.prefs}>
              <span>
                <Compass size={13} aria-hidden="true" />
                偏好{TRANSPORT_META[me.transportPreference]}
              </span>
              <span>
                <Wallet size={13} aria-hidden="true" />
                预算{me.budgetPreference === 'low' ? '能省则省' : me.budgetPreference === 'mid' ? '适中' : '愿意多花'}
              </span>
              <span>
                <CalendarDays size={13} aria-hidden="true" />
                加入于 {monthDay(toDate(me.joinedAt))}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 统计卡 */}
      <section className="section" aria-label="活动统计">
        <div className="section__head">
          <h2 className="section__title">数据概览</h2>
          <span className="demo-badge">演示数据</span>
        </div>
        <div className="stat-row">
          <div className="stat">
            <div className="stat__value">{participatedCount}</div>
            <div className="stat__label">参与活动</div>
          </div>
          <div className="stat">
            <div className="stat__value">{organizedCount}</div>
            <div className="stat__label">发起活动</div>
          </div>
          <div className="stat">
            <div className="stat__value">{receivedReviewCount}</div>
            <div className="stat__label">获得评价</div>
          </div>
        </div>
        <p className={styles.statsHint}>
          统计口径：参与 = 作为成员加入的活动数；发起 = 我担任组织者的活动数；获得评价 = 我发起的活动收到的评价数。
        </p>
      </section>

      {/* 最近活动 */}
      <section className="section" aria-label="最近活动">
        <div className="section__head">
          <h2 className="section__title">最近活动</h2>
          <Link to="/my" className={styles.moreLink}>
            查看全部
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {recentActivities.length > 0 ? (
          <div className={styles.recentGrid}>
            {recentActivities.map((activity) => {
              const isOrganizer = activity.organizerId === me.id;
              return (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  variant="list"
                  footer={
                    <span className={isOrganizer ? 'tag tag--violet' : 'tag tag--slate'}>
                      {isOrganizer ? '我发起的' : '我参与的'}
                    </span>
                  }
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Users size={22} />}
            title="还没有参加过活动"
            description="去「找搭子」挑一个感兴趣的活动，申请通过后就会出现在这里。"
            action={<Button to="/buddy">去找搭子</Button>}
          />
        )}
      </section>

      {/* 快捷入口 */}
      <section className="section" aria-label="快捷入口">
        <div className="section__head">
          <h2 className="section__title">快捷入口</h2>
        </div>
        <div className={styles.quickGrid}>
          <QuickCard
            icon={<CalendarDays size={20} aria-hidden="true" />}
            title="我的活动"
            desc="准备中 / 进行中 / 待评价 / 已结束"
            to="/my"
          />
          <QuickCard
            icon={<MapPinned size={20} aria-hidden="true" />}
            title="旅行名片"
            desc={cardActivity ? `「${cardActivity.title}」` : '完成一次活动并评价后解锁'}
            to={cardActivity ? `/card/${cardActivity.id}` : undefined}
          />
          {ongoingActivity && (
            <QuickCard
              icon={<ShieldCheck size={20} aria-hidden="true" />}
              title="安全中心"
              desc={`进行中：${ongoingActivity.title}`}
              to={`/safety/${ongoingActivity.id}`}
            />
          )}
        </div>
        <p className={styles.quickNote}>
          <Info size={13} aria-hidden="true" />
          收藏、消息通知设置等能力不在本次 MVP 范围，暂不展示入口，避免出现点了没反应的按钮。
        </p>
      </section>

      {/* 编辑资料 */}
      <Modal
        open={editing}
        onClose={closeEdit}
        title="编辑资料"
        wide
        description="资料只保存在本机浏览器（演示环境）。保存后，活动详情和群聊里的头像、昵称会同步更新。"
        footer={
          <>
            <Button variant="secondary" onClick={closeEdit}>
              取消
            </Button>
            <Button onClick={saveProfile} iconLeft={<Check size={16} />}>
              保存资料
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          {errors.submit && (
            <div className="notice notice--warn" role="alert">
              <Info size={15} aria-hidden="true" />
              <span>{errors.submit}</span>
            </div>
          )}

          <Field label="头像颜色" hint="演示版头像用「昵称首字 + 渐变底色」生成，不引用真实照片。">
            <div className={styles.swatches} role="group" aria-label="选择头像颜色">
              {avatarColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={cx(styles.swatch, draft.avatarColor === color && styles.swatchOn)}
                  style={{ background: color }}
                  aria-label={`选择头像颜色 ${color}`}
                  aria-pressed={draft.avatarColor === color}
                  onClick={() => setDraft((current) => ({ ...current, avatarColor: color }))}
                />
              ))}
            </div>
          </Field>

          <InputField
            label="昵称"
            required
            value={draft.nickname}
            onChange={(value) => setDraft((current) => ({ ...current, nickname: value }))}
            maxLength={20}
            error={errors.nickname}
            hint="2–20 个字符"
          />

          <Field
            label="个人简介"
            hint={`${draft.bio.length}/80 个字符`}
            error={errors.bio}
            htmlFor="profile-bio"
          >
            <TextArea
              id="profile-bio"
              value={draft.bio}
              onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))}
              maxLength={80}
              rows={3}
              placeholder="用一句话介绍自己，比如：在武汉做设计，周末喜欢用脚步把地图走一遍。"
            />
          </Field>

          <Field
            label="兴趣标签"
            hint={`已选 ${draft.interests.length}/8 · 点选常用标签，或自己输入后点「添加」`}
            error={errors.interests}
          >
            <div className={styles.chipGroup}>
              {PRESET_INTERESTS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="chip"
                  aria-pressed={draft.interests.includes(tag)}
                  onClick={() => toggleInterest(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className={styles.customRow}>
              <input
                className="input"
                value={customInterest}
                onChange={(event) => setCustomInterest(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  addInterest();
                }}
                maxLength={10}
                placeholder="自定义兴趣，如：露营"
                aria-label="自定义兴趣标签"
              />
              <Button
                variant="soft"
                size="sm"
                onClick={addInterest}
                disabled={draft.interests.length >= 8 || !customInterest.trim()}
                iconLeft={<Plus size={14} />}
              >
                添加
              </Button>
            </div>
            {draft.interests.length > 0 && (
              <div className={styles.selectedRow} aria-label="已选兴趣标签">
                {draft.interests.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={styles.selectedChip}
                    onClick={() => toggleInterest(tag)}
                    aria-label={`移除兴趣标签 ${tag}`}
                  >
                    {tag}
                    <X size={12} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </Field>

          <Field
            label="个性标签"
            hint={`已选 ${draft.tags.length}/5 · 会显示在个人名片上`}
            error={errors.tags}
          >
            <div className={styles.chipGroup}>
              {PRESET_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="chip"
                  aria-pressed={draft.tags.includes(tag)}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className={styles.customRow}>
              <input
                className="input"
                value={customTag}
                onChange={(event) => setCustomTag(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  addTag();
                }}
                maxLength={10}
                placeholder="自定义个性标签"
                aria-label="自定义个性标签"
              />
              <Button
                variant="soft"
                size="sm"
                onClick={addTag}
                disabled={draft.tags.length >= 5 || !customTag.trim()}
                iconLeft={<Plus size={14} />}
              >
                添加
              </Button>
            </div>
            {draft.tags.length > 0 && (
              <div className={styles.selectedRow} aria-label="已选个性标签">
                {draft.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={styles.selectedChip}
                    onClick={() => toggleTag(tag)}
                    aria-label={`移除个性标签 ${tag}`}
                  >
                    {tag}
                    <X size={12} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </Field>

          <Field label="出行偏好" hint="用于找搭子时匹配推荐，不作为安全判断依据。">
            <div className={styles.chipGroup}>
              {TRANSPORT_OPTIONS.map((transport) => (
                <button
                  key={transport}
                  type="button"
                  className="chip"
                  aria-pressed={draft.transportPreference === transport}
                  onClick={() =>
                    setDraft((current) => ({ ...current, transportPreference: transport }))
                  }
                >
                  {TRANSPORT_META[transport]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="预算偏好" hint="只是推荐参考，不代表支付承诺。">
            <div className={styles.chipGroup}>
              {BUDGET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="chip"
                  aria-pressed={draft.budgetPreference === option.value}
                  onClick={() =>
                    setDraft((current) => ({ ...current, budgetPreference: option.value }))
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
