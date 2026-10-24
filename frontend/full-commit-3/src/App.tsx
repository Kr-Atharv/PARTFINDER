import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import ComparePartsPage from '@/pages/ComparePartsPage'
import FindPartsPage from '@/pages/FindPartsPage'
import NotFoundPage from '@/pages/NotFoundPage'
import OverviewPage from '@/pages/OverviewPage'
import SearchHistoryPage from '@/pages/SearchHistoryPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="find" element={<FindPartsPage />} />
        <Route path="compare" element={<ComparePartsPage />} />
        <Route path="history" element={<SearchHistoryPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
