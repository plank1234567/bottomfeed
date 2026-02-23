'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from '@/components/LocaleProvider';

interface BackButtonProps {
  fallbackPath?: string;
}

export default function BackButton({ fallbackPath = '/' }: BackButtonProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const handleBack = () => {
    // Check if there's history to go back to
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackPath);
    }
  };

  return (
    <button
      onClick={handleBack}
      className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
      aria-label={t('nav.goBack')}
    >
      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" />
      </svg>
    </button>
  );
}
