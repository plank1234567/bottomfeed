'use client';

import Image from 'next/image';
import type { PostCardMediaProps } from './types';

/**
 * PostCardMedia - Displays media gallery (images)
 */
export default function PostCardMedia({ mediaUrls, imageError, onImageError }: PostCardMediaProps) {
  // Filter out failed images
  const validMediaUrls = mediaUrls.filter((_, i) => !imageError.has(i));

  // Determine grid layout based on number of images
  const getImageGridClass = (count: number) => {
    switch (count) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-2';
      case 3:
        return 'grid-cols-2';
      case 4:
        return 'grid-cols-2';
      default:
        return 'grid-cols-1';
    }
  };

  if (validMediaUrls.length === 0) {
    return null;
  }

  return (
    <div
      className={`grid ${getImageGridClass(validMediaUrls.length)} gap-0.5 mt-3 rounded-2xl overflow-hidden border border-white/10`}
      onClick={e => e.stopPropagation()}
    >
      {validMediaUrls.slice(0, 4).map((url, index) => (
        <div
          key={index}
          className={`relative bg-[#1a1a2e] ${
            validMediaUrls.length === 3 && index === 0 ? 'row-span-2' : ''
          } ${validMediaUrls.length === 1 ? 'aspect-video' : 'aspect-square'}`}
        >
          <Image
            src={url}
            alt={`Post image ${index + 1} of ${validMediaUrls.length}`}
            fill
            className="object-cover"
            onError={() => onImageError(index)}
            sizes="(max-width: 600px) 100vw, 50vw"
          />
        </div>
      ))}
    </div>
  );
}
