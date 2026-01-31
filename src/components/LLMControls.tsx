import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Bot, RefreshCw } from 'lucide-react';
import {
  fetchAvailableModels,
  queryLLM,
  buildGameState,
  type LLMAction,
  type GameState,
} from '@/lib/llmController';

interface LLMControlsProps {
  gameState: GameState;
  onAction: (action: LLMAction) => void;
  baseUrl?: string;
  hasWon?: boolean;
  hasLost?: boolean;
}

export function LLMControls({ gameState, onAction, baseUrl = 'http://localhost:1234/v1', hasWon = false, hasLost = false }: LLMControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastThinking, setLastThinking] = useState<string>('');
  const [error, setError] = useState<string>('');
  const intervalRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);

  const gameEnded = hasWon || hasLost;

  // Fetch available models on mount
  useEffect(() => {
    fetchAvailableModels(baseUrl).then(m => {
      setModels(m);
      if (m.length > 0 && !selectedModel) {
        setSelectedModel(m[0]);
      }
    });
  }, [baseUrl]);

  // Stop playing when game ends
  useEffect(() => {
    if (gameEnded && isPlaying) {
      setIsPlaying(false);
      setIsLoading(false);
      isProcessingRef.current = false;
    }
  }, [gameEnded, isPlaying]);

  const executeTurn = useCallback(async () => {
    if (isProcessingRef.current || !selectedModel || gameEnded) return;
    isProcessingRef.current = true;
    setIsLoading(true);
    setError('');

    try {
      const response = await queryLLM(baseUrl, selectedModel, gameState, 500);
      setLastThinking(response.thinking || '');
      onAction(response.action);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'LLM request failed');
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
    }
  }, [baseUrl, selectedModel, gameState, onAction, gameEnded]);

  // Auto-play loop
  useEffect(() => {
    if (isPlaying && selectedModel) {
      // Execute immediately, then set interval
      executeTurn();
      intervalRef.current = window.setInterval(() => {
        executeTurn();
      }, 3000); // 3 second delay between turns
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, selectedModel, executeTurn]);

  const handlePlayPause = () => {
    if (gameEnded) return;
    if (!selectedModel) {
      setError('Select a model first');
      return;
    }
    setIsPlaying(!isPlaying);
  };

  const handleRefreshModels = async () => {
    const m = await fetchAvailableModels(baseUrl);
    setModels(m);
    if (m.length > 0 && !selectedModel) {
      setSelectedModel(m[0]);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 min-w-[280px]">
      <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-semibold">LLM Player</span>
        </div>

        {/* Model Selector */}
        <div className="flex gap-2 mb-2">
          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            disabled={isPlaying || gameEnded}
            className="flex-1 h-9 rounded-md border bg-background px-2 text-sm"
          >
            {models.length === 0 && <option value="">No models found</option>}
            {models.map(m => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefreshModels}
            disabled={isPlaying || gameEnded}
            title="Refresh models"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Play/Pause Controls */}
        <div className="flex gap-2">
          <Button
            onClick={handlePlayPause}
            disabled={!selectedModel || isLoading || gameEnded}
            className="flex-1 gap-2"
            variant={isPlaying ? 'destructive' : 'default'}
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Play
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={executeTurn}
            disabled={!selectedModel || isLoading || isPlaying || gameEnded}
            title="Single step"
          >
            Step
          </Button>
        </div>

        {/* Status */}
        {gameEnded && (
          <div className="mt-2 text-xs font-semibold text-center">
            {hasWon && <span className="text-yellow-500">Victory! Game Ended</span>}
            {hasLost && <span className="text-red-500">Defeat! Game Ended</span>}
          </div>
        )}
        {!gameEnded && isLoading && (
          <div className="mt-2 text-xs text-muted-foreground animate-pulse">Thinking...</div>
        )}
        {error && <div className="mt-2 text-xs text-red-500">{error}</div>}
      </div>

      {/* LLM Thinking Display */}
      {lastThinking && (
        <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">LLM Thinking:</div>
          <div className="text-sm italic">{lastThinking}</div>
        </div>
      )}
    </div>
  );
}

export { buildGameState };
