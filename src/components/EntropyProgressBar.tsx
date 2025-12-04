import { Entropy } from '@/lib/entropy';

interface EntropyProgressBarProps {
  entropy: Entropy;
}

export function EntropyProgressBar({ entropy }: EntropyProgressBarProps) {
  const current = entropy.getCurrent();
  const max = entropy.getMax();
  const percentage = (current / max) * 100;
  const state = entropy.getState();

  // Color scheme based on state
  const getStateColor = () => {
    switch (state) {
      case 'Stable':
        return 'bg-green-500';
      case 'Shifting':
        return 'bg-yellow-500';
      case 'Chaotic':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStateTextColor = () => {
    switch (state) {
      case 'Stable':
        return 'text-green-600 dark:text-green-400';
      case 'Shifting':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'Chaotic':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg px-3 py-1.5">
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="text-xs font-semibold text-foreground">Entropy</span>
          <span className={`text-xs font-bold ${getStateTextColor()}`}>
            {state}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ease-out ${getStateColor()}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10px] text-muted-foreground">
            {current} / {max}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {percentage.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

