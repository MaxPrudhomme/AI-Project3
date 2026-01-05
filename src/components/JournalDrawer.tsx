import { useState } from 'react';
import { Drawer, DrawerContent, DrawerClose, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, BookOpen, ArrowRight, Package, Zap, Bot } from 'lucide-react';
import { journalManager, type JournalEntry, type JournalFilter } from '@/lib/journal';
import { cn } from '@/lib/utils';

interface JournalDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const rarityColors = {
  common: 'bg-gray-500',
  uncommon: 'bg-green-500',
  rare: 'bg-blue-500',
  epic: 'bg-purple-500',
  legendary: 'bg-yellow-500',
};

const rarityBorderColors = {
  common: 'border-gray-400',
  uncommon: 'border-green-400',
  rare: 'border-blue-400',
  epic: 'border-purple-400',
  legendary: 'border-yellow-400',
};

function JournalEntryCard({ entry }: { entry: JournalEntry }) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (entry.type === 'node_change') {
    return (
      <Card className="p-4 border-border/50 hover:border-border transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-semibold">Node Change</span>
              <span className="text-xs text-muted-foreground ml-auto">{formatTime(entry.timestamp)}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{entry.fromBiome}</Badge>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <Badge variant="default">{entry.toBiome}</Badge>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Odds:</span>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs",
                  entry.modifiedByItem && "border-blue-500 text-blue-600 bg-blue-500/20"
                )}
              >
                {entry.odds.toFixed(1)}%
                {entry.modifiedByItem && (
                  <span className="ml-1" title="Modified by item">✨</span>
                )}
              </Badge>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (entry.type === 'item_found') {
    return (
      <Card className="p-4 border-border/50 hover:border-border transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-semibold">Item Found</span>
              <span className="text-xs text-muted-foreground ml-auto">{formatTime(entry.timestamp)}</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Badge 
                variant="outline"
                className={cn(
                  rarityBorderColors[entry.itemRarity],
                  "border-2"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full mr-2", rarityColors[entry.itemRarity])} />
                {entry.itemName}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{entry.itemDescription}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (entry.type === 'item_used') {
    return (
      <Card className="p-4 border-border/50 hover:border-border transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-semibold">Item Used</span>
              <span className="text-xs text-muted-foreground ml-auto">{formatTime(entry.timestamp)}</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{entry.itemName}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{entry.itemDescription}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (entry.type === 'llm_decision') {
    return (
      <Card className="p-4 border-blue-500/50 hover:border-blue-500 transition-colors bg-blue-500/5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-blue-600">AI Decision</span>
              <span className="text-xs text-muted-foreground ml-auto">{formatTime(entry.timestamp)}</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="border-blue-400">
                {entry.action === 'move' ? 'Move' : `Use Item: ${entry.itemName || 'Unknown'}`}
              </Badge>
            </div>
            <p className="text-sm text-foreground/90 italic">"{entry.reasoning}"</p>
            <p className="text-xs text-muted-foreground mt-1">Model: {entry.modelId}</p>
          </div>
        </div>
      </Card>
    );
  }

  return null;
}

export function JournalDrawer({ isOpen, onOpenChange }: JournalDrawerProps) {
  const [filter, setFilter] = useState<JournalFilter>('all');
  
  // Get entries - will be fresh on each render when drawer opens
  const entries = journalManager.getEntries(filter);

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="h-[100vh] rounded-none border-0 shadow-none border-transparent bg-transparent p-0 gap-0 data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4">
        {/* Floating drawer panel with rounded top corners and margins */}
        <div className="absolute inset-x-4 top-4 bottom-0 rounded-t-2xl border-t border-l border-r border-border bg-background/98 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <DrawerHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                <DrawerTitle>Journal</DrawerTitle>
                <Badge variant="secondary" className="ml-2">
                  {journalManager.getEntryCount(filter)} entries
                </Badge>
              </div>
              <DrawerClose asChild>
                <button 
                  className="rounded-md p-1.5 hover:bg-muted transition-colors"
                  aria-label="Close journal"
                >
                  <X className="h-5 w-5" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          {/* Content area with filters and scrollable entries */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left sidebar with filters */}
            <div className="w-48 border-r border-border p-4 flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Filters</h3>
              <Button
                variant={filter === 'all' ? 'default' : 'ghost'}
                className="justify-start"
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button
                variant={filter === 'nodes' ? 'default' : 'ghost'}
                className="justify-start"
                onClick={() => setFilter('nodes')}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Nodes
              </Button>
              <Button
                variant={filter === 'items' ? 'default' : 'ghost'}
                className="justify-start"
                onClick={() => setFilter('items')}
              >
                <Package className="h-4 w-4 mr-2" />
                Items
              </Button>
              <Button
                variant={filter === 'llm' ? 'default' : 'ghost'}
                className="justify-start"
                onClick={() => setFilter('llm')}
              >
                <Bot className="h-4 w-4 mr-2" />
                AI Decisions
              </Button>
            </div>

            {/* Scrollable entries area */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {entries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-sm text-muted-foreground">No journal entries yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your actions will be recorded here
                    </p>
                  </div>
                ) : (
                  entries.map((entry) => (
                    <JournalEntryCard key={entry.id} entry={entry} />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

