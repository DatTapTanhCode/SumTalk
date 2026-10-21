import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[3px] border border-transparent px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.08em] uppercase whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/85",
        secondary:
          "border-border bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
        destructive:
          "border-live/40 bg-live-soft text-live focus-visible:ring-live/20 [a&]:hover:bg-live/10",
        outline:
          "border-border text-foreground [a&]:hover:bg-secondary [a&]:hover:text-foreground",
        ghost: "[a&]:hover:bg-secondary [a&]:hover:text-foreground",
        link: "text-foreground underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
