/**
 * Tests for useFormValidation hook
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormValidation } from '@/hooks/useFormValidation';

describe('useFormValidation', () => {
  const defaultFields = {
    name: { required: true, minLength: 2, maxLength: 50 },
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      patternMessage: 'Invalid email address',
    },
  };

  it('initializes with empty values and no errors', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useFormValidation({ fields: defaultFields, onSubmit }));

    expect(result.current.values).toEqual({ name: '', email: '' });
    expect(result.current.errors).toEqual({ name: null, email: null });
    expect(result.current.touched).toEqual({ name: false, email: false });
    expect(result.current.isSubmitting).toBe(false);
  });

  it('validates required fields', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: { name: { required: true } },
        onSubmit,
      })
    );

    // Blur the field without entering a value
    act(() => {
      result.current.handleBlur('name');
    });

    expect(result.current.errors.name).toBe('This field is required');
  });

  it('validates minLength', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: { name: { minLength: 5 } },
        onSubmit,
      })
    );

    act(() => {
      result.current.handleChange('name', 'ab');
    });

    act(() => {
      result.current.handleBlur('name');
    });

    expect(result.current.errors.name).toBe('Must be at least 5 characters');
  });

  it('validates maxLength', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: { name: { maxLength: 5 } },
        onSubmit,
      })
    );

    act(() => {
      result.current.handleChange('name', 'abcdef');
    });

    act(() => {
      result.current.handleBlur('name');
    });

    expect(result.current.errors.name).toBe('Must be no more than 5 characters');
  });

  it('validates pattern', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: {
          email: {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            patternMessage: 'Invalid email address',
          },
        },
        onSubmit,
      })
    );

    act(() => {
      result.current.handleChange('email', 'not-an-email');
    });

    act(() => {
      result.current.handleBlur('email');
    });

    expect(result.current.errors.email).toBe('Invalid email address');
  });

  it('uses default pattern message when none provided', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: {
          code: {
            pattern: /^\d+$/,
          },
        },
        onSubmit,
      })
    );

    act(() => {
      result.current.handleChange('code', 'abc');
    });

    act(() => {
      result.current.handleBlur('code');
    });

    expect(result.current.errors.code).toBe('Invalid format');
  });

  it('validates with custom validator', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: {
          password: {
            validate: (value: string) => (value.includes(' ') ? 'No spaces allowed' : null),
          },
        },
        onSubmit,
      })
    );

    act(() => {
      result.current.handleChange('password', 'has space');
    });

    act(() => {
      result.current.handleBlur('password');
    });

    expect(result.current.errors.password).toBe('No spaces allowed');
  });

  it('only shows errors after field is touched (blur)', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: { name: { required: true } },
        onSubmit,
      })
    );

    // Before blur, no errors should be surfaced even though field is invalid
    expect(result.current.touched.name).toBe(false);
    expect(result.current.errors.name).toBeNull();

    // Change the value (still not touched)
    act(() => {
      result.current.handleChange('name', '');
    });

    expect(result.current.touched.name).toBe(false);

    // Now blur the field
    act(() => {
      result.current.handleBlur('name');
    });

    expect(result.current.touched.name).toBe(true);
    expect(result.current.errors.name).toBe('This field is required');
  });

  it('re-validates on change after field is touched', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: { name: { required: true, minLength: 3 } },
        onSubmit,
      })
    );

    // Touch the field with empty value
    act(() => {
      result.current.handleBlur('name');
    });

    expect(result.current.errors.name).toBe('This field is required');

    // Type a valid value - should clear the error
    act(() => {
      result.current.handleChange('name', 'John');
    });

    expect(result.current.errors.name).toBeNull();

    // Type a short value - should show minLength error
    act(() => {
      result.current.handleChange('name', 'ab');
    });

    expect(result.current.errors.name).toBe('Must be at least 3 characters');
  });

  it('prevents double-submission', async () => {
    let resolveSubmit: () => void;
    const submitPromise = new Promise<void>(resolve => {
      resolveSubmit = resolve;
    });
    const onSubmit = vi.fn(() => submitPromise);

    const { result } = renderHook(() =>
      useFormValidation({
        fields: { name: {} },
        onSubmit,
      })
    );

    // Set a value
    act(() => {
      result.current.handleChange('name', 'test');
    });

    // Start first submission
    let submitComplete = false;
    act(() => {
      result.current.handleSubmit().then(() => {
        submitComplete = true;
      });
    });

    expect(result.current.isSubmitting).toBe(true);

    // Try to submit again while still submitting
    await act(async () => {
      await result.current.handleSubmit();
    });

    // Should only have been called once
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // Resolve the first submission
    await act(async () => {
      resolveSubmit!();
      await submitPromise;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it('calls onSubmit with current values on valid submit', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: { name: { required: true } },
        onSubmit,
      })
    );

    act(() => {
      result.current.handleChange('name', 'John Doe');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onSubmit).toHaveBeenCalledWith({ name: 'John Doe' });
  });

  it('does not call onSubmit when validation fails', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: { name: { required: true } },
        onSubmit,
      })
    );

    // Submit with empty required field
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    // All fields should be touched after failed submit
    expect(result.current.touched.name).toBe(true);
    expect(result.current.errors.name).toBe('This field is required');
  });

  it('resets all state', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: { name: { required: true } },
        onSubmit,
      })
    );

    // Change value and touch field
    act(() => {
      result.current.handleChange('name', 'test');
      result.current.handleBlur('name');
    });

    expect(result.current.values.name).toBe('test');
    expect(result.current.touched.name).toBe(true);

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.values).toEqual({ name: '' });
    expect(result.current.errors).toEqual({ name: null });
    expect(result.current.touched).toEqual({ name: false });
    expect(result.current.isSubmitting).toBe(false);
  });

  it('getFieldProps returns correct ARIA attributes when no error', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: { name: { required: true } },
        onSubmit,
      })
    );

    const fieldProps = result.current.getFieldProps('name');

    expect(fieldProps.value).toBe('');
    expect(fieldProps['aria-invalid']).toBe(false);
    expect(fieldProps['aria-describedby']).toBeUndefined();
    expect(typeof fieldProps.onChange).toBe('function');
    expect(typeof fieldProps.onBlur).toBe('function');
  });

  it('getFieldProps returns correct ARIA attributes when field has error', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: { name: { required: true } },
        onSubmit,
      })
    );

    // Touch the field to surface the error
    act(() => {
      result.current.handleBlur('name');
    });

    const fieldProps = result.current.getFieldProps('name');

    expect(fieldProps['aria-invalid']).toBe(true);
    expect(fieldProps['aria-describedby']).toBe('name-error');
  });

  it('getErrorProps returns correct structure', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: { name: { required: true } },
        onSubmit,
      })
    );

    // Before touch, children should be null
    let errorProps = result.current.getErrorProps('name');
    expect(errorProps.id).toBe('name-error');
    expect(errorProps.role).toBe('alert');
    expect(errorProps.children).toBeNull();

    // After touch with error
    act(() => {
      result.current.handleBlur('name');
    });

    errorProps = result.current.getErrorProps('name');
    expect(errorProps.children).toBe('This field is required');
  });

  it('isValid is computed correctly', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: {
          name: { required: true },
          email: { required: true },
        },
        onSubmit,
      })
    );

    // Initially invalid because required fields are empty
    expect(result.current.isValid).toBe(false);

    // Fill in one field
    act(() => {
      result.current.handleChange('name', 'John');
    });

    // Still invalid because email is empty
    expect(result.current.isValid).toBe(false);

    // Fill in both fields
    act(() => {
      result.current.handleChange('email', 'john@test.com');
    });

    expect(result.current.isValid).toBe(true);
  });

  it('passes empty fields as valid when no validation rules', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: { notes: {} },
        onSubmit,
      })
    );

    expect(result.current.isValid).toBe(true);

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onSubmit).toHaveBeenCalledWith({ notes: '' });
  });

  it('prevents default on form event when submitting', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: { name: {} },
        onSubmit,
      })
    );

    const preventDefault = vi.fn();
    const fakeEvent = { preventDefault } as unknown as React.FormEvent;

    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });

    expect(preventDefault).toHaveBeenCalled();
  });

  it('skips pattern validation for empty non-required fields', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: {
          website: {
            pattern: /^https?:\/\//,
            patternMessage: 'Must start with http:// or https://',
          },
        },
        onSubmit,
      })
    );

    // Blur with empty value - should NOT trigger pattern error
    act(() => {
      result.current.handleBlur('website');
    });

    expect(result.current.errors.website).toBeNull();
  });

  it('skips minLength validation for empty non-required fields', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        fields: {
          bio: { minLength: 10 },
        },
        onSubmit,
      })
    );

    // Blur with empty value - should NOT trigger minLength error
    act(() => {
      result.current.handleBlur('bio');
    });

    expect(result.current.errors.bio).toBeNull();
  });
});
