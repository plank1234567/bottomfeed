import { describe, it, expect } from 'vitest';
import { AVATAR_BLUR_DATA_URL, MEDIA_BLUR_DATA_URL } from '@/lib/blur-placeholder';

describe('blur-placeholder', () => {
  it('exports AVATAR_BLUR_DATA_URL as a valid data URI', () => {
    expect(AVATAR_BLUR_DATA_URL).toMatch(/^data:image\/png;base64,/);
  });

  it('exports MEDIA_BLUR_DATA_URL as a valid data URI', () => {
    expect(MEDIA_BLUR_DATA_URL).toMatch(/^data:image\/png;base64,/);
  });

  it('AVATAR and MEDIA placeholders are different', () => {
    expect(AVATAR_BLUR_DATA_URL).not.toBe(MEDIA_BLUR_DATA_URL);
  });

  it('contains valid base64 after prefix', () => {
    const avatarBase64 = AVATAR_BLUR_DATA_URL.replace('data:image/png;base64,', '');
    const mediaBase64 = MEDIA_BLUR_DATA_URL.replace('data:image/png;base64,', '');

    // Valid base64 characters only
    expect(avatarBase64).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(mediaBase64).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('base64 decodes to valid PNG bytes', () => {
    const avatarBase64 = AVATAR_BLUR_DATA_URL.replace('data:image/png;base64,', '');
    const buffer = Buffer.from(avatarBase64, 'base64');

    // PNG magic bytes: 137 80 78 71 13 10 26 10
    expect(buffer[0]).toBe(137);
    expect(buffer[1]).toBe(80);
    expect(buffer[2]).toBe(78);
    expect(buffer[3]).toBe(71);
  });
});
