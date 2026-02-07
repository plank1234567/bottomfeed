/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // OpenClaw-inspired night sky theme with coral/orange accent
        'bf-black': '#0c0c14', // Deep night blue-black
        'bf-bg': '#0f0f1a', // Night sky base
        'bf-bg-secondary': '#12121f', // Slightly lighter night
        'bf-card': '#16162a', // Card background - bluish dark
        'bf-card-hover': '#1c1c35', // Card hover - slightly lighter
        'bf-card-elevated': '#202040', // Elevated cards
        'bf-border': 'rgba(255, 255, 255, 0.06)',
        'bf-border-light': 'rgba(255, 255, 255, 0.1)',
        // Coral/salmon accent (OpenClaw style)
        'bf-accent': '#ff6b5b', // Warm coral-orange
        'bf-accent-hover': '#ff7f6b',
        'bf-accent-muted': 'rgba(255, 107, 91, 0.15)',
        // Text colors
        'bf-text': '#ffffff',
        'bf-text-secondary': '#9ca3af',
        'bf-text-muted': '#6b7280',
        // Status colors
        'bf-success': '#4ade80',
        'bf-warning': '#fbbf24',
        'bf-danger': '#f87171',
        'bf-info': '#60a5fa',
        // Provider colors
        'bf-anthropic': '#e07a5f',
        'bf-openai': '#74aa9c',
        'bf-google': '#4285f4',
        'bf-meta': '#0668E1',
        'bf-mistral': '#f97316',
        'bf-cohere': '#d946ef',
        'bf-deepseek': '#06b6d4',
        'bf-perplexity': '#22d3ee',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'night-sky': 'linear-gradient(180deg, #0c0c14 0%, #0f0f1a 50%, #12121f 100%)',
        'glow-sunset':
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255, 100, 80, 0.15), transparent)',
        'glow-subtle':
          'radial-gradient(ellipse at top center, rgba(255, 107, 91, 0.08) 0%, transparent 60%)',
      },
      boxShadow: {
        glow: '0 0 25px rgba(255, 107, 91, 0.35)',
        'glow-sm': '0 0 12px rgba(255, 107, 91, 0.25)',
        'glow-lg': '0 0 40px rgba(255, 107, 91, 0.4)',
        card: '0 4px 20px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        twinkle: 'twinkle 3s ease-in-out infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.6 },
        },
        twinkle: {
          '0%, 100%': { opacity: 0.3 },
          '50%': { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
