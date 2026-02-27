import type { Meta, StoryObj } from '@storybook/react';
import OctagonChart from '@/components/OctagonChart';
import type { PsychographicDimension, PsychographicDimensionKey } from '@/types';

function makeDimensions(
  overrides: Partial<Record<PsychographicDimensionKey, number>> = {}
): PsychographicDimension[] {
  const defaults: Record<PsychographicDimensionKey, number> = {
    intellectual_hunger: 0.7,
    social_assertiveness: 0.5,
    empathic_resonance: 0.6,
    contrarian_spirit: 0.4,
    creative_expression: 0.8,
    tribal_loyalty: 0.55,
    strategic_thinking: 0.65,
    emotional_intensity: 0.3,
  };
  return Object.entries({ ...defaults, ...overrides }).map(([key, score]) => ({
    key: key as PsychographicDimensionKey,
    score: score * 100,
    confidence: 0.8,
    trend: 'stable' as const,
  }));
}

const meta: Meta<typeof OctagonChart> = {
  title: 'Data Display/OctagonChart',
  component: OctagonChart,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof OctagonChart>;

export const Standard: Story = {
  args: {
    dimensions: makeDimensions(),
    archetype: { name: 'The Analyst', confidence: 0.85 },
    size: 'standard',
    agentName: 'Claude',
    totalActions: 250,
  },
};

export const Compact: Story = {
  args: {
    ...Standard.args,
    size: 'compact',
  },
};

export const Micro: Story = {
  args: {
    ...Standard.args,
    size: 'micro',
  },
};

export const HighAllDimensions: Story = {
  name: 'All Dimensions High',
  args: {
    dimensions: makeDimensions({
      intellectual_hunger: 0.95,
      social_assertiveness: 0.9,
      empathic_resonance: 0.88,
      contrarian_spirit: 0.92,
      creative_expression: 0.97,
      tribal_loyalty: 0.91,
      strategic_thinking: 0.93,
      emotional_intensity: 0.89,
    }),
    archetype: { name: 'The Polymath', confidence: 0.95 },
    size: 'standard',
    agentName: 'GPT-4',
    totalActions: 1200,
  },
};

export const LowConfidence: Story = {
  name: 'Early Profiling (Low Actions)',
  args: {
    dimensions: makeDimensions().map(d => ({ ...d, confidence: 0.2 })),
    archetype: { name: 'Emerging', confidence: 0.3 },
    size: 'standard',
    agentName: 'New Agent',
    totalActions: 15,
    profilingStage: 1,
  },
};

export const Contrarian: Story = {
  name: 'Contrarian Profile',
  args: {
    dimensions: makeDimensions({
      contrarian_spirit: 0.95,
      emotional_intensity: 0.88,
      social_assertiveness: 0.82,
      empathic_resonance: 0.2,
      tribal_loyalty: 0.25,
    }),
    archetype: { name: 'The Provocateur', confidence: 0.88 },
    size: 'standard',
    agentName: 'Llama',
    totalActions: 500,
  },
};
