import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Brain, Zap, CheckCircle, XCircle } from 'lucide-react';
import type { LLMActivity } from '@/lib/llm-player';
import { useEffect, useRef } from 'react';

interface LLMActivityDisplayProps {
  activities: LLMActivity[];
  isActive: boolean;
}

export function LLMActivityDisplay({ activities, isActive }: LLMActivityDisplayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new activities arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities]);

  if (!isActive) {
    return null;
  }

  const getActivityIcon = (type: LLMActivity['type']) => {
    switch (type) {
      case 'thinking':
        return <Brain className="h-4 w-4 text-blue-400 animate-pulse" />;
      case 'action':
        return <Zap className="h-4 w-4 text-yellow-400" />;
      case 'result':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-400" />;
    }
  };

  const getActivityColor = (type: LLMActivity['type']) => {
    switch (type) {
      case 'thinking':
        return 'border-blue-500/30 bg-blue-950/20';
      case 'action':
        return 'border-yellow-500/30 bg-yellow-950/20';
      case 'result':
        return 'border-green-500/30 bg-green-950/20';
      case 'error':
        return 'border-red-500/30 bg-red-950/20';
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <Card className="fixed bottom-4 left-4 z-40 bg-background/98 backdrop-blur-md border-2 shadow-lg">
      <div className="p-4 w-96">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            LLM Activity
          </h3>
          <Badge variant="outline" className="text-xs">
            {activities.length} events
          </Badge>
        </div>

        <ScrollArea className="h-64" ref={scrollRef}>
          <div className="space-y-2 pr-4">
            {activities.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                No activity yet
              </div>
            ) : (
              activities.map((activity) => (
                <div
                  key={activity.id}
                  className={`p-3 rounded-md border ${getActivityColor(activity.type)}`}
                >
                  <div className="flex items-start gap-2">
                    {getActivityIcon(activity.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <Badge variant="outline" className="text-xs capitalize">
                          {activity.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(activity.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm break-words">{activity.content}</p>
                      {activity.reasoning && activity.reasoning !== activity.content && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <p className="text-xs text-muted-foreground italic">
                            {activity.reasoning}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
}
