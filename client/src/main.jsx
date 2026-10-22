import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';

const CustomerApp = lazy(() => import('./pages/CustomerApp'));
const OwnerApp = lazy(() => import('./pages/OwnerApp'));
const Login = lazy(() => import('./pages/Login'));
const KdsApp = lazy(() => import('./pages/KdsApp'));
const Onboard = lazy(() => import('./pages/Onboard'));
const CfdApp = lazy(() => import('./pages/CfdApp'));
const CaptainApp = lazy(() => import('./pages/CaptainApp'));

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Suspense fallback={<div role="status">Loading workspace...</div>}>
      <Routes>
        <Route path="/" element={<Navigate to="/c/demo-cafe" replace />} />
        <Route path="/c/:slug" element={<CustomerApp />} />
        <Route path="/login" element={<Navigate to="/owner/login" replace />} />
        <Route path="/owner/login" element={<Login />} />
        <Route path="/owner" element={<OwnerApp />} />
        <Route path="/owner/app" element={<OwnerApp />} />
        <Route path="/owner/*" element={<OwnerApp />} />
        <Route path="/kds" element={<KdsApp />} />
        <Route path="/kds/:slug" element={<KdsApp />} />
        <Route path="/cfd" element={<CfdApp />} />
        <Route path="/cfd/:slug" element={<CfdApp />} />
        <Route path="/captain" element={<CaptainApp />} />
        <Route path="/captain/:slug" element={<CaptainApp />} />
        <Route path="/onboard" element={<Onboard />} />
        <Route path="/register" element={<Navigate to="/onboard" replace />} />
        <Route path="*" element={<Navigate to="/owner" replace />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);
