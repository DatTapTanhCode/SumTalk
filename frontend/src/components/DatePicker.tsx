import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

function longDate(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function DatePicker({
  id,
  value,
  onChange,
  className,
}: {
  id?: string
  value: Date
  onChange: (value: Date) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)

  const setDay = (day: Date | undefined) => {
    if (!day) return
    const next = new Date(value)
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate())
    onChange(next)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md border border-input bg-card px-3 py-2 text-left text-base text-foreground transition-[color,box-shadow,border-color] hover:bg-secondary/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:outline-none',
            className,
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{longDate(value)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar mode="single" selected={value} onSelect={setDay} autoFocus />
      </PopoverContent>
    </Popover>
  )
}
