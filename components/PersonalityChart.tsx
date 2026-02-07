'use client';

interface PersonalityDimension {
  label: string;
  value: number; // 0-1
}

interface PersonalityChartProps {
  personality: string;
}

// Simple keyword-based personality analysis
function analyzePersonality(text: string): PersonalityDimension[] {
  const lower = text.toLowerCase();

  const score = (keywords: string[], antiKeywords: string[] = []): number => {
    let s = 0.5; // neutral default
    for (const kw of keywords) {
      if (lower.includes(kw)) s = Math.min(s + 0.15, 1);
    }
    for (const kw of antiKeywords) {
      if (lower.includes(kw)) s = Math.max(s - 0.15, 0);
    }
    return s;
  };

  return [
    {
      label: 'Analytical',
      value: score(
        [
          'analy',
          'logic',
          'reason',
          'data',
          'research',
          'systematic',
          'methodical',
          'precise',
          'technical',
          'rigorous',
        ],
        ['creative', 'artis', 'imaginat', 'intuiti']
      ),
    },
    {
      label: 'Creative',
      value: score(
        [
          'creativ',
          'imaginat',
          'artis',
          'innovat',
          'original',
          'inventive',
          'vision',
          'expressive',
        ],
        ['rigid', 'systematic', 'strict']
      ),
    },
    {
      label: 'Formal',
      value: score(
        ['formal', 'profess', 'academic', 'scholarly', 'precise', 'structured', 'serious'],
        ['casual', 'relax', 'humor', 'playful', 'fun']
      ),
    },
    {
      label: 'Friendly',
      value: score(
        [
          'friend',
          'warm',
          'empath',
          'kind',
          'help',
          'support',
          'caring',
          'approachable',
          'cheerful',
        ],
        ['cold', 'distant', 'aloof']
      ),
    },
    {
      label: 'Verbose',
      value: score(
        ['detail', 'thorough', 'comprehensive', 'elaborate', 'in-depth', 'verbose', 'extensive'],
        ['concise', 'brief', 'terse', 'succinct', 'minimal']
      ),
    },
    {
      label: 'Humorous',
      value: score(
        ['humor', 'funny', 'wit', 'playful', 'joke', 'sarcas', 'lightheart', 'whimsical'],
        ['serious', 'grave', 'solemn', 'stern']
      ),
    },
  ];
}

export default function PersonalityChart({ personality }: PersonalityChartProps) {
  const dimensions = analyzePersonality(personality);
  const n = dimensions.length;
  const cx = 100;
  const cy = 100;
  const radius = 70;
  const levels = 4;

  // Calculate point positions for each dimension
  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * radius * value,
      y: cy + Math.sin(angle) * radius * value,
    };
  };

  // Generate grid lines
  const gridPaths = [];
  for (let level = 1; level <= levels; level++) {
    const r = level / levels;
    const points = Array.from({ length: n }, (_, i) => {
      const p = getPoint(i, r);
      return `${p.x},${p.y}`;
    });
    gridPaths.push(points.join(' '));
  }

  // Generate axis lines
  const axisLines = Array.from({ length: n }, (_, i) => {
    const p = getPoint(i, 1);
    return { x1: cx, y1: cy, x2: p.x, y2: p.y };
  });

  // Generate data polygon
  const dataPoints = dimensions.map((d, i) => {
    const p = getPoint(i, d.value);
    return `${p.x},${p.y}`;
  });

  // Label positions (slightly outside the chart)
  const labels = dimensions.map((d, i) => {
    const p = getPoint(i, 1.25);
    return { ...d, x: p.x, y: p.y };
  });

  return (
    <div className="flex justify-center">
      <svg
        viewBox="0 0 200 200"
        className="w-full max-w-[220px]"
        role="img"
        aria-label="Personality trait radar chart"
      >
        {/* Grid polygons */}
        {gridPaths.map((points, i) => (
          <polygon
            key={i}
            points={points}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.5"
          />
        ))}

        {/* Axis lines */}
        {axisLines.map((line, i) => (
          <line key={i} {...line} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        ))}

        {/* Data polygon fill */}
        <polygon
          points={dataPoints.join(' ')}
          fill="rgba(255, 107, 91, 0.15)"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {dimensions.map((d, i) => {
          const p = getPoint(i, d.value);
          return <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--accent)" />;
        })}

        {/* Labels */}
        {labels.map((label, i) => (
          <text
            key={i}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[--text-muted] text-[8px]"
          >
            {label.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
