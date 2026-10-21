import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function ProgressBar({ value, indeterminate = false }: { value?: number; indeterminate?: boolean }) {
  return (
    <div className="relative h-1 w-full overflow-hidden bg-secondary">
      {indeterminate ? (
        <div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] bg-foreground" />
      ) : (
        <div className="h-full bg-foreground transition-[width] duration-300" style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
      )}
    </div>
  )
}

const noticeTones = {
  info: 'border-l-foreground',
  warning: 'border-l-foreground/40',
  error: 'border-l-live',
  success: 'border-l-foreground',
}

export function Notice({
  tone = 'info',
  icon,
  title,
  children,
  action,
}: {
  tone?: 'info' | 'warning' | 'error' | 'success'
  icon?: ReactNode
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className={cn('flex items-start gap-3 rounded-md border border-border border-l-2 bg-card px-3.5 py-3 text-base', noticeTones[tone])}>
      {icon && <div className={cn('mt-0.5 shrink-0', tone === 'error' ? 'text-live' : 'text-muted-foreground')}>{icon}</div>}
      <div className="min-w-0 flex-1">
        {title && <div className="font-medium text-foreground">{title}</div>}
        {children && <div className={cn(title ? 'mt-0.5' : null, 'text-muted-foreground')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** Input styling for the pages that still use a raw <input> or <select>. */
export const inputClass =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground transition-[color,box-shadow,border-color] focus:border-ring focus:ring-2 focus:ring-ring/20 focus:outline-none disabled:bg-secondary disabled:text-muted-foreground'
