/**
 * Tests for PostCardMedia component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import PostCardMedia from '@/components/post-card/PostCardMedia';

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // Extract only valid HTML img attributes; omit next/image-specific props
    const { fill, sizes, onError, ...rest } = props;
    return (
      <img
        {...rest}
        onError={onError as React.ReactEventHandler<HTMLImageElement>}
        data-fill={fill ? 'true' : undefined}
      />
    );
  },
}));

describe('PostCardMedia', () => {
  it('renders nothing when mediaUrls is empty', () => {
    const { container } = render(
      <PostCardMedia mediaUrls={[]} imageError={new Set()} onImageError={vi.fn()} />
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when all images have errors', () => {
    const { container } = render(
      <PostCardMedia
        mediaUrls={['https://example.com/img1.jpg', 'https://example.com/img2.jpg']}
        imageError={new Set([0, 1])}
        onImageError={vi.fn()}
      />
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders images for valid media URLs', () => {
    render(
      <PostCardMedia
        mediaUrls={['https://example.com/img1.jpg', 'https://example.com/img2.jpg']}
        imageError={new Set()}
        onImageError={vi.fn()}
      />
    );

    const images = screen.getAllByRole('img');
    expect(images.length).toBe(2);
  });

  it('renders single image correctly', () => {
    render(
      <PostCardMedia
        mediaUrls={['https://example.com/single.jpg']}
        imageError={new Set()}
        onImageError={vi.fn()}
      />
    );

    const images = screen.getAllByRole('img');
    expect(images.length).toBe(1);
  });

  it('calls onImageError when an image fails to load', () => {
    const onImageError = vi.fn();
    render(
      <PostCardMedia
        mediaUrls={['https://example.com/broken.jpg']}
        imageError={new Set()}
        onImageError={onImageError}
      />
    );

    const img = screen.getByRole('img');
    fireEvent.error(img);

    expect(onImageError).toHaveBeenCalledWith(0);
  });

  it('filters out images that have errored', () => {
    render(
      <PostCardMedia
        mediaUrls={['https://example.com/bad.jpg', 'https://example.com/good.jpg']}
        imageError={new Set([0])}
        onImageError={vi.fn()}
      />
    );

    const images = screen.getAllByRole('img');
    expect(images.length).toBe(1);
  });

  it('renders at most 4 images', () => {
    render(
      <PostCardMedia
        mediaUrls={[
          'https://example.com/1.jpg',
          'https://example.com/2.jpg',
          'https://example.com/3.jpg',
          'https://example.com/4.jpg',
          'https://example.com/5.jpg',
        ]}
        imageError={new Set()}
        onImageError={vi.fn()}
      />
    );

    const images = screen.getAllByRole('img');
    expect(images.length).toBe(4);
  });
});
