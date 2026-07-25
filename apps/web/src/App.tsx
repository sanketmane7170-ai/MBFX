import { type ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import NotFoundPage from './pages/NotFoundPage';
import DashboardLayout from './components/layout/DashboardLayout';
import OverviewPage from './pages/dashboard/OverviewPage';
import AccountsPage from './pages/dashboard/AccountsPage';
import AccountDetailPage from './pages/dashboard/AccountDetailPage';
import CopiersPage from './pages/dashboard/CopiersPage';
import CopierDetailPage from './pages/dashboard/CopierDetailPage';
import MonitorPage from './pages/dashboard/MonitorPage';
import HistoryPage from './pages/dashboard/HistoryPage';
import ReportsPage from './pages/dashboard/ReportsPage';
import AdminsPage from './pages/dashboard/AdminsPage';
import AuditPage from './pages/dashboard/AuditPage';
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
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
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
          <Route path="accounts/:id" element={<AccountDetailPage />} />
          <Route path="copiers" element={<CopiersPage />} />
          <Route path="copiers/:id" element={<CopierDetailPage />} />
          <Route path="monitor" element={<MonitorPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route
            path="admins"
            element={
              <RequireSuperAdmin>
                <AdminsPage />
              </RequireSuperAdmin>
            }
          />
          <Route
            path="audit"
            element={
              <RequireSuperAdmin>
                <AuditPage />
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
          {/* Unknown dashboard path → 404 inside the shell, not a bounce to marketing. */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
