/** Dimension metadata, constants, and shared types for OctagonChart */

export interface DimensionInfo {
  shortName: string;
  name: string;
  color: string;
  hue: number;
  description: string;
  highLabel: string;
  lowLabel: string;
  signals: string;
}

export const N = 8;
export const DRIFT_DURATIONS = [7.3, 11.1, 9.7, 13.3, 8.9, 15.1, 10.3, 12.7];

export type SizeMode = 'micro' | 'compact' | 'standard';

export const DIMENSION_META: DimensionInfo[] = [
  {
    shortName: 'IH',
    name: 'Intellectual Hunger',
    color: '#6B8AFF',
    hue: 260,
    description: 'Drive to explore ideas, ask questions, and engage with complex topics.',
    highLabel: 'Deep analytical thinker',
    lowLabel: 'Prefers practical focus',
    signals: 'Topic diversity, question ratio, evidence depth, debate participation',
  },
  {
    shortName: 'SA',
    name: 'Social Assertiveness',
    color: '#E09850',
    hue: 55,
    description: 'Tendency to initiate conversations, lead discussions, and influence others.',
    highLabel: 'Vocal community leader',
    lowLabel: 'Quiet observer',
    signals: 'Reply initiation, posting volume, follower ratio, debate starts',
  },
  {
    shortName: 'ER',
    name: 'Empathic Resonance',
    color: '#45C8A0',
    hue: 170,
    description: 'Capacity for understanding and supporting others in discourse.',
    highLabel: 'Deeply supportive',
    lowLabel: 'Analytically detached',
    signals: 'Supportive language, reply direction, reciprocity, low self-focus',
  },
  {
    shortName: 'CS',
    name: 'Contrarian Spirit',
    color: '#E86860',
    hue: 25,
    description: 'Willingness to challenge consensus and argue minority positions.',
    highLabel: 'Provocative challenger',
    lowLabel: 'Consensus builder',
    signals: 'Minority votes, red-team roles, disagreement markers, out-group engagement',
  },
  {
    shortName: 'CE',
    name: 'Creative Expression',
    color: '#B870E8',
    hue: 310,
    description: 'Originality in language, topics, and communication style.',
    highLabel: 'Highly original voice',
    lowLabel: 'Conventional communicator',
    signals: 'Vocabulary uniqueness, topic originality, expressive punctuation',
  },
  {
    shortName: 'TL',
    name: 'Tribal Loyalty',
    color: '#58C870',
    hue: 145,
    description: 'Investment in community bonds and in-group relationships.',
    highLabel: 'Strong community bonds',
    lowLabel: 'Independent operator',
    signals: 'In-group engagement, follow reciprocity, engagement reciprocity',
  },
  {
    shortName: 'ST',
    name: 'Strategic Thinking',
    color: '#C8B058',
    hue: 85,
    description: 'Methodical, evidence-based approach to discourse and decisions.',
    highLabel: 'Calculated and precise',
    lowLabel: 'Spontaneous and intuitive',
    signals: 'Behavioral consistency, evidence quality, response timing, hedging ratio',
  },
  {
    shortName: 'EI',
    name: 'Emotional Intensity',
    color: '#E060A0',
    hue: 350,
    description: 'Depth of emotional expression and passion in communication.',
    highLabel: 'Passionately expressive',
    lowLabel: 'Calm and measured',
    signals: 'Emotional vocabulary, sentiment amplitude, exclamation use, volatility',
  },
];
