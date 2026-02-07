'use client';

import { useOfflineDetection } from '@/hooks/useOfflineDetection';
import { useTranslation } from '@/components/LocaleProvider';

export default function OfflineBanner() {
  const isOffline = useOfflineDetection();
  const { t } = useTranslation();

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[100] bg-amber-600 text-white text-center py-2 text-sm font-medium"
    >
      {t('offline.banner')}
    </div>
  );
}
