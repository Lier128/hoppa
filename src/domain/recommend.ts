import type { Activity, User } from '@/types';
import { CATEGORY_META, TRANSPORT_META } from '@/types';
import { isWeekend, timeOfDayBucket, toDate } from '@/lib/date';

export interface Recommendation {
  reasons: string[];
  score: number;
}

/**
 * 透明推荐理由（PRD §8.4）
 * 只使用活动类型、时间、预算、出行方式和兴趣标签，不使用 MBTI 等不可验证标签。
 */
export function explainRecommendation(user: User, activity: Activity): Recommendation {
  const reasons: string[] = [];
  let score = 0;

  const interestHit = activity.tags.filter((tag) => user.interests.includes(tag));
  const categoryHit =
    user.interests.includes(CATEGORY_META[activity.category].label) ||
    user.interests.includes(CATEGORY_META[activity.category].short);
  if (categoryHit || interestHit.length > 0) {
    score += 40;
    reasons.push(
      categoryHit
        ? `符合你选择的「${CATEGORY_META[activity.category].label}」兴趣`
        : `与你关注的标签「${interestHit[0]}」相关`,
    );
  }

  const start = toDate(activity.startAt);
  if (isWeekend(start)) {
    score += 20;
    reasons.push(`${start.getDay() === 6 ? '周六' : '周日'}${timeOfDayBucket(activity.startAt) === 'evening' ? '晚上' : '白天'}时段适合周末出门`);
  }

  const budgetMid = (activity.budgetMin + activity.budgetMax) / 2;
  if (activity.feeMode === 'free') {
    score += 15;
    reasons.push('免费活动，预算压力小');
  } else if (user.budgetPreference === 'low' && budgetMid <= 60) {
    score += 15;
    reasons.push('人均预算在你的低预算区间内');
  } else if (user.budgetPreference === 'mid' && budgetMid <= 150) {
    score += 10;
    reasons.push('人均预算适中');
  }

  if (activity.transport === user.transportPreference) {
    score += 10;
    reasons.push(`出行方式与你偏好一致：${TRANSPORT_META[activity.transport]}`);
  }

  if (reasons.length === 0) {
    reasons.push('基于城市热门与剩余名额推荐');
  }

  return { reasons, score };
}
