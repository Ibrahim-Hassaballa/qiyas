import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './Context/AuthContext';
import { ThemeProvider } from './Context/ThemeContext';
import { LocaleProvider, useLocale } from './Context/LocaleContext';
import { ToastProvider } from './Components/Toast';
import ChatPage from './Pages/ChatPage';
import LoginPage from './Pages/LoginPage';
import RegisterPage from './Pages/RegisterPage';
import AdminPage from './Pages/AdminPage';
import AdminRoute from './Components/AdminRoute';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { t } = useLocale();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center app-shell">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-lg btn-primary flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-lg">Q</span>
          </div>
          <span className="text-sm app-muted">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
      <Route
        path="/c/:conversationId"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <LocaleProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Router>
              <AppContent />
            </Router>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}

export default App;
