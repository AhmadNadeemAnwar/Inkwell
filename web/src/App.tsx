import { Suspense, lazy } from 'react'
import type { ReactElement } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { EmptyState, Spinner } from './components/ui'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import { HomePage } from './pages/HomePage'

// TipTap is the largest dependency in the app and only writers ever load it,
// so the editor route is split out of the main bundle.
const EditorPage = lazy(() => import('./pages/EditorPage').then((m) => ({ default: m.EditorPage })))
import { BookmarksPage, DraftsPage } from './pages/LibraryPages'
import { PostPage } from './pages/PostPage'
import { ProfilePage } from './pages/ProfilePage'
import { SearchPage } from './pages/SearchPage'
import { TagPage } from './pages/TagPage'

/** Waits for the session check before deciding, so a signed-in reload never bounces to /login. */
function RequireAuth({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth()

  if (loading) return <main className="main"><Spinner /></main>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function LazyEditor() {
  return (
    <Suspense fallback={<main className="main main--reading"><Spinner label="Loading editor…" /></main>}>
      <EditorPage />
    </Suspense>
  )
}

/** On a closed site the sign-up page does not exist, so it answers like any other unknown address. */
function RegisterRoute() {
  const { allowPublicSignUp, signUpPolicyKnown } = useAuth()

  if (!signUpPolicyKnown) return <main className="main"><Spinner /></main>
  if (!allowPublicSignUp) return <main className="main"><EmptyState title="Page not found" /></main>
  return <RegisterPage />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/tag/:slug" element={<TagPage />} />
            <Route path="/p/:slug" element={<PostPage />} />
            {/* React Router cannot match a partial segment like "/@:handle", so profiles take the
                whole segment and ProfilePage requires the leading "@". Static routes above and
                below outrank this one, so /login, /write etc. are unaffected. */}
            <Route path="/:handle" element={<ProfilePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterRoute />} />

            <Route path="/write" element={<RequireAuth><LazyEditor /></RequireAuth>} />
            <Route path="/write/:id" element={<RequireAuth><LazyEditor /></RequireAuth>} />
            <Route path="/me/drafts" element={<RequireAuth><DraftsPage /></RequireAuth>} />
            <Route path="/me/bookmarks" element={<RequireAuth><BookmarksPage /></RequireAuth>} />

            <Route path="*" element={<main className="main"><EmptyState title="Page not found" /></main>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
