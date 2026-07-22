import { type ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/layout/DashboardLayout';
import OverviewPage from './pages/dashboard/OverviewPage';
import AccountsPage from './pages/dashboard/AccountsPage';
import CopiersPage from './pages/dashboard/CopiersPage';
import CopierDetailPage from './pages/dashboard/CopierDetailPage';
import MonitorPage from './pages/dashboard/MonitorPage';
import AdminsPage from './pages/dashboard/AdminsPage';
import SettingsPage from './pages/dashboard/SettingsPage';
import { getUser, isAuthenticated } from './lib/api';

function RequireAuth({ children }: { children: ReactElement }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

function RequireSuperAdmin({ children }: { children: ReactElement }) {
  return getUser()?.role === 'SUPER_ADMIN' ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="copiers" element={<CopiersPage />} />
          <Route path="copiers/:id" element={<CopierDetailPage />} />
          <Route path="monitor" element={<MonitorPage />} />
          <Route
            path="admins"
            element={
              <RequireSuperAdmin>
                <AdminsPage />
              </RequireSuperAdmin>
            }
          />
          <Route
            path="settings"
            element={
              <RequireSuperAdmin>
                <SettingsPage />
              </RequireSuperAdmin>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
