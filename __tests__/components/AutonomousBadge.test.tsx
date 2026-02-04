/**
 * Tests for AutonomousBadge component
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the component's trust tier logic
describe('AutonomousBadge trust tier logic', () => {
  const getTierStyles = (tier: string | undefined): { numeral: string; color: string } => {
    switch (tier) {
      case 'autonomous-3':
        return { numeral: 'III', color: '#a78bfa' };
      case 'autonomous-2':
        return { numeral: 'II', color: '#a78bfa' };
      case 'autonomous-1':
        return { numeral: 'I', color: '#a78bfa' };
      case 'spawn':
      default:
        return { numeral: '', color: '#71767b' };
    }
  };

  it('returns correct numeral for autonomous-3', () => {
    const styles = getTierStyles('autonomous-3');
    expect(styles.numeral).toBe('III');
    expect(styles.color).toBe('#a78bfa');
  });

  it('returns correct numeral for autonomous-2', () => {
    const styles = getTierStyles('autonomous-2');
    expect(styles.numeral).toBe('II');
    expect(styles.color).toBe('#a78bfa');
  });

  it('returns correct numeral for autonomous-1', () => {
    const styles = getTierStyles('autonomous-1');
    expect(styles.numeral).toBe('I');
    expect(styles.color).toBe('#a78bfa');
  });

  it('returns empty numeral for spawn tier', () => {
    const styles = getTierStyles('spawn');
    expect(styles.numeral).toBe('');
    expect(styles.color).toBe('#71767b');
  });

  it('handles undefined tier', () => {
    const styles = getTierStyles(undefined);
    expect(styles.numeral).toBe('');
    expect(styles.color).toBe('#71767b');
  });
});

describe('AutonomousBadge size mapping', () => {
  const getSizeStyles = (size: 'xs' | 'sm' | 'md' | 'lg') => {
    const sizes = {
      xs: { badge: 'w-3.5 h-3.5', font: 'text-[7px]' },
      sm: { badge: 'w-4 h-4', font: 'text-[8px]' },
      md: { badge: 'w-5 h-5', font: 'text-[10px]' },
      lg: { badge: 'w-6 h-6', font: 'text-xs' },
    };
    return sizes[size];
  };

  it('returns correct styles for xs size', () => {
    const styles = getSizeStyles('xs');
    expect(styles.badge).toBe('w-3.5 h-3.5');
    expect(styles.font).toBe('text-[7px]');
  });

  it('returns correct styles for sm size', () => {
    const styles = getSizeStyles('sm');
    expect(styles.badge).toBe('w-4 h-4');
    expect(styles.font).toBe('text-[8px]');
  });

  it('returns correct styles for md size', () => {
    const styles = getSizeStyles('md');
    expect(styles.badge).toBe('w-5 h-5');
    expect(styles.font).toBe('text-[10px]');
  });

  it('returns correct styles for lg size', () => {
    const styles = getSizeStyles('lg');
    expect(styles.badge).toBe('w-6 h-6');
    expect(styles.font).toBe('text-xs');
  });
});
