import { type Player, type Item } from '@/lib/player';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Drawer, DrawerContent, DrawerClose } from '@/components/ui/drawer';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { X, Package, Zap, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface InventoryDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  player: Player;
  onInventoryChange?: () => void;
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

export function InventoryDrawer({ isOpen, onOpenChange, player, onInventoryChange }: InventoryDrawerProps) {
  const [draggedSlot, setDraggedSlot] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Force re-render when drawer opens or inventory changes
  useEffect(() => {
    if (isOpen) {
      setRefreshKey(prev => prev + 1);
    }
  }, [isOpen]);

  const inventory = player.getInventory();
  const currentPosition = player.getPosition();
  const itemCount = player.getItemCount();

  const handleDragStart = (slotIndex: number) => {
    if (inventory[slotIndex]) {
      setDraggedSlot(slotIndex);
    }
  };

  const handleDragEnd = () => {
    setDraggedSlot(null);
  };

  const handleDrop = (targetSlot: number) => {
    if (draggedSlot !== null && draggedSlot !== targetSlot) {
      player.moveItem(draggedSlot, targetSlot);
      setDraggedSlot(null);
      setRefreshKey(prev => prev + 1);
      onInventoryChange?.();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropItem = (slotIndex: number) => {
    const item = inventory[slotIndex];
    if (item) {
      player.removeItem(slotIndex, item.quantity);
      setRefreshKey(prev => prev + 1);
      onInventoryChange?.();
      toast.success(`Dropped ${item.name}`, {
        description: 'The item has been left on the ground.',
      });
    }
  };

  const handleUseItem = (slotIndex: number) => {
    const item = inventory[slotIndex];
    if (item) {
      // For now, just delete the item (basic "get rid of" function)
      // TODO: Call actual effect function when implemented
      player.removeItem(slotIndex, item.quantity);
      setRefreshKey(prev => prev + 1);
      onInventoryChange?.();
      toast.success(`Used ${item.name}`, {
        description: 'The item has been consumed.',
      });
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="w-full h-screen rounded-none right-0 left-auto border-0 bg-transparent p-0 gap-0 data-[state=open]:slide-in-from-right-4 data-[state=closed]:slide-out-to-right-4">
        {/* Floating drawer panel */}
        <div className="absolute inset-y-4 right-4 w-96 rounded-xl border border-border bg-background/98 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden">
          {/* Header with close button */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5" />
                Inventory
              </h2>
              <p className="text-sm text-muted-foreground">
                {itemCount} / {inventory.length} items
              </p>
            </div>
            <DrawerClose asChild>
              <button 
                className="rounded-md p-1.5 hover:bg-muted transition-colors"
                aria-label="Close inventory"
              >
                <X className="h-5 w-5" />
              </button>
            </DrawerClose>
          </div>

          {/* Scrollable content */}
          <ScrollArea className="flex-1 overflow-hidden">
            <div className="space-y-4 p-4">
              {/* Current Location */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Current Location</h3>
                <div className="p-3 rounded-md bg-muted/50 border border-border">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{currentPosition.biome}</Badge>
                    <Badge variant="outline">{currentPosition.variant}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {currentPosition.discovered ? 'Discovered' : 'Undiscovered'}
                  </p>
                </div>
              </div>

              {/* Inventory Grid */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Items</h3>
                <div className="grid grid-cols-3 gap-2" key={refreshKey}>
                  {inventory.map((item, index) => (
                    <ContextMenu key={index}>
                      <ContextMenuTrigger disabled={!item} asChild>
                        <div
                          draggable={!!item}
                          onDragStart={() => handleDragStart(index)}
                          onDragEnd={handleDragEnd}
                          onDrop={() => handleDrop(index)}
                          onDragOver={handleDragOver}
                          className={`
                            aspect-square rounded-lg border-2 border-dashed border-border
                            flex flex-col items-center justify-center p-2
                            transition-all cursor-pointer
                            ${item 
                              ? `border-solid ${rarityBorderColors[item.rarity]} bg-muted/50 hover:bg-muted/70` 
                              : 'hover:border-border hover:bg-muted/20'
                            }
                            ${draggedSlot === index ? 'opacity-50 scale-95' : ''}
                          `}
                          title={item ? `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''} - Right-click for options` : 'Empty slot'}
                        >
                          {item ? (
                            <>
                              <div className={`
                                w-8 h-8 rounded-full ${rarityColors[item.rarity]}
                                flex items-center justify-center text-white text-xs font-bold
                                mb-1
                              `}>
                                {item.name.charAt(0).toUpperCase()}
                              </div>
                              {item.quantity > 1 && (
                                <span className="text-xs font-semibold text-foreground">
                                  {item.quantity}
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground text-center truncate w-full">
                                {item.name}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Empty</span>
                          )}
                        </div>
                      </ContextMenuTrigger>
                      {item && (
                        <ContextMenuContent>
                          <ContextMenuItem onClick={() => handleUseItem(index)}>
                            <Zap className="h-4 w-4" />
                            Use
                          </ContextMenuItem>
                          <ContextMenuItem 
                            onClick={() => handleDropItem(index)}
                            variant="destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Drop on Ground
                          </ContextMenuItem>
                        </ContextMenuContent>
                      )}
                    </ContextMenu>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

