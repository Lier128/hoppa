import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from './icons';

export function PageHead({
  title,
  sub,
  actions,
  backTo,
  hero,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  backTo?: string;
  hero?: boolean;
}) {
  return (
    <header className="page__head">
      <div style={{ minWidth: 0 }}>
        {backTo && (
          <Link
            to={backTo}
            className="row"
            style={{ gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            返回
          </Link>
        )}
        <h1 className={hero ? 'page__title page__title--hero' : 'page__title'}>{title}</h1>
        {sub && <p className="page__sub">{sub}</p>}
      </div>
      {actions && <div className="page__actions">{actions}</div>}
    </header>
  );
}
