import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary';
  children: React.ReactNode;
}

export default function Button({
  variant = 'default',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseClass = 'chip-button';
  const variantClass = variant === 'primary' ? 'chip-button-primary' : '';

  return (
    <button
      className={`${baseClass} ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
