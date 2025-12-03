import { type State } from '@/lib/automaton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Drawer, DrawerContent, DrawerClose } from '@/components/ui/drawer';
import { X } from 'lucide-react';

interface NodeDetailsDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  node: State | null;
} 

export function NodeDetailsDrawer({ isOpen, onOpenChange, node }: NodeDetailsDrawerProps) {
  if (!node) return null;

  const hasTransitions = node.transitions.length > 0;
  
  // Get display name (censored if undiscovered)
  const displayBiome = node.discovered ? node.biome : 'Unknown Biome';
  const displayVariant = node.discovered ? node.variant : 'Unknown Variant';
  const hasSpecialElement = node.specialElement !== null;
  const displaySpecialElement = node.discovered && hasSpecialElement ? node.specialElement : (hasSpecialElement ? '?' : null);

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange} direction="left">
      <DrawerContent className="w-full h-screen rounded-none left-0 right-auto border-0 bg-transparent p-0 gap-0 data-[state=open]:slide-in-from-left-4 data-[state=closed]:slide-out-to-left-4">
        {/* Floating drawer panel */}
        <div className="absolute inset-y-4 left-4 w-96 rounded-xl border border-border bg-background/98 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden">
          {/* Header with close button */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{displayBiome}</h2>
              <p className="text-sm text-muted-foreground">Node Details</p>
            </div>
            <DrawerClose asChild>
              <button 
                className="rounded-md p-1.5 hover:bg-muted transition-colors"
                aria-label="Close node details"
              >
                <X className="h-5 w-5" />
              </button>
            </DrawerClose>
          </div>

          {/* Scrollable content */}
          <ScrollArea className="flex-1 overflow-hidden">
            <div className="space-y-4 p-4">
              {/* Biome & Variant */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Information</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Biome:</span>
                  <Badge variant="secondary">{displayBiome}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Variant:</span>
                  <Badge variant="outline">{displayVariant}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant={node.discovered ? 'default' : 'secondary'}>
                    {node.discovered ? 'Discovered' : 'Undiscovered'}
                  </Badge>
                </div>
                {hasSpecialElement && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Special Element:</span>
                    <Badge variant={node.discovered ? 'default' : 'secondary'} className="bg-white text-black border-2 border-black">
                      {displaySpecialElement}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Connected Nodes */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Connected Nodes {hasTransitions && `(${node.transitions.length})`}
                </h3>
                {hasTransitions ? (
                  <div className="space-y-2">
                    {node.transitions.map((transition, index) => {
                      // Only show odds if the target node is discovered
                      const showOdds = transition.to.discovered;
                      const displayTargetBiome = transition.to.discovered ? transition.to.biome : 'Unknown Biome';
                      
                      return (
                        <div key={index} className="p-2 rounded-md bg-muted/50 border border-border/50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">→</span>
                              <span className="text-sm font-medium">{displayTargetBiome}</span>
                            </div>
                            {showOdds && (
                              <Badge variant="outline" className="text-xs">
                                {(transition.weight * 100).toFixed(1)}%
                              </Badge>
                            )}
                          </div>
                          {transition.to.discovered && (
                            <p className="text-xs text-muted-foreground mt-1">Discovered</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No connected nodes</p>
                )}
              </div>

              {/* Action History */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Action History</h3>
                <div className="space-y-2 p-2 rounded-md bg-muted/30 border border-dashed border-border min-h-[100px]">
                  <p className="text-sm text-muted-foreground">No actions recorded yet</p>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
