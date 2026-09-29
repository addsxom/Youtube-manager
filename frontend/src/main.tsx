import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { initializeAppStyle } from './appStyle'
import './index.css'
import './themeTokens.css'
import './themeExtras.css'
import './visualFixes.css'

initializeAppStyle()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
