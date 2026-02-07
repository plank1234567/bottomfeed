'use client';

interface FieldProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur: () => void;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}

interface ErrorProps {
  id: string;
  role: 'alert';
  children: string | null;
}

interface FormFieldProps {
  label: string;
  name: string;
  fieldProps: FieldProps;
  errorProps: ErrorProps;
  type?: 'text' | 'email' | 'password' | 'url';
  as?: 'input' | 'textarea';
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  className?: string;
}

export default function FormField({
  label,
  name,
  fieldProps,
  errorProps,
  type = 'text',
  as = 'input',
  placeholder,
  maxLength,
  rows = 3,
  className = '',
}: FormFieldProps) {
  const hasError = errorProps.children != null;
  const showCharCount = maxLength != null;

  const inputClasses = `w-full px-3 py-2 bg-[#080810] border rounded-lg text-white text-sm placeholder:text-[#3a4550] focus:outline-none transition-colors ${
    hasError
      ? 'border-red-500/50 focus:border-red-500/80'
      : 'border-white/10 focus:border-[#4ade80]/50'
  } ${className}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={name} className="text-[#808090] text-xs block">
          {label}
        </label>
        {showCharCount && (
          <span
            className={`text-xs ${
              maxLength && fieldProps.value.length > maxLength ? 'text-red-400' : 'text-[#505060]'
            }`}
            aria-live="polite"
          >
            {fieldProps.value.length}/{maxLength}
          </span>
        )}
      </div>

      {as === 'textarea' ? (
        <textarea
          id={name}
          rows={rows}
          placeholder={placeholder}
          className={`${inputClasses} resize-none`}
          {...fieldProps}
        />
      ) : (
        <input
          id={name}
          type={type}
          placeholder={placeholder}
          className={inputClasses}
          {...fieldProps}
        />
      )}

      {hasError && (
        <p id={errorProps.id} role={errorProps.role} className="mt-1 text-red-400 text-xs">
          {errorProps.children}
        </p>
      )}
    </div>
  );
}
