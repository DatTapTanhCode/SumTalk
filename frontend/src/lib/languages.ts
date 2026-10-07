// Whisper understands ~100 languages; these are offered in the pickers. Detection covers all of them.
export const LANGUAGE_CHOICES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'th', name: 'Thai' },
  { code: 'id', name: 'Indonesian' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'it', name: 'Italian' },
  { code: 'ru', name: 'Russian' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ar', name: 'Arabic' },
]

let displayNames: Intl.DisplayNames | null = null
try {
  displayNames = new Intl.DisplayNames(['en'], { type: 'language' })
} catch {
  displayNames = null
}

export function languageName(code: string | null | undefined): string {
  if (!code) return 'Unknown'
  return LANGUAGE_CHOICES.find((l) => l.code === code)?.name ?? displayNames?.of(code) ?? code.toUpperCase()
}
