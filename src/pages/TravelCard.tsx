import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Activity, Review } from '@/types';
import { CATEGORY_META } from '@/types';
import { useApp } from '@/store/AppStore';
import { canReview, memberCount, viewStatusFor } from '@/domain/rules';
import {
  Avatar,
  Button,
  Cover,
  EmptyState,
  PageHead,
  StatusTag,
  useToast,
} from '@/components/ui';
import {
  ArrowRight,
  CircleAlert,
  Clock,
  Copy,
  Info,
  MapPin,
  Route as RouteIcon,
  Star,
  Trophy,
  Users,
} from '@/components/ui/icons';
import { dateTimeRange, monthDay, relativeDayTime, toDate, weekdayLabel } from '@/lib/date';
import { copyText, cx } from '@/lib/format';
import styles from './TravelCard.module.css';

function buildShareText(activity: Activity, review: Review): string {
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  return [
    `我在 HOPPA 参加了「${activity.title}」`,
    `${dateTimeRange(activity.startAt, activity.endAt)} · ${activity.meetingPoint}`,
    `我的评分：${stars}（${review.rating}/5）`,
    review.tags.length > 0 ? `感受标签：${review.tags.join('、')}` : '',
    review.comment ? `一句感受：${review.comment}` : '',
    '#HOPPA 线上相遇，线下来聚',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * 旅行名片
 *
 * - 只对「已评价」或「已结束」活动开放：没评价时给出「去评价」入口，活动没结束时说明原因；
 * - 名片内容：活动名 / 时间 / 地点 / 路线节点 / 我的评分与评价 / 组织者 / HOPPA 品牌；
 * - 分享只做「复制文案」：copyText + toast + 埋点 share_trip_card（share_method=clipboard）；
 * - 保存图片未实现，因此不展示下载按钮，只在页脚标注为后续规划。
 */
export default function TravelCardPage() {
  const { state, now, currentUser, userById, activityById, reviewOf, track } = useApp();
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [copyFailed, setCopyFailed] = useState(false);

  const activity = id ? activityById(id) : undefined;

  const handleCopy = async (target: Activity, review: Review) => {
    const text = buildShareText(target, review);
    const ok = await copyText(text);
    if (!ok) {
      setCopyFailed(true);
      toast.error('自动复制失败，请在下方手动复制分享文案');
      return;
    }
    setCopyFailed(false);
    toast.success('分享文案已复制，粘贴到任意社交平台即可（演示环境不会自动发布）');
    track('share_trip_card', { activity_id: target.id, share_method: 'clipboard' });
  };

  if (!activity) {
    return (
      <div className="page">
        <PageHead title="旅行名片" backTo="/my" />
        <EmptyState
          icon={<CircleAlert size={22} />}
          title="找不到这个活动"
          description="链接可能已经失效，或者演示数据被重置过。回到「我的活动」看看已结束的活动。"
          action={<Button to="/my">去我的活动</Button>}
        />
      </div>
    );
  }

  const review = reviewOf(activity.id);
  const isEnded = activity.status === 'completed' || activity.status === 'awaiting_review';
  const eligibility = canReview(state, activity, currentUser.id, now);
  const organizer = userById(activity.organizerId);
  const totalMembers = memberCount(state, activity.id);
  const status = viewStatusFor(state, activity, currentUser.id);

  if (!review) {
    const pageHead = (
      <PageHead title="旅行名片" sub={activity.title} backTo={`/activity/${activity.id}`} />
    );

    if (activity.status === 'cancelled') {
      return (
        <div className="page">
          {pageHead}
          <EmptyState
            icon={<Trophy size={22} />}
            title="活动已取消，没有生成旅行名片"
            description="旅行名片只在活动正常结束、并且你留下评价之后生成。"
            action={<Button to={`/activity/${activity.id}`}>返回活动详情</Button>}
          />
        </div>
      );
    }

    if (!isEnded) {
      return (
        <div className="page">
          {pageHead}
          <EmptyState
            icon={<Trophy size={22} />}
            title="活动还没结束"
            description="活动结束后才能生成旅行名片。如果活动已经结束，需要组织者把状态推进到「待评价」。"
            action={<Button to={`/activity/${activity.id}`}>返回活动详情</Button>}
          />
        </div>
      );
    }

    if (!eligibility.allowed) {
      return (
        <div className="page">
          {pageHead}
          <EmptyState
            icon={<Trophy size={22} />}
            title="暂时无法生成旅行名片"
            description={eligibility.reason ?? '只有活动成员在评价之后才能生成旅行名片。'}
            action={<Button to={`/activity/${activity.id}`}>返回活动详情</Button>}
          />
        </div>
      );
    }

    return (
      <div className="page">
        {pageHead}
        <EmptyState
          icon={<Star size={22} />}
          title="先完成评价，才能生成名片"
          description="旅行名片会带上你的评分、标签和一句感受，评价只需要 1 分钟。"
          action={
            <Button to={`/review/${activity.id}`} iconRight={<ArrowRight size={15} />}>
              去完成评价
            </Button>
          }
        />
      </div>
    );
  }

  const shareText = buildShareText(activity, review);

  return (
    <div className={cx('page', styles.page)}>
      <PageHead
        title="旅行名片"
        sub="把这次出门留在一张卡片上 · 可截图保存"
        backTo={`/activity/${activity.id}`}
      />

      <article className={styles.ticket} aria-label={`旅行名片：${activity.title}`}>
        <Cover activity={activity} height={152} iconSize={104}>
          <div className={styles.coverLayer}>
            <div className={styles.coverTop}>
              <span className="tag tag--glass">{CATEGORY_META[activity.category].label}</span>
              <span className={styles.coverCode}>
                HOPPA / {String(activity.coverTone).padStart(2, '0')}
              </span>
            </div>
            <div className={styles.coverBottom}>
              <span className={styles.coverDate}>{relativeDayTime(activity.startAt)}</span>
              <span className={styles.coverBadge}>TRIP CARD</span>
            </div>
          </div>
        </Cover>

        <div className={styles.body}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{activity.title}</h1>
            <StatusTag status={status} />
          </div>
          <p className={styles.subtitle}>
            和 {totalMembers} 位 HOPPA 伙伴一起，把周末过成了具体的一天。
          </p>

          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaIcon}>
                <Clock size={15} aria-hidden="true" />
              </span>
              <span className={styles.metaText}>
                <em>时间</em>
                {dateTimeRange(activity.startAt, activity.endAt)}
              </span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaIcon}>
                <MapPin size={15} aria-hidden="true" />
              </span>
              <span className={styles.metaText}>
                <em>地点</em>
                {activity.meetingPoint}
              </span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaIcon}>
                <Users size={15} aria-hidden="true" />
              </span>
              <span className={styles.metaText}>
                <em>人数</em>
                {totalMembers}/{activity.maxParticipants} 人
              </span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaIcon}>
                <Avatar user={organizer} size="xs" />
              </span>
              <span className={styles.metaText}>
                <em>组织者</em>
                {organizer?.nickname ?? '演示用户'}
              </span>
            </div>
          </div>

          {activity.routePoints.length > 0 && (
            <section className={styles.section} aria-label="路线节点">
              <h2 className={styles.sectionTitle}>
                <RouteIcon size={15} aria-hidden="true" />
                路线节点
              </h2>
              <div className="timeline">
                {activity.routePoints.map((point) => (
                  <div key={point.id} className="timeline__item">
                    <div className="timeline__title">{point.name}</div>
                    <div className="timeline__meta">
                      {point.note}
                      {point.stayMinutes > 0 ? ` · 建议停留 ${point.stayMinutes} 分钟` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className={styles.reviewBox} aria-label="我的评分与评价">
            <div className={styles.reviewHead}>
              <h2 className={styles.sectionTitle}>
                <Star size={15} aria-hidden="true" />
                我的评分
              </h2>
              <span className={styles.reviewDate}>{monthDay(toDate(review.createdAt))} 记录</span>
            </div>
            <div className={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={22}
                  fill={n <= review.rating ? 'currentColor' : 'none'}
                  className={n <= review.rating ? styles.starOn : styles.starOff}
                  aria-hidden="true"
                />
              ))}
              <span className={styles.score}>{review.rating}.0</span>
            </div>
            {review.tags.length > 0 && (
              <div className={styles.tagRow}>
                {review.tags.map((tag) => (
                  <span key={tag} className="tag tag--violet">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {review.comment ? (
              <blockquote className={styles.quote}>“{review.comment}”</blockquote>
            ) : (
              <p className={styles.noComment}>这次没有留下文字，但星星已经说明一切。</p>
            )}
          </section>

          <footer className={styles.footer}>
            <div className={styles.brandBlock}>
              <span className={cx('gradient-text', styles.brandWord)}>HOPPA</span>
              <span className={styles.tagline}>线上相遇 · 线下来聚</span>
            </div>
            <div className={styles.footerMeta}>
              <span>
                {monthDay(toDate(activity.startAt))} {weekdayLabel(toDate(activity.startAt))}
              </span>
              <span className={styles.demoNote}>演示数据 · 本地生成</span>
            </div>
          </footer>
        </div>
      </article>

      <div className={styles.shareArea}>
        <Button onClick={() => void handleCopy(activity, review)} iconLeft={<Copy size={16} />}>
          复制分享文案
        </Button>
        <Button variant="secondary" to={`/activity/${activity.id}`}>
          回到活动详情
        </Button>
      </div>
      <p className={styles.shareNote}>
        <Info size={13} aria-hidden="true" />
        演示环境只把文案复制到剪贴板，不会自动发布到第三方；保存图片、生成海报为后续规划，故不提供下载按钮。
      </p>

      {copyFailed && (
        <div className={styles.fallback}>
          <p>自动复制失败，请全选下面的文案手动复制：</p>
          <textarea
            className={styles.fallbackText}
            readOnly
            value={shareText}
            aria-label="分享文案"
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
    </div>
  );
}
