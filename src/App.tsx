import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell'
import { LandingPage } from './pages/LandingPage'
import { ScanPage } from './pages/ScanPage'
import { PulsePage } from './pages/PulsePage'
import { ReportPage } from './pages/ReportPage'
import { FinancePage } from './pages/FinancePage'
import { SanctionPage } from './pages/SanctionPage'
import { AppProvider } from './state/AppContext'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/pulse" element={<PulsePage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/sanction" element={<SanctionPage />} />
          </Routes>
        </Shell>
      </BrowserRouter>
    </AppProvider>
  )
}
