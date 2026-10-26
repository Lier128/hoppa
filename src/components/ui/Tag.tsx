import type { ReactNode } from 'react';
import type { ActivityStatus, Category } from '@/types';
import { ACTIVITY_STATUS_META, CATEGORY_META } from '@/types';
import { cx } from '@/lib/format';

export type TagTone = 'pink' | 'violet' | 'amber' | 'green' | 'slate';

export function Tag({
  tone = 'slate',
  outline,
  glass,
  icon,
  children,
  className,
}: {
  tone?: TagTone;
  outline?: boolean;
  glass?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'tag',
        `tag--${tone}`,
        outline && 'tag--outline',
        glass && 'tag--glass',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function StatusTag({ status, className }: { status: ActivityStatus; className?: string }) {
  const meta = ACTIVITY_STATUS_META[status];
  return (
    <Tag tone={meta.tone} className={className}>
      {meta.label}
    </Tag>
  );
}

export function CategoryTag({ category, glass }: { category: Category; glass?: boolean }) {
  const meta = CATEGORY_META[category];
  return (
    <Tag tone="pink" glass={glass}>
      {meta.label}
    </Tag>
  );
}
