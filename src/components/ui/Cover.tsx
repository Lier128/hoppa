import type { ReactNode } from 'react';
import type { Activity, Category } from '@/types';
import { CATEGORY_META } from '@/types';
import { cx } from '@/lib/format';
import { Dices, Dumbbell, Footprints, Palette, Ticket, Utensils, type LucideIcon } from './icons';

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  citywalk: Footprints,
  food: Utensils,
  exhibition: Palette,
  boardgame: Dices,
  sports: Dumbbell,
  show: Ticket,
};

/**
 * 生成式活动封面。
 *
 * 设计说明（作品集里会写进决策文档）：原型截图里的活动图是真实照片，
 * 但演示数据没有可授权的图片素材，所以这里用「品类渐变 + 品牌光斑 + 拼图纹样 + 品类图标」
 * 生成统一的视觉语言，既保留品牌识别度，也不会误用他人图片。
 */
export function Cover({
  activity,
  height = 160,
  subtitle,
  iconSize,
  className,
  children,
}: {
  activity: Pick<Activity, 'category' | 'coverTone' | 'title'>;
  height?: number | string;
  subtitle?: ReactNode;
  iconSize?: number;
  className?: string;
  children?: ReactNode;
}) {
  const meta = CATEGORY_META[activity.category];
  const Icon = CATEGORY_ICON[activity.category];
  return (
    <div
      className={cx('cover', className)}
      style={{ background: meta.gradient, height }}
      role="img"
      aria-label={`${meta.label}活动封面：${activity.title}`}
    >
      <span className="cover__top">
        <span className="tag tag--glass">{meta.label}</span>
        <span className="cover__tone">HOPPA / {String(activity.coverTone).padStart(2, '0')}</span>
      </span>
      <Icon className="cover__icon" size={iconSize ?? 118} strokeWidth={1.15} aria-hidden="true" />
      {children ?? (
        <div className="cover__body">
          <div style={{ fontSize: 11, letterSpacing: '0.16em', opacity: 0.82, fontWeight: 700 }}>
            {meta.short}
          </div>
          {subtitle !== undefined && (
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.92, marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function CategoryIcon({ category, size = 18 }: { category: Category; size?: number }) {
  const Icon = CATEGORY_ICON[category];
  return <Icon size={size} aria-hidden="true" />;
}
