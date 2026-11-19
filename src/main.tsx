import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initSeedData } from './lib/seed'
import { importPunctTasks } from './lib/punctImport'

initSeedData()
importPunctTasks()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
