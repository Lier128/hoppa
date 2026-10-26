import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '@/lib/format';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'danger-soft';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
  className?: string;
}

type ButtonProps = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> & {
    to?: undefined;
  };

type LinkProps = BaseProps & {
  to: string;
  onClick?: () => void;
  title?: string;
  'aria-label'?: string;
  'aria-disabled'?: boolean;
};

function classes({ variant = 'primary', size = 'md', block }: BaseProps) {
  return cx('btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block');
}

export function Button(props: ButtonProps | LinkProps) {
  const { variant = 'primary', size = 'md', block, iconLeft, iconRight, children, className } = props;
  const cls = cx(classes({ variant, size, block }), className);
  const content = (
    <>
      {iconLeft}
      {children}
      {iconRight}
    </>
  );

  if ('to' in props && props.to) {
    const { onClick, title, 'aria-label': ariaLabel, 'aria-disabled': ariaDisabled } = props;
    return (
      <Link
        to={props.to}
        className={cls}
        onClick={onClick}
        title={title}
        aria-label={ariaLabel}
        aria-disabled={ariaDisabled}
      >
        {content}
      </Link>
    );
  }

  const { to: _to, ...rest } = props as ButtonProps & { to?: undefined };
  return (
    <button type="button" className={cls} {...rest}>
      {content}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, children, className, ...rest }: IconButtonProps) {
  return (
    <button type="button" className={cx('icon-btn', className)} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}
