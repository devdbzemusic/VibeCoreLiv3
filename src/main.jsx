import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { bindCanonicalSourceGuard } from '@/lib/instruments/sourceRuntimeGuard'

// Canonicalize persisted/default Sample/Synth ownership before any component
// reads Part.source. The guard also wraps legacy source writes for the session.
bindCanonicalSourceGuard()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
