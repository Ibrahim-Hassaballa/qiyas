import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useLocale } from '../Context/LocaleContext';

const ToastContext = createContext(null);

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info
};

const colors = {
  success: 'status-success',
  error: 'status-danger',
  warning: 'status-warning',
  info: 'status-info'
};

const progressColors = {
  success: 'bg-[var(--success-500)]',
  error: 'bg-[var(--danger-500)]',
  warning: 'bg-[var(--warning-500)]',
  info: 'bg-[var(--accent-500)]'
};

let toastId = 0;

const ToastItem = ({ toast, onRemove }) => {
  const [exiting, setExiting] = useState(false);
  const Icon = icons[toast.type] || Info;
  const { t } = useLocale();

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(toast.id), 240);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => onRemove(toast.id), 240);
  };

  return (
    <div
      className={`relative flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm max-w-sm w-full overflow-hidden ${
        colors[toast.type] || colors.info
      } ${exiting ? 'animate-toast-out' : 'animate-toast-in'}`}
      role="alert"
    >
      <Icon size={18} className="shrink-0 mt-0.5" />
      <p className="text-sm font-medium flex-1" style={{ paddingInlineEnd: '1rem' }}>
        {toast.message}
      </p>
      <button
        onClick={handleClose}
        className="absolute top-2 p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity focus-ring"
        style={{ insetInlineEnd: '0.5rem' }}
        aria-label={t('common.close')}
      >
        <X size={14} />
      </button>
      <div className="absolute bottom-0 left-0 right-0 h-0.5">
        <div
          className={`h-full ${progressColors[toast.type] || progressColors.info} rounded-full`}
          style={{ animation: 'progress 4s linear forwards' }}
        />
      </div>
      <style>{`
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const { dir } = useLocale();

  const showToast = useCallback((message, type = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div
          className={`fixed top-4 z-[100] flex flex-col gap-2 pointer-events-none ${
            dir === 'rtl' ? 'left-4' : 'right-4'
          }`}
        >
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onRemove={removeToast} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
