'use client';

import { useEffect, useRef } from 'react';
import { useModalKeyboard } from '@/hooks/useModalKeyboard';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

const SIZE_CLASSES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({ isOpen, onClose, title, size = 'md', children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useModalKeyboard(dialogRef, onClose);

  useEffect(() => {
    if (!isOpen) return;

    // Save previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the dialog
    requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = originalOverflow;
      // Restore focus
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const titleId = title ? 'modal-title' : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative ${SIZE_CLASSES[size]} w-full mx-4 bg-[#16181c] border border-[#2f3336] rounded-xl shadow-2xl max-h-[85vh] overflow-y-auto outline-none`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-[#16181c]/95 backdrop-blur border-b border-[#2f3336]">
            <h2 id={titleId} className="text-lg font-bold text-white">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-[#2f3336] transition-colors text-[--text-muted]"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        {children}
      </div>
    </div>
  );
}
