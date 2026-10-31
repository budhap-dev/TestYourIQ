import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'quiet';
type Size = 'md' | 'lg';

interface StyleProps {
  variant?: Variant | undefined;
  size?: Size | undefined;
}

function classes({ variant = 'primary', size = 'md' }: StyleProps, extra?: string): string {
  return [styles.button, styles[variant], size === 'lg' && styles.lg, extra]
    .filter(Boolean)
    .join(' ');
}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...rest
}: StyleProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={classes({ variant, size }, className)} {...rest} />;
}

export function ButtonLink({ variant, size, className, ...rest }: StyleProps & LinkProps) {
  return <Link className={classes({ variant, size }, className)} {...rest} />;
}
