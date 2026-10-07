/**
 * The site's look is chosen by its owner in the admin portal and applies to every reader. It
 * arrives from the API a moment after the page starts, so the last known choice is remembered in
 * this browser and applied before anything is drawn: a returning reader never sees the page change
 * colour, and a first-time reader sees the default until the answer comes.
 */
export const THEMES = ['blue', 'seagreen'] as const
export type Theme = (typeof THEMES)[number]

export const DEFAULT_THEME: Theme = 'blue'
const KEY = 'inkwell.theme'

/** Only a theme this build has styles for is ever applied; anything else is the default. */
export function toTheme(value: unknown): Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value) ? (value as Theme) : DEFAULT_THEME
}

type Store = Pick<Storage, 'getItem' | 'setItem'>
type Root = { dataset: Record<string, string | undefined> }

function safeStorage(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function rememberedTheme(storage: Store | null = safeStorage()): Theme {
  try {
    return toTheme(storage?.getItem(KEY))
  } catch {
    return DEFAULT_THEME
  }
}

/** Puts the theme on the page and remembers it. The default is expressed as no attribute at all. */
export function applyTheme(value: unknown, root: Root = document.documentElement, storage: Store | null = safeStorage()): Theme {
  const theme = toTheme(value)

  if (theme === DEFAULT_THEME) delete root.dataset.theme
  else root.dataset.theme = theme

  try {
    storage?.setItem(KEY, theme)
  } catch {
    // Not remembered: the next visit starts from the default until the API answers.
  }
  return theme
}
