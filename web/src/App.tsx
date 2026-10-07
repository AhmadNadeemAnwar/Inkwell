import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { EmptyState } from './components/ui'
import { useTitle } from './hooks/useTitle'
import { SiteProvider } from './lib/siteContext'
import { HomePage } from './pages/HomePage'
import { PostPage } from './pages/PostPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { ProfilePage } from './pages/ProfilePage'
import { SearchPage } from './pages/SearchPage'
import { TagPage } from './pages/TagPage'

function NotFound() {
  useTitle('Page not found')
  return <main className="main"><EmptyState title="Page not found" /></main>
}

// Readers have no accounts: there is nothing here to sign in to. Writing happens in the admin portal.
export default function App() {
  return (
    <BrowserRouter>
      <SiteProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/tag/:slug" element={<TagPage />} />
          <Route path="/read/:slug" element={<PostPage />} />
          {/* Where posts lived before /read/. Kept so links already shared keep opening. */}
          <Route path="/p/:slug" element={<PostPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          {/* React Router cannot match a partial segment like "/@:handle", so profiles take the
              whole segment and ProfilePage requires the leading "@". Static routes above outrank
              this one, so /search, /privacy etc. are unaffected. */}
          <Route path="/:handle" element={<ProfilePage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </SiteProvider>
    </BrowserRouter>
  )
}
