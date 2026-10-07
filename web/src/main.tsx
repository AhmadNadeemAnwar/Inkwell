import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyRememberedLook } from './lib/theme'

// Before the first paint, wear what this browser wore last time; the API confirms the site's look a moment later.
applyRememberedLook()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
