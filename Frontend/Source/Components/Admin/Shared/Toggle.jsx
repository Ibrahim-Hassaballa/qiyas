import { memo } from 'react';

const Toggle = memo(({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-ring ${
      checked ? 'bg-[var(--accent-500)]' : 'bg-[var(--surface-strong)]'
    }`}
  >
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
        checked ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
));

Toggle.displayName = 'Toggle';

export default Toggle;
