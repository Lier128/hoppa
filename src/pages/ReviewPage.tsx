import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Review } from '@/types';
import { useApp } from '@/store/AppStore';
import { canReview, memberCount, viewStatusFor } from '@/domain/rules';
import {
  Avatar,
  Button,
  CategoryTag,
  EmptyState,
  Field,
  PageHead,
  StatusTag,
  TextArea,
  useToast,
} from '@/components/ui';
import {
  ArrowRight,
  CalendarCheck,
  CircleAlert,
  CircleCheck,
  Info,
  MapPin,
  Star,
  Users,
} from '@/components/ui/icons';
import { dateTimeRange, monthDay, toDate } from '@/lib/date';
import { cx } from '@/lib/format';
import styles from './ReviewPage.module.css';

const REVIEW_TAGS = ['组织清晰', '路线有趣', '氛围轻松', '时间安排合理', '性价比高', '还想再来'];

const STARS: Array<Review['rating']> = [1, 2, 3, 4, 5];

const RATING_LABEL: Record<Review['rating'], string> = {
  1: '一般',
  2: '还行',
  3: '不错',
  4: '很棒',
  5: '超预期',
};

/**
 * 活动评价
 *
 * - 资格判断统一走 domain/rules.canReview，不在页面里散落状态字符串；
 * - 1–5 星用 button + aria-label，可键盘操作；
 * - 标签多选（最多 5 个，与 store 的 slice 上限一致）；评论 0–200 字；
 * - 提交成功 → store 内上报 review_submit → toast → 跳 /card/:id；
 * - 已评价 / 不可评价都给出原因和下一步入口。
 */
