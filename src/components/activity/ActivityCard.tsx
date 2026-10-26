import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Activity } from '@/types';
import { ACTIVITY_STATUS_META } from '@/types';
import { budgetLabel, cx, percent } from '@/lib/format';
import { relativeDayTime } from '@/lib/date';
import { isFull, memberCount, remainingSeats } from '@/domain/rules';
import { useApp } from '@/store/AppStore';
import { Avatar, CategoryTag, Cover, StatusTag } from '@/components/ui';
import { Clock, MapPin, Users } from '@/components/ui/icons';
import styles from './ActivityCard.module.css';

// 同一次会话里同一活动只上报一次曝光，避免翻页 / 重渲染把埋点刷爆
const impressed = new Set<string>();

export function ActivityCard({
  activity,
  variant = 'grid',
  recommendation,
  showStatus = true,
  showOrganizer = true,
  footer,
}: {
  activity: Activity;
  variant?: 'grid' | 'list';
  recommendation?: string[];
  showStatus?: boolean;
  showOrganizer?: boolean;
  footer?: React.ReactNode;
}) {
  const { state, currentUser, userById, track } = useApp();
  const ref = useRef<HTMLAnchorElement>(null);
  const organizer = userById(activity.organizerId);
  const count = memberCount(state, activity.id);
  const full = isFull(state, activity);
  const remaining = remainingSeats(state, activity);
  const statusMeta = ACTIVITY_STATUS_META[activity.status];

  useEffect(() => {
    const key = `${currentUser.id}:${activity.id}`;
    const el = ref.current;
    if (!el || impressed.has(key) || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !impressed.has(key)) {
            impressed.add(key);
            track('activity_card_impression', {
              activity_id: activity.id,
              category: activity.category,
              position: Math.round(entry.boundingClientRect.top),
            });
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [activity.id, activity.category, currentUser.id, track]);

  const onClick = () => {
    track('activity_card_click', { activity_id: activity.id, category: activity.category });
  };

  if (variant === 'list') {
    return (
      <Link
        to={`/activity/${activity.id}`}
        className={cx(styles.card, styles.list, 'card card--hover')}
        onClick={onClick}
        ref={ref}
      >
        <Cover
          activity={activity}
          height={104}
          iconSize={64}
          className={styles.listCover}
        />
        <div className={styles.listBody}>
          <div className={cx('row row--wrap', styles.tags)}>
            {showStatus && <StatusTag status={activity.status} />}
            <CategoryTag category={activity.category} />
            {full && activity.status === 'preparing' && (
              <span className="tag tag--amber">已满员</span>
            )}
          </div>
          <h3 className={styles.title}>{activity.title}</h3>
          <div className={styles.meta}>
            <span>
              <Clock size={13} aria-hidden="true" />
              {relativeDayTime(activity.startAt)}
            </span>
            <span>
              <MapPin size={13} aria-hidden="true" />
              {activity.meetingPoint}
            </span>
          </div>
          <div className={cx('row row--between', styles.foot)}>
            <span className={styles.price}>{budgetLabel(activity)}</span>
            <span className={styles.seats}>
              <Users size={13} aria-hidden="true" />
              {count}/{activity.maxParticipants}
              {activity.status === 'preparing' && ` · 还剩 ${remaining}`}
            </span>
          </div>
          {footer}
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/activity/${activity.id}`}
      className={cx(styles.card, 'card card--hover')}
      onClick={onClick}
      ref={ref}
      aria-label={`${activity.title}，${statusMeta.label}`}
    >
      <Cover activity={activity} height={132} iconSize={92}>
        <div className={styles.coverOverlay}>
          <div className="row row--wrap" style={{ gap: 6 }}>
            {showStatus && <StatusTag status={activity.status} />}
            <CategoryTag category={activity.category} glass />
          </div>
          <div className={styles.coverBottom}>
            <span className={styles.coverTime}>{relativeDayTime(activity.startAt)}</span>
            <span className={styles.coverPrice}>{budgetLabel(activity)}</span>
          </div>
        </div>
      </Cover>

      <div className={styles.body}>
        <h3 className={styles.title}>{activity.title}</h3>
        <p className={styles.desc}>{activity.description}</p>

        <div className={styles.meta}>
          <span>
            <MapPin size={13} aria-hidden="true" />
            {activity.meetingPoint}
          </span>
        </div>

        <div className={styles.capacity}>
          <div className={styles.capacityTop}>
            <span>
              <Users size={13} aria-hidden="true" />
              {count}/{activity.maxParticipants} 人
            </span>
            <span className={styles.capacityHint}>
              {activity.status === 'preparing'
                ? full
                  ? '名额已满'
                  : `还剩 ${remaining} 个名额`
                : statusMeta.label}
            </span>
          </div>
          <div className="progress">
            <div className="progress__bar" style={{ width: `${percent(count, activity.maxParticipants)}%` }} />
          </div>
        </div>

        {recommendation && recommendation.length > 0 && (
          <p className={styles.reason}>推荐原因：{recommendation.join(' · ')}</p>
        )}

        {showOrganizer && (
          <div className={cx('row row--between', styles.organizer)}>
            <span className="row" style={{ gap: 8 }}>
              <Avatar user={organizer} size="xs" />
              <span className={styles.organizerName}>{organizer?.nickname ?? '演示用户'}</span>
            </span>
            <span className={styles.tagsInline}>
              {activity.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="tag tag--outline">
                  {tag}
                </span>
              ))}
            </span>
          </div>
        )}

        {footer}
      </div>
    </Link>
  );
}
