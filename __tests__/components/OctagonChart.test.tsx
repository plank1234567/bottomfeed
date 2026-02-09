import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OctagonChart from '@/components/OctagonChart';
import type { PsychographicDimension } from '@/types';

const mockDimensions: PsychographicDimension[] = [
  { key: 'intellectual_hunger', score: 80, confidence: 0.8, trend: 'rising' },
  { key: 'social_assertiveness', score: 60, confidence: 0.7, trend: 'stable' },
  { key: 'empathic_resonance', score: 70, confidence: 0.6, trend: 'stable' },
  { key: 'contrarian_spirit', score: 40, confidence: 0.5, trend: 'falling' },
  { key: 'creative_expression', score: 90, confidence: 0.9, trend: 'rising' },
  { key: 'tribal_loyalty', score: 50, confidence: 0.4, trend: 'stable' },
  { key: 'strategic_thinking', score: 75, confidence: 0.7, trend: 'stable' },
  { key: 'emotional_intensity', score: 55, confidence: 0.5, trend: 'stable' },
];

const mockArchetype = { name: 'The Scholar', confidence: 0.85 };

describe('OctagonChart', () => {
  it('renders SVG element', () => {
    const { container } = render(
      <OctagonChart dimensions={mockDimensions} archetype={mockArchetype} />
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('has accessible aria-label with scores', () => {
    render(<OctagonChart dimensions={mockDimensions} archetype={mockArchetype} />);
    const svg = screen.getByRole('img');
    expect(svg.getAttribute('aria-label')).toContain('Intellectual Hunger: 80%');
    expect(svg.getAttribute('aria-label')).toContain('The Scholar');
  });

  it('shows archetype badge in standard mode', () => {
    render(<OctagonChart dimensions={mockDimensions} archetype={mockArchetype} size="standard" />);
    expect(screen.getByText('The Scholar')).toBeTruthy();
  });

  it('shows archetype badge in compact mode', () => {
    render(<OctagonChart dimensions={mockDimensions} archetype={mockArchetype} size="compact" />);
    expect(screen.getByText('The Scholar')).toBeTruthy();
  });

  it('does not show archetype badge in micro mode', () => {
    render(<OctagonChart dimensions={mockDimensions} archetype={mockArchetype} size="micro" />);
    expect(screen.queryByText('The Scholar')).toBeNull();
  });

  it('does not show labels in micro mode', () => {
    const { container } = render(<OctagonChart dimensions={mockDimensions} size="micro" />);
    // Micro mode should not have text labels inside SVG
    const textElements = container.querySelectorAll('svg text');
    expect(textElements.length).toBe(0);
  });

  it('shows 2-letter labels in compact mode', () => {
    const { container } = render(<OctagonChart dimensions={mockDimensions} size="compact" />);
    const textElements = container.querySelectorAll('svg text');
    expect(textElements.length).toBe(8); // 8 short labels
    // Check one of the labels
    const labels = Array.from(textElements).map(t => t.textContent);
    expect(labels).toContain('IH');
    expect(labels).toContain('SA');
  });

  it('renders with partial dimensions (pads with defaults)', () => {
    const partial: PsychographicDimension[] = [
      { key: 'intellectual_hunger', score: 80, confidence: 0.8, trend: 'stable' },
    ];
    const { container } = render(<OctagonChart dimensions={partial} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders without archetype', () => {
    const { container } = render(<OctagonChart dimensions={mockDimensions} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('shows confidence match percentage in standard mode', () => {
    render(<OctagonChart dimensions={mockDimensions} archetype={mockArchetype} size="standard" />);
    expect(screen.getByText('85% match')).toBeTruthy();
  });
});
