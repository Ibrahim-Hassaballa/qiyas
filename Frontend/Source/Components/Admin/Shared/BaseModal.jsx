import { useEffect, useRef, useCallback, useId } from 'react';
import { X } from 'lucide-react';
import { useLocale } from '../../../Context/LocaleContext';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const BaseModal = ({ isOpen, onClose, title, maxWidth = 'max-w-md', children, footer, role: dialogRole = 'dialog', className }) => {
  const { t } = useLocale();
  const overlayRef = useRef(null);
  const contentRef = useRef(null);
  const triggerRef = useRef(null);
  const titleId = useId();

  // Capture trigger element on open
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
    }
  }, [isOpen]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [isOpen]);

  // Focus first element on open
  useEffect(() => {
    if (!isOpen || !contentRef.current) return;
    const timer = setTimeout(() => {
      const first = contentRef.current?.querySelector(FOCUSABLE);
      first?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Escape key + focus trap
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !contentRef.current) return;
    const focusable = [...contentRef.current.querySelectorAll(FOCUSABLE)];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, [onClose]);

  // Return focus on close
  useEffect(() => {
    if (isOpen) return;
    return () => {
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        triggerRef.current.focus();
        triggerRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 ${className || 'z-50'} flex items-center justify-center p-4 modal-backdrop`}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      onKeyDown={handleKeyDown}
      role={dialogRole}
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={contentRef}
        className={`app-surface-elevated rounded-xl w-full ${maxWidth} animate-message-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b app-border">
          <h3 id={titleId} className="text-base font-semibold app-title">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg btn-ghost transition-colors focus-ring"
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 pb-6">{footer}</div>
        )}
      </div>
    </div>
  );
};

export default BaseModal;
