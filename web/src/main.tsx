import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, rememberedTheme } from './lib/theme'

// Before the first paint, wear the theme this browser saw last time; the API confirms it a moment later.
applyTheme(rememberedTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
