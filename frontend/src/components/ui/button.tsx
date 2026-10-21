import * as React from 'react'
import { LoaderCircle } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Slot } from 'radix-ui'

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-[13px] font-medium tracking-tight whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary font-semibold text-primary-foreground hover:bg-primary/85',
        secondary: 'border border-border bg-card text-foreground hover:bg-secondary',
        outline: 'border border-border bg-transparent hover:bg-secondary',
        ghost: 'hover:bg-secondary hover:text-foreground',
        destructive: 'bg-live font-semibold text-destructive-foreground hover:bg-live/90',
        danger: 'bg-live font-semibold text-destructive-foreground hover:bg-live/90',
        link: 'text-foreground underline decoration-1 underline-offset-4 hover:decoration-2',
      },
      size: {
        default: 'h-10 px-4 has-[>svg]:px-3.5',
        md: 'h-10 px-4 has-[>svg]:px-3.5',
        sm: 'h-8 gap-1.5 px-3 has-[>svg]:px-2.5',
        xs: 'h-7 gap-1 px-2 text-xl has-[>svg]:px-1.5',
        lg: 'h-11 px-6 text-[14px] has-[>svg]:px-4',
        icon: 'size-10',
        'icon-sm': 'size-8',
        'icon-xs': "size-6 [&_svg:not([class*='size-'])]:size-3",
        'icon-lg': 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }) {
  if (asChild) {
    return (
      <Slot.Root data-slot="button" data-variant={variant} data-size={size} className={cn(buttonVariants({ variant, size, className }))} {...props}>
        {children}
      </Slot.Root>
    )
  }

  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
      {children}
    </button>
  )
}

export { Button, buttonVariants }
