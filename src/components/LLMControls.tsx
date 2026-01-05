import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  llmController, 
  fetchAvailableModels, 
  type LLMModel, 
  type LLMStatus, 
  type LLMDecision,
  type GameContext 
} from '@/lib/llm';
import { Bot, Play, Square, RefreshCw, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LLMControlsProps {
  getGameContext: () => GameContext;
  executeAction: (decision: LLMDecision) => Promise<void>;
  onDecision: (decision: LLMDecision) => void;
}

export function LLMControls({ getGameContext, executeAction, onDecision }: LLMControlsProps) {
  const [models, setModels] = useState<LLMModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [status, setStatus] = useState<LLMStatus>({ isPlaying: false, isThinking: false });
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Shared model loading function
  const loadModelsAsync = useCallback(async (isInitial: boolean = false) => {
    setIsLoadingModels(true);
    setConnectionError(null);
    try {
      const fetchedModels = await fetchAvailableModels();
      if (fetchedModels.length === 0) {
        setConnectionError('No models found. Is LM Studio running on port 1234?');
      } else {
        setModels(fetchedModels);
        // Only auto-select on initial load
        if (isInitial && fetchedModels.length > 0) {
          setSelectedModel(fetchedModels[0].id);
          llmController.setModel(fetchedModels[0].id);
        }
      }
    } catch {
      setConnectionError('Cannot connect to LM Studio. Make sure it\'s running on localhost:1234');
    }
    setIsLoadingModels(false);
  }, []);

  // Load models on mount - this pattern is intentional for initialization
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadModelsAsync(true);
  }, [loadModelsAsync]);

  // Set up callbacks
  useEffect(() => {
    llmController.setOnStatusChange(setStatus);
    llmController.setOnDecision(onDecision);
  }, [onDecision]);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = e.target.value;
    setSelectedModel(modelId);
    llmController.setModel(modelId);
  };

  const handleStart = () => {
    if (!selectedModel) return;
    llmController.start(getGameContext, executeAction);
  };

  const handleStop = () => {
    llmController.stop();
  };

  return (
    <Card className="bg-background/95 backdrop-blur-sm border shadow-lg overflow-hidden">
      {/* Header - always visible */}
      <div 
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-500" />
          <span className="font-semibold">AI Auto-Play</span>
          {status.isPlaying && (
            <Badge variant="default" className="bg-green-500 text-white animate-pulse">
              Active
            </Badge>
          )}
          {status.isThinking && (
            <Badge variant="outline" className="border-blue-400 text-blue-500">
              <Brain className="h-3 w-3 mr-1 animate-pulse" />
              Thinking...
            </Badge>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Expandable content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          {/* Connection Error */}
          {connectionError && (
            <div className="text-sm text-red-500 bg-red-500/10 p-2 rounded-md">
              {connectionError}
            </div>
          )}

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Model</label>
            <div className="flex gap-2">
              <select
                value={selectedModel}
                onChange={handleModelChange}
                disabled={status.isPlaying || isLoadingModels}
                className={cn(
                  "flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-ring",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {models.length === 0 ? (
                  <option value="">No models available</option>
                ) : (
                  models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))
                )}
              </select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => loadModelsAsync(false)}
                disabled={isLoadingModels}
                title="Refresh models"
              >
                <RefreshCw className={cn("h-4 w-4", isLoadingModels && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {!status.isPlaying ? (
              <Button
                onClick={handleStart}
                disabled={!selectedModel || isLoadingModels || models.length === 0}
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
              >
                <Play className="h-4 w-4" />
                Start Auto-Play
              </Button>
            ) : (
              <Button
                onClick={handleStop}
                variant="destructive"
                className="flex-1 gap-2"
              >
                <Square className="h-4 w-4" />
                Stop
              </Button>
            )}
          </div>

          {/* Current Thought */}
          {status.lastThought && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">AI Reasoning</label>
              <ScrollArea className="h-20 rounded-md border border-border p-3 bg-muted/30">
                <p className="text-sm italic text-foreground/80">
                  "{status.lastThought}"
                </p>
              </ScrollArea>
            </div>
          )}

          {/* Status Info */}
          <div className="text-xs text-muted-foreground">
            <p>LM Studio endpoint: localhost:1234</p>
            {selectedModel && <p>Selected: {selectedModel}</p>}
          </div>
        </div>
      )}
    </Card>
  );
}
