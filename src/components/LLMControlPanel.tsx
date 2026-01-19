import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Play, Pause, Square, Bot, Settings } from 'lucide-react';
import { useState } from 'react';
import type { LLMPlayerState } from '@/lib/llm-player';
import { DEFAULT_LLM_CONFIGS } from '@/lib/llm-service';

interface LLMControlPanelProps {
  state: LLMPlayerState;
  onStart: (config: { apiUrl: string; model: string }) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function LLMControlPanel({
  state,
  onStart,
  onPause,
  onResume,
  onStop,
}: LLMControlPanelProps) {
  const [provider, setProvider] = useState<'ollama' | 'lmstudio' | 'custom'>('ollama');
  const [apiUrl, setApiUrl] = useState(DEFAULT_LLM_CONFIGS.ollama.apiUrl);
  const [model, setModel] = useState('llama3.2:3b');
  const [customModel, setCustomModel] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const handleProviderChange = (value: 'ollama' | 'lmstudio' | 'custom') => {
    setProvider(value);
    if (value === 'ollama') {
      setApiUrl(DEFAULT_LLM_CONFIGS.ollama.apiUrl);
      setModel('llama3.2:3b');
    } else if (value === 'lmstudio') {
      setApiUrl(DEFAULT_LLM_CONFIGS.lmstudio.apiUrl);
      setModel(''); // LM Studio uses loaded model
    } else {
      setApiUrl(DEFAULT_LLM_CONFIGS.custom.apiUrl);
    }
  };

  const handleStart = () => {
    const finalModel = provider === 'custom' && customModel ? customModel : model;
    onStart({ apiUrl, model: finalModel });
  };

  const getStateColor = () => {
    switch (state) {
      case 'running':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStateText = () => {
    switch (state) {
      case 'running':
        return 'Running';
      case 'paused':
        return 'Paused';
      case 'error':
        return 'Error';
      default:
        return 'Idle';
    }
  };

  return (
    <Card className="fixed top-4 right-4 z-40 bg-background/98 backdrop-blur-md border-2 shadow-lg">
      <div className="p-4 space-y-4 w-80">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">LLM Player</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStateColor()}>{getStateText()}</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && state === 'idle' && (
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-2">
              <label className="text-sm font-medium">Provider</label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ollama">Ollama</SelectItem>
                  <SelectItem value="lmstudio">LM Studio</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">API URL</label>
              <Input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:11434/v1"
                className="font-mono text-xs"
              />
            </div>

            {provider === 'ollama' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Model</label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_LLM_CONFIGS.ollama.models.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(provider === 'lmstudio' || provider === 'custom') && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Model Name</label>
                <Input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder={
                    provider === 'lmstudio'
                      ? 'Leave empty for loaded model'
                      : 'Enter model name'
                  }
                  className="font-mono text-xs"
                />
              </div>
            )}
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-2">
          {state === 'idle' && (
            <Button onClick={handleStart} className="flex-1 gap-2">
              <Play className="h-4 w-4" />
              Start
            </Button>
          )}

          {state === 'running' && (
            <>
              <Button onClick={onPause} variant="secondary" className="flex-1 gap-2">
                <Pause className="h-4 w-4" />
                Pause
              </Button>
              <Button onClick={onStop} variant="destructive" className="flex-1 gap-2">
                <Square className="h-4 w-4" />
                Stop
              </Button>
            </>
          )}

          {state === 'paused' && (
            <>
              <Button onClick={onResume} className="flex-1 gap-2">
                <Play className="h-4 w-4" />
                Resume
              </Button>
              <Button onClick={onStop} variant="destructive" className="flex-1 gap-2">
                <Square className="h-4 w-4" />
                Stop
              </Button>
            </>
          )}

          {state === 'error' && (
            <Button onClick={onStop} variant="destructive" className="flex-1 gap-2">
              <Square className="h-4 w-4" />
              Reset
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
