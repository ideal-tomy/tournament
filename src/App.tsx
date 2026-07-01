import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminPage from './routes/AdminPage';
import DemoPage from './routes/DemoPage';
import DisplayPage from './routes/DisplayPage';
import HomePage from './routes/HomePage';
import RehearsalPage from './routes/RehearsalPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/display" element={<DisplayPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/rehearsal" element={<RehearsalPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
