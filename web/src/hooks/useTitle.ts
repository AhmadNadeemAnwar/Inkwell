import { useEffect } from 'react'
import { pageTitle } from '../lib/site'

/**
 * Names the browser tab after the page. Pass null while the name is not known yet (a post still
 * loading), and the tab keeps the site's name instead of flashing something wrong.
 */
export function useTitle(page: string | null | undefined) {
  useEffect(() => {
    document.title = pageTitle(page)
  }, [page])
}
