import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, RefreshCw, Sparkles } from 'lucide-react';

interface VictoryScreenProps {
  isOpen: boolean;
  stats: {
    totalMoves: number;
    biomesDiscovered: number;
    itemsUsed: number;
    finalEntropy: number;
  };
  onRestart?: () => void;
}

export function VictoryScreen({ isOpen, stats, onRestart }: VictoryScreenProps) {
  if (!isOpen) return null;

  const entropyRating = stats.finalEntropy < 31 ? 'Stable' : stats.finalEntropy < 62 ? 'Shifting' : 'Chaotic';
  const entropyColor = stats.finalEntropy < 31 ? 'text-green-500' : stats.finalEntropy < 62 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Victory Card */}
      <Card className="relative z-50 w-full max-w-lg mx-4 border-2 border-yellow-500/50 shadow-2xl">
        <CardContent className="pt-8 pb-6 px-6">
          {/* Trophy Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-500/30 blur-xl rounded-full animate-pulse" />
              <div className="relative bg-yellow-500/20 p-6 rounded-full border-2 border-yellow-500">
                <Trophy className="h-16 w-16 text-yellow-500" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent">
              Victory!
            </h2>
            <p className="text-lg text-muted-foreground">
              You've reached the Gateway and escaped the dream
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-muted/50 rounded-lg p-3 border border-border">
              <div className="text-xs text-muted-foreground mb-1">Total Moves</div>
              <div className="text-2xl font-bold">{stats.totalMoves}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 border border-border">
              <div className="text-xs text-muted-foreground mb-1">Biomes Found</div>
              <div className="text-2xl font-bold">{stats.biomesDiscovered}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 border border-border">
              <div className="text-xs text-muted-foreground mb-1">Items Used</div>
              <div className="text-2xl font-bold">{stats.itemsUsed}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 border border-border">
              <div className="text-xs text-muted-foreground mb-1">Final Entropy</div>
              <div className={`text-2xl font-bold ${entropyColor}`}>
                {stats.finalEntropy}
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            <Badge variant="outline" className="border-yellow-500/50 text-yellow-600">
              <Sparkles className="h-3 w-3 mr-1" />
              Gateway Reached
            </Badge>
            <Badge variant="outline" className={entropyColor}>
              {entropyRating} Escape
            </Badge>
            {stats.totalMoves < 10 && (
              <Badge variant="outline" className="border-blue-500/50 text-blue-600">
                Speed Runner
              </Badge>
            )}
            {stats.finalEntropy < 31 && (
              <Badge variant="outline" className="border-green-500/50 text-green-600">
                Stable Exit
              </Badge>
            )}
          </div>

          {/* Actions */}
          {onRestart && (
            <Button
              onClick={onRestart}
              className="w-full gap-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700"
              size="lg"
            >
              <RefreshCw className="h-4 w-4" />
              Play Again
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
