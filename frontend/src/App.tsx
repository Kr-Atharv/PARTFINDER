import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { AuthProvider } from '@/context/AuthContext'
import { CompareProvider } from '@/context/CompareContext'
import { PartDrawerProvider } from '@/context/PartDrawerContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { ToastProvider } from '@/context/ToastContext'
import ComparePartsPage from '@/pages/ComparePartsPage'
import FindPartsPage from '@/pages/FindPartsPage'
import LoginPage from '@/pages/LoginPage'
import NotFoundPage from '@/pages/NotFoundPage'
import OverviewPage from '@/pages/OverviewPage'
import PartDetailPage from '@/pages/PartDetailPage'
import SavedPartsPage from '@/pages/SavedPartsPage'
import SearchHistoryPage from '@/pages/SearchHistoryPage'

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <CompareProvider>
            <PartDrawerProvider>
              <ErrorBoundary>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route index element={<OverviewPage />} />
                  <Route path="find" element={<FindPartsPage />} />
                  <Route path="find/:partId" element={<PartDetailPage />} />
                  <Route path="compare" element={<ComparePartsPage />} />
                  <Route path="saved" element={<SavedPartsPage />} />
                  <Route path="history" element={<SearchHistoryPage />} />
                  <Route path="login" element={<LoginPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
              </ErrorBoundary>
            </PartDrawerProvider>
          </CompareProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
