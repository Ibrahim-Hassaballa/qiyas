import React, { useState, useEffect } from 'react';
import { useAuth } from '../Context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Key, Mail, User, Building2, Loader2, Sun, Moon } from 'lucide-react';
import { useLocale } from '../Context/LocaleContext';
import { useTheme } from '../Context/ThemeContext';
import LanguageSwitcher from '../Components/LanguageSwitcher';
import api from '../Services/api';

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [tenants, setTenants] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const { t, dir } = useLocale();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    api.get('/auth/tenants')
      .then(res => {
        setTenants(res.data);
        if (res.data.length > 0) setTenantId(res.data[0].id);
      })
      .catch(() => setTenants([]))
      .finally(() => setTenantsLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await register(email, username, password, tenantId);
      if (result.success) {
        setSuccessMessage(t('auth.accountPendingActivation'));
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setError(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputPadding = () => (dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4');
  const getIconPosition = () => (dir === 'rtl' ? 'right-3' : 'left-3');

  return (
    <div className="min-h-screen auth-bg flex items-center justify-center p-4">
      <div className="app-surface-elevated p-8 sm:p-10 rounded-2xl w-full max-w-md">
        <div className="flex justify-end items-center gap-2 mb-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg btn-ghost transition-colors focus-ring"
            aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <LanguageSwitcher compact />
        </div>

        <div className="flex flex-col items-center mb-8">
          <div className="w-[4.5rem] h-[4.5rem] rounded-2xl brand-glow flex items-center justify-center mb-5">
            <span className="text-white font-bold text-3xl">Q</span>
          </div>
          <h1 className="text-2xl font-bold app-title">{t('auth.createAccountTitle')}</h1>
          <p className="app-muted text-sm">{t('auth.createAccountSubtitle')}</p>
        </div>

        {error && (
          <div className="status-danger p-3 rounded-lg mb-6 text-sm" role="alert" aria-live="polite">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="status-success p-3 rounded-lg mb-6 text-sm" role="status" aria-live="polite">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" aria-label="Registration form">
          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="text-sm font-medium app-text">
              {t('auth.email')}
            </label>
            <div className="relative">
              <Mail className={`absolute top-1/2 -translate-y-1/2 app-muted ${getIconPosition()}`} size={18} />
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-lg py-3 ${getInputPadding()} text-sm input-surface`}
                placeholder={t('auth.enterEmail')}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-name" className="text-sm font-medium app-text">
              {t('auth.displayName')}
            </label>
            <div className="relative">
              <User className={`absolute top-1/2 -translate-y-1/2 app-muted ${getIconPosition()}`} size={18} />
              <input
                id="reg-name"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full rounded-lg py-3 ${getInputPadding()} text-sm input-surface`}
                placeholder={t('auth.chooseDisplayName')}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-org" className="text-sm font-medium app-text">
              {t('auth.organizationName')}
            </label>
            <div className="relative">
              <Building2 className={`absolute top-1/2 -translate-y-1/2 app-muted ${getIconPosition()}`} size={18} />
              <select
                id="reg-org"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className={`w-full rounded-lg py-3 ${getInputPadding()} text-sm input-surface appearance-none`}
                required
              >
                <option value="" disabled>{t('auth.selectOrganization')}</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {dir === 'rtl' && tenant.name_ar ? tenant.name_ar : tenant.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-password" className="text-sm font-medium app-text">
              {t('auth.password')}
            </label>
            <div className="relative">
              <Key className={`absolute top-1/2 -translate-y-1/2 app-muted ${getIconPosition()}`} size={18} />
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full rounded-lg py-3 ${getInputPadding()} text-sm input-surface`}
                placeholder={t('auth.choosePassword')}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-confirm" className="text-sm font-medium app-text">
              {t('auth.confirmPassword')}
            </label>
            <div className="relative">
              <Key className={`absolute top-1/2 -translate-y-1/2 app-muted ${getIconPosition()}`} size={18} />
              <input
                id="reg-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full rounded-lg py-3 ${getInputPadding()} text-sm input-surface`}
                placeholder={t('auth.confirmYourPassword')}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !!successMessage || !tenantId || tenantsLoading}
            className="w-full btn-primary py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-ring"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t('auth.creatingAccount')}
              </>
            ) : (
              t('auth.createAccount')
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm app-muted">
          {t('auth.alreadyHaveAccount')}{' '}
          <button onClick={() => navigate('/login')} className="text-[var(--accent-500)] font-medium transition-colors focus-ring rounded">
            {t('auth.signInLink')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
