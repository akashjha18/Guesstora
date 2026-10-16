import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import CustomerApp from './pages/CustomerApp';
import OwnerApp from './pages/OwnerApp';
import Login from './pages/Login';
import KdsApp from './pages/KdsApp';
import Onboard from './pages/Onboard';
import CfdApp from './pages/CfdApp';
import CaptainApp from './pages/CaptainApp';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
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
  </BrowserRouter>
);
