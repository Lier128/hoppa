import type { User } from '@/types';
import { avatarInitial } from '@/lib/format';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export function Avatar({
  user,
  size = 'md',
  title,
  className,
}: {
  user: Pick<User, 'nickname' | 'avatarColor'> | undefined;
  size?: AvatarSize;
  title?: string;
  className?: string;
}) {
  const color = user?.avatarColor ?? '#f5429b';
  return (
    <span
      className={`avatar avatar--${size}${className ? ` ${className}` : ''}`}
      style={{
        background: `linear-gradient(140deg, ${color} 0%, color-mix(in srgb, ${color} 55%, #2a1d33) 115%)`,
      }}
      title={title ?? user?.nickname}
      aria-hidden="true"
    >
      {avatarInitial(user?.nickname ?? '?')}
    </span>
  );
}

export function AvatarStack({
  users,
  size = 'sm',
  max = 4,
}: {
  users: Array<Pick<User, 'id' | 'nickname' | 'avatarColor'>>;
  size?: AvatarSize;
  max?: number;
}) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <span className="avatar-stack" aria-label={`${users.length} 位成员`}>
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
      {rest > 0 && (
        <span className={`avatar avatar--${size}`} style={{ background: '#f1eef3', color: '#5e4b66' }}>
          +{rest}
        </span>
      )}
    </span>
  );
}
