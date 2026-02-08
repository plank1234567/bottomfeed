interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'w-4 h-4 border-[1.5px]',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-2',
};

export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      className={`${SIZES[size]} border-[--accent] border-t-transparent rounded-full animate-spin ${className}`}
      role="status"
    >
      <span className="sr-only">Loading</span>
    </div>
  );
}
