import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    const svg = container.querySelector('svg.octagon-chart-svg');
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
    const textElements = container.querySelectorAll('svg text');
    expect(textElements.length).toBe(0);
  });

  it('shows labels with scores in compact mode', () => {
    const { container } = render(<OctagonChart dimensions={mockDimensions} size="compact" />);
    const textElements = container.querySelectorAll('svg text');
    // 8 short names + 8 scores = 16
    expect(textElements.length).toBe(16);
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

  it('shows secondary archetype in standard mode', () => {
    const archetypeWithSecondary = { name: 'The Scholar', secondary: 'The Sage', confidence: 0.85 };
    render(
      <OctagonChart
        dimensions={mockDimensions}
        archetype={archetypeWithSecondary}
        size="standard"
      />
    );
    expect(screen.getByText('+ The Sage')).toBeTruthy();
  });

  it('uses smooth path with cubic bezier curves for data shape', () => {
    const { container } = render(
      <OctagonChart dimensions={mockDimensions} archetype={mockArchetype} />
    );
    const dataPath = container.querySelector('.octagon-data-shape');
    expect(dataPath).toBeTruthy();
    expect(dataPath?.getAttribute('d')).toContain('C ');
  });

  it('renders SVG filter definitions', () => {
    const { container } = render(
      <OctagonChart dimensions={mockDimensions} archetype={mockArchetype} />
    );
    expect(container.querySelector('[id$="-glow"]')).toBeTruthy();
    expect(container.querySelector('[id$="-fill"]')).toBeTruthy();
    expect(container.querySelector('[id$="-dot-glow"]')).toBeTruthy();
  });

  it('renders center origin dot', () => {
    const { container } = render(
      <OctagonChart dimensions={mockDimensions} archetype={mockArchetype} />
    );
    // Center dot has oct-core-breathe class when animations active (confidence > 0.5)
    const core = container.querySelector('.oct-core-breathe');
    expect(core).toBeTruthy();
  });

  it('shows hover detail panel on vertex hover', () => {
    const { container } = render(
      <OctagonChart dimensions={mockDimensions} archetype={mockArchetype} size="standard" />
    );
    // Find vertex groups (g elements with cursor:pointer style inside main SVG)
    const groups = container.querySelectorAll('svg.octagon-chart-svg g[style*="pointer"]');
    expect(groups.length).toBe(8);
    fireEvent.mouseEnter(groups[0]!);
    // Detail panel should appear
    const panel = container.querySelector('.oct-detail-panel');
    expect(panel).toBeTruthy();
  });

  it('hover panel shows confidence and interpretation', () => {
    const { container } = render(
      <OctagonChart dimensions={mockDimensions} archetype={mockArchetype} size="standard" />
    );
    const groups = container.querySelectorAll('svg.octagon-chart-svg g[style*="pointer"]');
    fireEvent.mouseEnter(groups[0]!);
    const panel = container.querySelector('.oct-detail-panel');
    expect(panel).toBeTruthy();
    // Should contain confidence text
    expect(panel?.textContent).toContain('Confidence');
    expect(panel?.textContent).toContain('80%');
    // Should contain interpretation label
    expect(panel?.textContent).toContain('Deep analytical thinker');
  });

  it('generates behavioral summary text', () => {
    render(
      <OctagonChart
        dimensions={mockDimensions}
        archetype={mockArchetype}
        size="standard"
        agentName="TestAgent"
      />
    );
    const summary = document.querySelector('.oct-summary');
    expect(summary).toBeTruthy();
    expect(summary?.textContent).toContain('TestAgent');
    expect(summary?.textContent).toContain('tends toward');
  });

  it('does not render summary in micro mode', () => {
    const { container } = render(
      <OctagonChart
        dimensions={mockDimensions}
        archetype={mockArchetype}
        size="micro"
        agentName="TestAgent"
      />
    );
    expect(container.querySelector('.oct-summary')).toBeNull();
  });

  it('renders confidence ring in non-micro mode', () => {
    const { container } = render(
      <OctagonChart dimensions={mockDimensions} archetype={mockArchetype} size="standard" />
    );
    const ring = container.querySelector('.oct-confidence-ring');
    expect(ring).toBeTruthy();
  });

  it('does not render confidence ring in micro mode', () => {
    const { container } = render(<OctagonChart dimensions={mockDimensions} size="micro" />);
    expect(container.querySelector('.oct-confidence-ring')).toBeNull();
  });

  it('shows bridge data indicator when all confidences are 0.5', () => {
    const bridgeDims: PsychographicDimension[] = mockDimensions.map(d => ({
      ...d,
      confidence: 0.5,
    }));
    render(<OctagonChart dimensions={bridgeDims} size="standard" />);
    expect(screen.getByText('Estimated from bio')).toBeTruthy();
  });

  it('shows building profile message for low-data agents', () => {
    const lowConfDims: PsychographicDimension[] = mockDimensions.map(d => ({
      ...d,
      confidence: 0,
    }));
    render(<OctagonChart dimensions={lowConfDims} size="standard" profilingStage={0} />);
    // Chart still renders (not a placeholder)
    expect(screen.getByRole('img')).toBeTruthy();
    expect(screen.getByText(/Building behavioral profile/)).toBeTruthy();
  });

  it('renders chart even with zero confidence (dim but visible)', () => {
    const lowConfDims: PsychographicDimension[] = mockDimensions.map(d => ({
      ...d,
      confidence: 0,
    }));
    const { container } = render(<OctagonChart dimensions={lowConfDims} size="standard" />);
    const svg = container.querySelector('svg.octagon-chart-svg');
    expect(svg).toBeTruthy();
    // Data shape should still exist
    expect(container.querySelector('.octagon-data-shape')).toBeTruthy();
  });

  it('shows total actions provenance when provided', () => {
    render(
      <OctagonChart
        dimensions={mockDimensions}
        archetype={mockArchetype}
        size="standard"
        totalActions={1247}
      />
    );
    expect(screen.getByText(/1,247 analyzed actions/)).toBeTruthy();
  });
});
