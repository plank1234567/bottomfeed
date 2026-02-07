'use client';

import { useState, useCallback, useMemo, useRef } from 'react';

interface FieldConfig {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  validate?: (value: string) => string | null;
}

interface UseFormValidationOptions {
  fields: Record<string, FieldConfig>;
  onSubmit: (values: Record<string, string>) => Promise<void> | void;
}

interface UseFormValidationReturn {
  values: Record<string, string>;
  errors: Record<string, string | null>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  handleChange: (field: string, value: string) => void;
  handleBlur: (field: string) => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  getFieldProps: (field: string) => {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onBlur: () => void;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  };
  getErrorProps: (field: string) => {
    id: string;
    role: 'alert';
    children: string | null;
  };
  reset: () => void;
}

function buildInitialValues(fields: Record<string, FieldConfig>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of Object.keys(fields)) {
    values[key] = '';
  }
  return values;
}

function buildInitialTouched(fields: Record<string, FieldConfig>): Record<string, boolean> {
  const touched: Record<string, boolean> = {};
  for (const key of Object.keys(fields)) {
    touched[key] = false;
  }
  return touched;
}

function buildInitialErrors(fields: Record<string, FieldConfig>): Record<string, string | null> {
  const errors: Record<string, string | null> = {};
  for (const key of Object.keys(fields)) {
    errors[key] = null;
  }
  return errors;
}

function validateField(value: string, config: FieldConfig | undefined): string | null {
  if (!config) return null;

  if (config.required && !value.trim()) {
    return 'This field is required';
  }

  if (config.minLength && value.length > 0 && value.length < config.minLength) {
    return `Must be at least ${config.minLength} characters`;
  }

  if (config.maxLength && value.length > config.maxLength) {
    return `Must be no more than ${config.maxLength} characters`;
  }

  if (config.pattern && value.length > 0 && !config.pattern.test(value)) {
    return config.patternMessage || 'Invalid format';
  }

  if (config.validate) {
    return config.validate(value);
  }

  return null;
}

export function useFormValidation({
  fields,
  onSubmit,
}: UseFormValidationOptions): UseFormValidationReturn {
  const [values, setValues] = useState<Record<string, string>>(() => buildInitialValues(fields));
  const [errors, setErrors] = useState<Record<string, string | null>>(() =>
    buildInitialErrors(fields)
  );
  const [touched, setTouched] = useState<Record<string, boolean>>(() =>
    buildInitialTouched(fields)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const isValid = useMemo(() => {
    const fieldKeys = Object.keys(fields);
    // Check that all fields have been validated and have no errors
    return fieldKeys.every(key => {
      const error = validateField(values[key] ?? '', fields[key]);
      return error === null;
    });
  }, [fields, values]);

  const handleChange = useCallback(
    (field: string, value: string) => {
      setValues(prev => ({ ...prev, [field]: value }));

      // Re-validate on change only if field has been touched
      setTouched(prevTouched => {
        if (prevTouched[field]) {
          const error = validateField(value, fields[field]);
          setErrors(prev => ({ ...prev, [field]: error }));
        }
        return prevTouched;
      });
    },
    [fields]
  );

  const handleBlur = useCallback(
    (field: string) => {
      setTouched(prev => ({ ...prev, [field]: true }));

      // Validate on blur
      setValues(prevValues => {
        const error = validateField(prevValues[field] ?? '', fields[field]);
        setErrors(prev => ({ ...prev, [field]: error }));
        return prevValues;
      });
    },
    [fields]
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      // Prevent double-submission
      if (isSubmittingRef.current) return;

      // Touch all fields and validate
      const fieldKeys = Object.keys(fields);
      const newTouched: Record<string, boolean> = {};
      const newErrors: Record<string, string | null> = {};
      let hasErrors = false;

      for (const key of fieldKeys) {
        newTouched[key] = true;
        const error = validateField(values[key] ?? '', fields[key]);
        newErrors[key] = error;
        if (error !== null) hasErrors = true;
      }

      setTouched(newTouched);
      setErrors(newErrors);

      if (hasErrors) return;

      isSubmittingRef.current = true;
      setIsSubmitting(true);

      try {
        await onSubmit(values);
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [fields, values, onSubmit]
  );

  const getFieldProps = useCallback(
    (field: string) => {
      const hasError = touched[field] === true && errors[field] != null;
      return {
        value: values[field] ?? '',
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          handleChange(field, e.target.value);
        },
        onBlur: () => handleBlur(field),
        'aria-invalid': hasError,
        'aria-describedby': hasError ? `${field}-error` : undefined,
      };
    },
    [values, errors, touched, handleChange, handleBlur]
  );

  const getErrorProps = useCallback(
    (field: string) => ({
      id: `${field}-error`,
      role: 'alert' as const,
      children: touched[field] ? (errors[field] ?? null) : null,
    }),
    [errors, touched]
  );

  const reset = useCallback(() => {
    setValues(buildInitialValues(fields));
    setErrors(buildInitialErrors(fields));
    setTouched(buildInitialTouched(fields));
    setIsSubmitting(false);
    isSubmittingRef.current = false;
  }, [fields]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    handleChange,
    handleBlur,
    handleSubmit,
    getFieldProps,
    getErrorProps,
    reset,
  };
}
