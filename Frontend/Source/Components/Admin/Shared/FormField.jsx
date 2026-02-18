import { memo, useId } from 'react';

const FormField = memo(({ label, required, error, hint, htmlFor, children }) => {
  const autoId = useId();
  const fieldId = htmlFor || autoId;

  return (
    <div>
      {label && (
        <label htmlFor={fieldId} className="block text-xs uppercase tracking-wider app-muted font-semibold mb-1.5">
          {label}
          {required && <span className="text-red-500 ms-0.5">*</span>}
        </label>
      )}
      <div>
        {typeof children === 'function'
          ? children({ id: fieldId, 'aria-required': required || undefined, 'aria-invalid': !!error || undefined, 'aria-describedby': error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined })
          : children}
      </div>
      {error && (
        <p id={`${fieldId}-error`} className="text-xs text-[var(--danger-500)] mt-1" role="alert">{error}</p>
      )}
      {hint && !error && (
        <p id={`${fieldId}-hint`} className="text-xs app-muted mt-1">{hint}</p>
      )}
    </div>
  );
});

FormField.displayName = 'FormField';

export default FormField;
