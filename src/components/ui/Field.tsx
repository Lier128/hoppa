import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import { cx } from '@/lib/format';
import { CircleAlert } from './icons';

export interface FieldProps {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, required, hint, error, htmlFor, className, children }: FieldProps) {
  return (
    <div className={cx('field', className)}>
      {label && (
        <label className="field__label" htmlFor={htmlFor}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="field__error" role="alert">
          <CircleAlert size={13} aria-hidden="true" />
          {error}
        </span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </div>
  );
}

export function TextInput({
  className,
  invalid,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cx('input', className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function TextArea({
  className,
  invalid,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={cx('textarea', className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function Select({
  className,
  invalid,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return <select className={cx('select', className)} aria-invalid={invalid || undefined} {...rest} />;
}

/** 简单的受控输入 + label + 错误，减少表单页重复代码 */
export function InputField({
  label,
  required,
  hint,
  error,
  value,
  onChange,
  placeholder,
  type = 'text',
  maxLength,
  id,
  disabled,
  autoFocus,
}: {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'date' | 'time' | 'number';
  maxLength?: number;
  id?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field label={label} required={required} hint={hint} error={error} htmlFor={inputId}>
      <TextInput
        id={inputId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        invalid={Boolean(error)}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    </Field>
  );
}
