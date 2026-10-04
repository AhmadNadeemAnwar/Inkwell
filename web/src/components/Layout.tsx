import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from './ui'

export function Layout() {
  const { user, logout, allowPublicSignUp } = useAuth()
  const navigate = useNavigate()
  const [term, setTerm] = useState('')

  function onSearch(event: FormEvent) {
    event.preventDefault()
    const trimmed = term.trim()
    if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header__inner">
          <Link to="/" className="brand">Inkwell</Link>

          <form className="header__search" onSubmit={onSearch} role="search">
            <input
              type="search"
              placeholder="Search articles"
              aria-label="Search articles"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </form>

          <nav className="header__nav">
            {user ? (
              <>
                <Link className="btn btn--ghost" to="/me/bookmarks">Saved</Link>
                <Link className="btn btn--ghost" to="/me/drafts">Drafts</Link>
                <Link className="btn btn--primary" to="/write">Write</Link>
                <Link to={`/@${user.handle}`} title={user.displayName}>
                  <Avatar author={user} />
                </Link>
                <button className="btn btn--ghost" onClick={() => { logout(); navigate('/') }}>
                  Sign out
                </button>
              </>
            ) : allowPublicSignUp ? (
              <>
                <Link className="btn btn--ghost" to="/login">Sign in</Link>
                <Link className="btn btn--primary" to="/register">Get started</Link>
              </>
            ) : null}
          </nav>
        </div>
      </header>

      <Outlet />
    </div>
  )
}
