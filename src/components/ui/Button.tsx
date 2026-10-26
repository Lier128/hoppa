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
    const { to, onClick, title } = props;
    return (
      <Link
        to={to}
        className={cls}
        onClick={onClick}
        title={title}
        aria-label={props['aria-label']}
        aria-disabled={props['aria-disabled']}
      >
        {content}
      </Link>
    );
  }

  // 注意：iconLeft / iconRight 是组件私有属性，必须从 DOM 属性里剔除，
  // 否则 React 会在 dev 模式报 "does not recognize the prop on a DOM element"
  const {
    variant: _variant,
    size: _size,
    block: _block,
    iconLeft: _iconLeft,
    iconRight: _iconRight,
    children: _children,
    className: _className,
    to: _to,
    ...domProps
  } = props as ButtonProps;
  return (
    <button type="button" className={cls} {...domProps}>
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
