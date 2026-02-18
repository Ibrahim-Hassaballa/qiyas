import React, { useState } from 'react';
import { useAuth } from '../Context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Key, Mail, Loader2, Sun, Moon } from 'lucide-react';
import { useLocale } from '../Context/LocaleContext';
import { useTheme } from '../Context/ThemeContext';
import LanguageSwitcher from '../Components/LanguageSwitcher';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pendingActivation, setPendingActivation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, dir } = useLocale();
  const { theme, toggleTheme } = useTheme();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPendingActivation(false);
    setIsSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        const from = location.state?.from?.pathname || '/';
        navigate(from);
      } else {
        setError(result.error);
        setPendingActivation(!!result.pendingActivation);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <h1 className="text-2xl font-bold app-title">{t('auth.welcomeBack')}</h1>
          <p className="app-muted text-sm">{t('auth.signInSubtitle')}</p>
        </div>

        {error && (
          <div className={`${pendingActivation ? 'status-warning' : 'status-danger'} p-3 rounded-lg mb-6 text-sm`} role="alert" aria-live="polite">
            {pendingActivation ? t('auth.accountPendingLogin') : error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" aria-label="Login form">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium app-text">
              {t('auth.email')}
            </label>
            <div className="relative">
              <Mail className={`absolute top-1/2 -translate-y-1/2 app-muted ${dir === 'rtl' ? 'right-3' : 'left-3'}`} size={18} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-lg py-3 ${
                  dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'
                } text-sm input-surface`}
                placeholder={t('auth.enterEmail')}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium app-text">
              {t('auth.password')}
            </label>
            <div className="relative">
              <Key className={`absolute top-1/2 -translate-y-1/2 app-muted ${dir === 'rtl' ? 'right-3' : 'left-3'}`} size={18} />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full rounded-lg py-3 ${
                  dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'
                } text-sm input-surface`}
                placeholder={t('auth.enterPassword')}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full btn-primary py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-ring"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t('auth.signingIn')}
              </>
            ) : (
              t('auth.signIn')
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm app-muted">
          {t('auth.dontHaveAccount')}{' '}
          <button onClick={() => navigate('/register')} className="text-[var(--accent-500)] font-medium transition-colors focus-ring rounded">
            {t('auth.createAccountLink')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
