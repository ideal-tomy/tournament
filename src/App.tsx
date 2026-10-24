import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
const AdminPage = lazy(() => import('./routes/AdminPage'));
const DemoPage = lazy(() => import('./routes/DemoPage'));
const DisplayPage = lazy(() => import('./routes/DisplayPage'));
const HomePage = lazy(() => import('./routes/HomePage'));
const RehearsalPage = lazy(() => import('./routes/RehearsalPage'));
const PresentationPage = lazy(() => import('./routes/PresentationPage'));

const ShowPreviewPage = lazy(() => import('./routes/ShowPreviewPage'));
const LocalRehearsalPage = lazy(() => import('./routes/LocalRehearsalPage'));
const CloudflareCheckPage = lazy(() => import('./routes/CloudflareCheckPage'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<p className="p-8 text-white">読み込み中…</p>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/display" element={<DisplayPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/rehearsal" element={<RehearsalPage />} />
        <Route path="/show-preview" element={<ShowPreviewPage />} />
        <Route path="/local-rehearsal" element={<LocalRehearsalPage />} />
        <Route path="/cloudflare-check" element={<CloudflareCheckPage />} />
        <Route path="/presentation" element={<PresentationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
