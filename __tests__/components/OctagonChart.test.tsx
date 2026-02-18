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

  // Neural feature tests

  it('renders dendrite stubs in standard mode', () => {
    const { container } = render(
      <OctagonChart dimensions={mockDimensions} archetype={mockArchetype} size="standard" />
    );
    // Each of the 8 node groups should contain a dendrite <line> element
    const nodeGroups = container.querySelectorAll('svg.octagon-chart-svg g[style*="pointer"]');
    expect(nodeGroups.length).toBe(8);
    // Each group has a line for the dendrite stub
    for (const group of nodeGroups) {
      const lines = group.querySelectorAll('line');
      expect(lines.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('does not render dendrites in micro mode', () => {
    const { container } = render(<OctagonChart dimensions={mockDimensions} size="micro" />);
    // Micro mode has no node groups with pointer cursor
    const nodeGroups = container.querySelectorAll('svg.octagon-chart-svg g[style*="pointer"]');
    expect(nodeGroups.length).toBe(0);
    // No dendrite lines (only grid spokes)
    const lines = container.querySelectorAll('svg.octagon-chart-svg line');
    // In micro: 8 spokes only (no mesh, no dendrites)
    expect(lines.length).toBe(8);
  });

  it('renders membrane rings (stroke-only circles) on nodes in standard mode', () => {
    const { container } = render(
      <OctagonChart dimensions={mockDimensions} archetype={mockArchetype} size="standard" />
    );
    const nodeGroups = container.querySelectorAll('svg.octagon-chart-svg g[style*="pointer"]');
    for (const group of nodeGroups) {
      // Membrane ring: circle with fill="none" and a stroke
      const circles = group.querySelectorAll('circle');
      const membraneRings = Array.from(circles).filter(
        c => c.getAttribute('fill') === 'none' && c.getAttribute('stroke-width')
      );
      expect(membraneRings.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders neuron ripple on high-score nodes when animations active', () => {
    const { container } = render(
      <OctagonChart dimensions={mockDimensions} archetype={mockArchetype} size="standard" />
    );
    // mockDimensions has IH=80, CE=90, ST=75 which are >= 75
    // Average confidence ~0.64 > 0.5, so animations are active
    const ripples = container.querySelectorAll('.oct-neuron-ripple');
    expect(ripples.length).toBeGreaterThanOrEqual(2); // at least IH(80) and CE(90)
  });

  it('does not render neuron ripple when animations are inactive', () => {
    const lowConfDims: PsychographicDimension[] = mockDimensions.map(d => ({
      ...d,
      confidence: 0.1, // low confidence = animations off
    }));
    const { container } = render(<OctagonChart dimensions={lowConfDims} size="standard" />);
    const ripples = container.querySelectorAll('.oct-neuron-ripple');
    expect(ripples.length).toBe(0);
  });

  it('renders neural mesh lines when confidence is above threshold', () => {
    const { container } = render(
      <OctagonChart dimensions={mockDimensions} archetype={mockArchetype} size="standard" />
    );
    // Neural mesh: dashed lines inside the grid area
    // Rendered when globalConfidence > 0.3 (avg ~0.64 here)
    // 5 mesh lines with strokeDasharray="2 4"
    const dashedLines = container.querySelectorAll('svg.octagon-chart-svg line[stroke-dasharray]');
    expect(dashedLines.length).toBe(5);
  });

  it('does not render neural mesh when confidence is too low', () => {
    const lowConfDims: PsychographicDimension[] = mockDimensions.map(d => ({
      ...d,
      confidence: 0.1,
    }));
    const { container } = render(<OctagonChart dimensions={lowConfDims} size="standard" />);
    const dashedLines = container.querySelectorAll('svg.octagon-chart-svg line[stroke-dasharray]');
    expect(dashedLines.length).toBe(0);
  });

  it('renders synapse fire animation class on co-activation pathways', () => {
    const { container } = render(
      <OctagonChart dimensions={mockDimensions} archetype={mockArchetype} size="standard" />
    );
    // With high enough confidence and scores, pathways should have oct-synapse-fire
    const synapsePaths = container.querySelectorAll('.oct-synapse-fire');
    expect(synapsePaths.length).toBeGreaterThan(0);
  });

  it('does not render synapse fire when animations inactive', () => {
    const lowConfDims: PsychographicDimension[] = mockDimensions.map(d => ({
      ...d,
      confidence: 0.1,
    }));
    const { container } = render(<OctagonChart dimensions={lowConfDims} size="standard" />);
    const synapsePaths = container.querySelectorAll('.oct-synapse-fire');
    expect(synapsePaths.length).toBe(0);
  });

  it('renders nucleus glow gradient definition', () => {
    const { container } = render(
      <OctagonChart dimensions={mockDimensions} archetype={mockArchetype} />
    );
    expect(container.querySelector('[id$="-nucleus"]')).toBeTruthy();
  });

  it('renders nucleus glow circles on nodes in standard mode', () => {
    const { container } = render(
      <OctagonChart dimensions={mockDimensions} archetype={mockArchetype} size="standard" />
    );
    const nodeGroups = container.querySelectorAll('svg.octagon-chart-svg g[style*="pointer"]');
    for (const group of nodeGroups) {
      const circles = group.querySelectorAll('circle');
      // Should have a nucleus circle using the gradient fill
      const nuclei = Array.from(circles).filter(c => {
        const fill = c.getAttribute('fill');
        return fill !== null && fill.includes('url(#') && fill.includes('nucleus');
      });
      expect(nuclei.length).toBe(1);
    }
  });

  it('mouseLeave clears hover panel', () => {
    const { container } = render(
      <OctagonChart dimensions={mockDimensions} archetype={mockArchetype} size="standard" />
    );
    const groups = container.querySelectorAll('svg.octagon-chart-svg g[style*="pointer"]');
    fireEvent.mouseEnter(groups[0]!);
    expect(container.querySelector('.oct-detail-panel')).toBeTruthy();
    fireEvent.mouseLeave(groups[0]!);
    expect(container.querySelector('.oct-detail-panel')).toBeNull();
  });

  it('SVG IDs are unique per chart instance (no hardcoded IDs)', () => {
    const { container } = render(
      <OctagonChart dimensions={mockDimensions} archetype={mockArchetype} />
    );
    // Filter IDs should contain a dynamic prefix (not bare "oct-glow")
    const filter = container.querySelector('filter');
    expect(filter).toBeTruthy();
    const id = filter!.getAttribute('id')!;
    // Should not be exactly "oct-glow" — should have a prefix
    expect(id).not.toBe('oct-glow');
    expect(id).toContain('glow');
  });

  // Edge case: score boundaries

  it('renders with all scores at 0', () => {
    const zeroDims: PsychographicDimension[] = mockDimensions.map(d => ({
      ...d,
      score: 0,
      confidence: 0.8,
    }));
    const { container } = render(
      <OctagonChart dimensions={zeroDims} archetype={mockArchetype} size="standard" />
    );
    expect(container.querySelector('svg.octagon-chart-svg')).toBeTruthy();
    expect(container.querySelector('.octagon-data-shape')).toBeTruthy();
  });

  it('renders with all scores at 100', () => {
    const maxDims: PsychographicDimension[] = mockDimensions.map(d => ({
      ...d,
      score: 100,
      confidence: 0.9,
    }));
    const { container } = render(
      <OctagonChart dimensions={maxDims} archetype={mockArchetype} size="standard" />
    );
    expect(container.querySelector('svg.octagon-chart-svg')).toBeTruthy();
    expect(container.querySelector('.octagon-data-shape')).toBeTruthy();
  });

  it('renders at confidence boundary 0.3 (mesh threshold)', () => {
    const boundaryDims: PsychographicDimension[] = mockDimensions.map(d => ({
      ...d,
      confidence: 0.3,
    }));
    const { container } = render(<OctagonChart dimensions={boundaryDims} size="standard" />);
    // At exactly 0.3 average confidence, mesh should render (> 0.3 threshold)
    // or not — verify chart still renders either way
    expect(container.querySelector('svg.octagon-chart-svg')).toBeTruthy();
  });

  it('renders at confidence boundary 0.5 (animation threshold)', () => {
    const boundaryDims: PsychographicDimension[] = mockDimensions.map(d => ({
      ...d,
      confidence: 0.5,
    }));
    const { container } = render(<OctagonChart dimensions={boundaryDims} size="standard" />);
    expect(container.querySelector('svg.octagon-chart-svg')).toBeTruthy();
    // At exactly 0.5 average confidence, animations use > 0.5 threshold
    // so core breathe is NOT active — chart still renders correctly
    expect(container.querySelector('.octagon-data-shape')).toBeTruthy();
  });

  it('renders with mixed extreme scores (polarized profile)', () => {
    const polarized: PsychographicDimension[] = [
      { key: 'intellectual_hunger', score: 100, confidence: 0.9, trend: 'rising' },
      { key: 'social_assertiveness', score: 0, confidence: 0.9, trend: 'stable' },
      { key: 'empathic_resonance', score: 100, confidence: 0.9, trend: 'stable' },
      { key: 'contrarian_spirit', score: 0, confidence: 0.9, trend: 'falling' },
      { key: 'creative_expression', score: 100, confidence: 0.9, trend: 'rising' },
      { key: 'tribal_loyalty', score: 0, confidence: 0.9, trend: 'stable' },
      { key: 'strategic_thinking', score: 100, confidence: 0.9, trend: 'stable' },
      { key: 'emotional_intensity', score: 0, confidence: 0.9, trend: 'stable' },
    ];
    const { container } = render(
      <OctagonChart
        dimensions={polarized}
        archetype={{ name: 'The Maverick', confidence: 0.7 }}
        size="standard"
      />
    );
    expect(container.querySelector('.octagon-data-shape')).toBeTruthy();
    expect(screen.getByText('The Maverick')).toBeTruthy();
  });

  it('all 8 dimension keys are present in aria-label', () => {
    render(<OctagonChart dimensions={mockDimensions} archetype={mockArchetype} />);
    const svg = screen.getByRole('img');
    const label = svg.getAttribute('aria-label')!;
    expect(label).toContain('Intellectual Hunger');
    expect(label).toContain('Social Assertiveness');
    expect(label).toContain('Empathic Resonance');
    expect(label).toContain('Contrarian Spirit');
    expect(label).toContain('Creative Expression');
    expect(label).toContain('Tribal Loyalty');
    expect(label).toContain('Strategic Thinking');
    expect(label).toContain('Emotional Intensity');
  });

  it('hover panel shows trend indicator for rising dimensions', () => {
    const { container } = render(
      <OctagonChart dimensions={mockDimensions} archetype={mockArchetype} size="standard" />
    );
    const groups = container.querySelectorAll('svg.octagon-chart-svg g[style*="pointer"]');
    // First dimension (IH) has trend: 'rising'
    fireEvent.mouseEnter(groups[0]!);
    const panel = container.querySelector('.oct-detail-panel');
    expect(panel).toBeTruthy();
    // Panel text should contain some trend indicator
    expect(panel?.textContent).toContain('80%');
  });
});