export default function ReviewPage() {
  const { state, now, currentUser, userById, activityById, reviewOf, submitReview } = useApp();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [rating, setRating] = useState<Review['rating'] | 0>(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activity = id ? activityById(id) : undefined;

  if (!activity) {
    return (
      <div className="page">
        <PageHead title="评价活动" backTo="/my" />
        <EmptyState
          icon={<CircleAlert size={22} />}
          title="找不到这个活动"
          description="链接可能已经失效，或者演示数据被重置过。回到「我的活动」看看还能评价哪些活动。"
          action={<Button to="/my">去我的活动</Button>}
        />
      </div>
    );
  }

  const existing = reviewOf(activity.id);
  const eligibility = canReview(state, activity, currentUser.id, now);
  const organizer = userById(activity.organizerId);

  // 重复评价：不再展示表单，直接给回顾名片入口
  if (existing) {
    return (
      <div className="page">
        <PageHead title="评价活动" sub={activity.title} backTo={`/activity/${activity.id}`} />
        <div className={styles.single}>
          <div className={cx('card card--pad', styles.stateCard)}>
            <span className={cx(styles.stateIcon, styles.stateIconSuccess)}>
              <CircleCheck size={26} aria-hidden="true" />
            </span>
            <h2 className={styles.stateTitle}>你已经评价过这次活动</h2>
            <p className={styles.stateDesc}>
              每人对同一活动只能评价一次，这次评价已经保存在本机。可以继续查看由它生成的旅行名片。
            </p>

            <div className={styles.reviewSummary}>
              <div className={styles.starsDisplay}>
                {STARS.map((n) => (
                  <Star
                    key={n}
                    size={19}
                    fill={n <= existing.rating ? 'currentColor' : 'none'}
                    className={n <= existing.rating ? styles.starFilled : styles.starEmpty}
                    aria-hidden="true"
                  />
                ))}
                <span className={styles.scoreText}>{existing.rating} 分</span>
              </div>
              {existing.tags.length > 0 && (
                <div className={styles.tagRow}>
                  {existing.tags.map((tag) => (
                    <span key={tag} className="tag tag--violet">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {existing.comment && <p className={styles.existingComment}>“{existing.comment}”</p>}
              <p className={styles.existingMeta}>
                {monthDay(toDate(existing.createdAt))} 提交 · 不可重复提交
              </p>
            </div>

            <div className={styles.stateActions}>
              <Button to={`/card/${activity.id}`} iconRight={<ArrowRight size={15} />}>
                查看旅行名片
              </Button>
              <Button variant="secondary" to={`/activity/${activity.id}`}>
                返回活动详情
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 不满足评价条件：说明原因 + 返回活动
  if (!eligibility.allowed) {
    return (
      <div className="page">
        <PageHead title="评价活动" sub={activity.title} backTo={`/activity/${activity.id}`} />
        <div className={styles.single}>
          <div className={cx('card card--pad', styles.stateCard)}>
            <span className={styles.stateIcon}>
              <Info size={26} aria-hidden="true" />
            </span>
            <h2 className={styles.stateTitle}>现在还不能评价</h2>
            <p className={styles.stateDesc}>{eligibility.reason ?? '当前不满足评价条件。'}</p>
            <p className={styles.stateHint}>
              评价入口会在活动进入「待评价」后开放；只有活动成员可以评价，且每人每个活动只能评价一次。
            </p>
            <div className={styles.stateActions}>
              <Button to={`/activity/${activity.id}`}>返回活动详情</Button>
              <Button variant="secondary" to="/my">
                去我的活动
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const toggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      setTags((current) => current.filter((item) => item !== tag));
      return;
    }
    if (tags.length >= 5) {
      toast.info('标签最多选择 5 个');
      return;
    }
    setTags((current) => [...current, tag]);
  };

  const handleSubmit = () => {
    if (rating === 0) {
      setError('请先选择 1–5 星评分');
      return;
    }
    setError(null);
    const result = submitReview(activity.id, { rating, tags, comment });
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success('评价已提交，正在生成你的旅行名片');
    navigate(`/card/${activity.id}`);
  };

  return (
    <div className="page">
      <PageHead
        title="评价这次活动"
        sub="打分和标签会用于生成旅行名片；评价只保存在本机（演示环境）。"
        backTo={`/activity/${activity.id}`}
      />

      <div className={styles.layout}>
        <div className={cx('card card--pad', styles.form)}>
          <div className={styles.activityBrief}>
            <div className={styles.briefTags}>
              <CategoryTag category={activity.category} />
              <StatusTag status={viewStatusFor(state, activity, currentUser.id)} />
            </div>
            <h2 className={styles.briefTitle}>{activity.title}</h2>
            <p className={styles.briefMeta}>
              <span>
                <CalendarCheck size={13} aria-hidden="true" />
                {dateTimeRange(activity.startAt, activity.endAt)}
              </span>
              <span>
                <MapPin size={13} aria-hidden="true" />
                {activity.meetingPoint}
              </span>
            </p>
          </div>

          <hr className="divider" />

          <Field label="整体评分" required hint="1 分最低，5 分最高；可用 Tab 聚焦星星后按 Enter 选择">
            <div className={styles.stars} role="group" aria-label="整体评分">
              {STARS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={cx(styles.star, n <= rating && styles.starOn)}
                  aria-label={`${n} 星`}
                  aria-pressed={rating === n}
                  title={`${n} 星`}
                  onClick={() => setRating(n)}
                >
                  <Star size={32} fill={n <= rating ? 'currentColor' : 'none'} aria-hidden="true" />
                </button>
              ))}
            </div>
            <p className={styles.ratingText}>
              {rating ? `${rating} 分 · ${RATING_LABEL[rating]}` : '还没有选择评分'}
            </p>
          </Field>

          <Field label="这次体验的标签" hint={`可多选，最多 5 个 · 已选 ${tags.length}/5`}>
            <div className={styles.tagChips}>
              {REVIEW_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="chip"
                  aria-pressed={tags.includes(tag)}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </Field>

          <Field label="想说的话" hint={`${comment.length}/200 字 · 选填`} htmlFor="review-comment">
            <TextArea
              id="review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={200}
              rows={4}
              placeholder="路线安排、组织者、氛围… 写一句给未来的自己，也给组织者一点反馈。"
            />
          </Field>

          {error && (
            <div className="notice notice--warn" role="alert">
              <CircleAlert size={15} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className={styles.formFoot}>
            <span className={styles.localNote}>
              <Info size={13} aria-hidden="true" />
              提交后不可重复评价，会直接跳转到旅行名片。
            </span>
            <Button onClick={handleSubmit} disabled={rating === 0} iconLeft={<Star size={16} />}>
              提交评价
            </Button>
          </div>
        </div>

        <aside className={styles.aside}>
          <div className={cx('card card--pad', styles.asideCard)}>
            <h3 className={styles.asideTitle}>活动信息</h3>
            <div className="meta-list">
              <div className="meta-item">
                <CalendarCheck className="meta-item__icon" size={15} aria-hidden="true" />
                <span className="meta-item__label">时间</span>
                <span className="meta-item__value">
                  {dateTimeRange(activity.startAt, activity.endAt)}
                </span>
              </div>
              <div className="meta-item">
                <MapPin className="meta-item__icon" size={15} aria-hidden="true" />
                <span className="meta-item__label">集合地点</span>
                <span className="meta-item__value">{activity.meetingPoint}</span>
              </div>
              <div className="meta-item">
                <Users className="meta-item__icon" size={15} aria-hidden="true" />
                <span className="meta-item__label">参与人数</span>
                <span className="meta-item__value">
                  {memberCount(state, activity.id)}/{activity.maxParticipants} 人
                </span>
              </div>
              <div className="meta-item">
                <Avatar user={organizer} size="xs" />
                <span className="meta-item__label">组织者</span>
                <span className="meta-item__value">{organizer?.nickname ?? '演示用户'}</span>
              </div>
            </div>

            {activity.notes && <p className={styles.notes}>注意事项：{activity.notes}</p>}

            <Link to={`/activity/${activity.id}`} className={styles.asideLink}>
              查看活动详情
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
