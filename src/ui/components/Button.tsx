import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'ghost'

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-card px-4 py-3 text-sm font-black uppercase tracking-wide transition-transform duration-300 active:translate-y-[2px] disabled:pointer-events-none disabled:opacity-50'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary shadow-[0_4px_0_var(--primary-edge)] active:shadow-[0_2px_0_var(--primary-edge)]',
  ghost:
    'bg-surface text-muted shadow-[inset_0_0_0_2px_var(--line),0_4px_0_var(--line)] active:shadow-[inset_0_0_0_2px_var(--line),0_2px_0_var(--line)]',
}

/** Klassen eines 3D-Buttons, auch für Links verwendbar. */
export function buttonClass(variant: ButtonVariant = 'primary', extra = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim()
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; icon?: ReactNode }

export function Button({ variant = 'primary', icon, className = '', children, ...rest }: Props) {
  return (
    <button type="button" className={buttonClass(variant, className)} {...rest}>
      {icon}
      {children}
    </button>
  )
}
