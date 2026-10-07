import { LANGUAGE_CHOICES } from '../lib/languages'
import { cn } from '../lib/format'
import { inputClass } from './ui'

/** Spoken language. "auto" lets Whisper detect it (per segment, so mixed-language meetings work). */
export function LanguageSelect({
  value,
  onChange,
  disabled,
  className,
  id,
}: {
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  className?: string
  id?: string
}) {
  return (
    <select
      id={id}
      value={value ?? 'auto'}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value === 'auto' ? null : event.target.value)}
      className={cn(inputClass, 'pr-9', className)}
    >
      <option value="auto">Auto-detect language</option>
      {LANGUAGE_CHOICES.map((language) => (
        <option key={language.code} value={language.code}>
          {language.name}
        </option>
      ))}
    </select>
  )
}
