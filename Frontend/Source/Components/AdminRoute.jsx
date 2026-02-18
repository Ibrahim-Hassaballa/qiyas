import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import { useLocale } from '../Context/LocaleContext';

const AdminRoute = ({ children }) => {
    const { user, loading } = useAuth();
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
        return <Navigate to="/login" replace />;
    }

    if (user.role !== 'admin' && user.role !== 'owner') {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default AdminRoute;
