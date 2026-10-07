import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../api/client'
import type { Category } from '../api/types'
import { applyTheme } from './theme'

interface SiteState {
  /** Categories that have at least one published post, in the owner's order. Empty until loaded. */
  categories: Category[]
}

const SiteContext = createContext<SiteState>({ categories: [] })

/**
 * Loads the two things that shape the whole site: its theme and its categories. Neither is needed
 * to read a post, so a failure here is silent: the site keeps its remembered theme and simply shows
 * no category tabs.
 */
export function SiteProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SiteState>({ categories: [] })

  useEffect(() => {
    let cancelled = false
    api.site()
      .then((site) => {
        if (cancelled) return
        applyTheme(site.theme)
        setState({ categories: site.categories.filter((category) => category.postCount > 0) })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return <SiteContext.Provider value={state}>{children}</SiteContext.Provider>
}

export function useSite() {
  return useContext(SiteContext)
}
