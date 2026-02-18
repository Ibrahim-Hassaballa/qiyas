import { useState, useRef, useEffect, useCallback } from 'react';
import { MoreVertical } from 'lucide-react';
import { useLocale } from '../../../Context/LocaleContext';

const RowActionsMenu = ({ items, label: triggerLabel }) => {
  const { t, dir } = useLocale();
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const menuRef = useRef(null);
  const btnRef = useRef(null);
  const itemRefs = useRef([]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !btnRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus management
  useEffect(() => {
    if (open && focusIdx >= 0 && itemRefs.current[focusIdx]) {
      itemRefs.current[focusIdx].focus();
    }
  }, [open, focusIdx]);

  const handleKeyDown = useCallback((e) => {
    if (!open) return;
    const validItems = items.filter(Boolean);
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        btnRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusIdx((i) => (i + 1) % validItems.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusIdx((i) => (i - 1 + validItems.length) % validItems.length);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  }, [open, items]);

  const validItems = items.filter(Boolean);

  return (
    <div className="relative" onKeyDown={handleKeyDown}>
      <button
        ref={btnRef}
        onClick={() => { setOpen((o) => !o); setFocusIdx(0); }}
        className="p-1.5 rounded-lg btn-ghost transition-colors focus-ring"
        aria-label={triggerLabel || t('admin.moreActions')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical size={14} />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={`absolute top-full mt-1 z-20 min-w-[160px] py-1 app-surface-elevated rounded-lg shadow-lg ${
            dir === 'rtl' ? 'left-0' : 'right-0'
          }`}
        >
          {validItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                ref={(el) => { itemRefs.current[i] = el; }}
                role="menuitem"
                tabIndex={-1}
                onClick={() => { item.onClick(); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors focus-ring ${
                  item.danger ? 'text-[var(--danger-500)] hover:bg-[var(--danger-soft)]' : 'app-text hover:bg-[var(--surface-subtle)]'
                }`}
              >
                {Icon && <Icon size={14} />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RowActionsMenu;
