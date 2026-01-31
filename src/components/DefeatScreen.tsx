import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skull, RefreshCw, AlertTriangle } from 'lucide-react';

interface DefeatScreenProps {
  isOpen: boolean;
  reason: 'max_entropy' | 'dead_end' | 'no_moves';
  stats: {
    totalMoves: number;
    biomesDiscovered: number;
    itemsUsed: number;
    finalEntropy: number;
  };
  onRestart?: () => void;
}

export function DefeatScreen({ isOpen, reason, stats, onRestart }: DefeatScreenProps) {
  if (!isOpen) return null;

  const defeatMessages = {
    max_entropy: {
      title: 'Consumed by Chaos',
      description: 'The dream collapsed into pure entropy, scattering your consciousness',
      icon: AlertTriangle,
      color: 'text-red-500',
      bgColor: 'border-red-500/50',
      bgGradient: 'to-red-500/10',
    },
    dead_end: {
      title: 'Trapped Forever',
      description: 'You\'re stuck in a biome with no escape routes',
      icon: Skull,
      color: 'text-purple-500',
      bgColor: 'border-purple-500/50',
      bgGradient: 'to-purple-500/10',
    },
    no_moves: {
      title: 'No Path Forward',
      description: 'All possible transitions have been sealed off',
      icon: Skull,
      color: 'text-orange-500',
      bgColor: 'border-orange-500/50',
      bgGradient: 'to-orange-500/10',
    },
  };

  const message = defeatMessages[reason];
  const Icon = message.icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Defeat Card */}
      <Card className={`relative z-50 w-full max-w-lg mx-4 border-2 ${message.bgColor} shadow-2xl ${message.bgGradient}`}>
        <CardContent className="pt-8 pb-6 px-6">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className={`absolute inset-0 ${message.color} opacity-30 blur-xl rounded-full animate-pulse`} />
              <div className={`relative ${message.color} bg-opacity-20 p-6 rounded-full border-2 ${message.bgColor}`}>
                <Icon className={`h-16 w-16 ${message.color}`} />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h2 className={`text-3xl font-bold mb-2 ${message.color}`}>
              {message.title}
            </h2>
            <p className="text-lg text-muted-foreground">
              {message.description}
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
              <div className={`text-2xl font-bold ${message.color}`}>
                {stats.finalEntropy}
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            <Badge variant="outline" className={`${message.bgColor} ${message.color}`}>
              {reason === 'max_entropy' && 'Entropy Overload'}
              {reason === 'dead_end' && 'Dead End'}
              {reason === 'no_moves' && 'Stuck'}
            </Badge>
            {stats.biomesDiscovered >= 5 && (
              <Badge variant="outline" className="border-blue-500/50 text-blue-600">
                Explorer
              </Badge>
            )}
            {stats.totalMoves < 10 && (
              <Badge variant="outline" className="border-gray-500/50 text-gray-600">
                Quick Death
              </Badge>
            )}
          </div>

          {/* Tip */}
          <div className="bg-muted/30 rounded-lg p-3 mb-4 border border-border/50">
            <div className="text-sm text-muted-foreground">
              <strong>Tip:</strong>{' '}
              {reason === 'max_entropy' && 'Use Entropy Buffer items to reduce entropy gain. Keep it below 100!'}
              {reason === 'dead_end' && 'Some biomes have no exits. Avoid them or use items to create new paths.'}
              {reason === 'no_moves' && 'Explore carefully and keep artifacts that create new transitions.'}
            </div>
          </div>

          {/* Actions */}
          {onRestart && (
            <Button
              onClick={onRestart}
              className={`w-full gap-2 bg-gradient-to-r from-${message.color.replace('text-', '')} to-${message.color.replace('text-', '')}/80`}
              size="lg"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
