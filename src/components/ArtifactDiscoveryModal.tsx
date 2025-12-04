import { useState, useEffect } from 'react';
import { type Artifact } from '@/lib/items';
import { type Item } from '@/lib/player';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, X } from 'lucide-react';

interface ArtifactDiscoveryModalProps {
  artifact: Artifact | null;
  isOpen: boolean;
  onClose: () => void;
  onPickUp: (item: Item) => void;
  hasInventorySpace: boolean;
}

// Convert Artifact to Item format
export function artifactToItem(artifact: Artifact): Item {
  return {
    id: `artifact-${artifact.name.toLowerCase().replace(/\s+/g, '-')}`,
    name: artifact.name,
    description: artifact.description,
    type: 'artifact',
    rarity: artifact.class === 'major' ? 'legendary' : 'rare',
    quantity: 1,
  };
}

export function ArtifactDiscoveryModal({
  artifact,
  isOpen,
  onClose,
  onPickUp,
  hasInventorySpace,
}: ArtifactDiscoveryModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen && artifact) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, artifact]);

  if (!isOpen || !artifact) {
    return null;
  }

  const handlePickUp = () => {
    if (!hasInventorySpace) {
      return;
    }
    const item = artifactToItem(artifact);
    onPickUp(item);
    onClose();
  };

  const handleLeave = () => {
    onClose();
  };

  const isMajor = artifact.class === 'major';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleLeave}
      />
      
      {/* Modal */}
      <Card className="relative z-50 w-full max-w-md mx-4 border-2 shadow-2xl">
        <CardContent>
          {/* Header: Icon, Name, Close */}
          <div className="flex items-center gap-3 pb-2">
            {/* Icon - smaller, square with rounded corners */}
            <div className={`relative flex-shrink-0 ${isAnimating ? 'animate-pulse' : ''}`}>
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className={`h-6 w-6 ${isMajor ? 'text-yellow-500' : 'text-blue-500'}`} />
              </div>
            </div>
            
            {/* Name */}
            <div className="flex-1">
              <h3 className="text-xl font-bold">{artifact.name}</h3>
            </div>
            
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLeave}
              className="h-8 w-8 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 pb-4">
            <Badge
              variant={isMajor ? 'default' : 'secondary'}
              className={isMajor ? 'bg-yellow-500/20 text-yellow-600 border-yellow-500' : 'bg-blue-500/20 text-blue-600 border-blue-500'}
            >
              {isMajor ? 'Major Artifact' : 'Minor Artifact'}
            </Badge>
            <Badge variant="outline">
              Artifact
            </Badge>
          </div>

          {/* Description */}
          <CardDescription className="text-sm leading-relaxed">
            {artifact.description}
          </CardDescription>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-4">
            {!hasInventorySpace && (
              <p className="text-sm text-destructive text-center w-full">
                Inventory is full! Make room before picking up this artifact.
              </p>
            )}
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={handleLeave}
                className="flex-1"
              >
                Leave on Ground
              </Button>
              <Button
                onClick={handlePickUp}
                disabled={!hasInventorySpace}
                className={`flex-1 ${isMajor 
                  ? 'bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-500/50 disabled:cursor-not-allowed' 
                  : 'bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed'}`}
              >
                Pick Up
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

