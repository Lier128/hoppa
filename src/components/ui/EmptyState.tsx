import type { ReactNode } from 'react';
import { Inbox } from './icons';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__icon">{icon ?? <Inbox size={22} />}</span>
      <p className="empty__title">{title}</p>
      {description && <p className="empty__desc">{description}</p>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}
