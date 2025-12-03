import { useState, useMemo, useCallback } from 'react';
import { Automaton, type State } from '@/lib/automaton';
import { Player } from '@/lib/player';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AutomatonGraph } from './AutomatonGraph';
import { Button } from '@/components/ui/button';

export function AutomatonVisualizer() {
  const [automaton] = useState<Automaton>(() => {
    const auto = Automaton.createRandom();
    const states = auto.getStates();
    
    // Initialize player with random starting location
    const randomState = states[Math.floor(Math.random() * states.length)];
    randomState.discovered = true;
    
    return auto;
  });

  const [player] = useState<Player>(() => {
    const states = automaton.getStates();
    const discoveredState = states.find(s => s.discovered);
    if (!discoveredState) {
      // Fallback: use first state if somehow none are discovered
      const firstState = states[0];
      firstState.discovered = true;
      return new Player(firstState);
    }
    return new Player(discoveredState);
  });

  const [currentPosition, setCurrentPosition] = useState<State>(player.getPosition());
  const [isMoving, setIsMoving] = useState(false);

  const handleMove = useCallback(() => {
    if (isMoving) return;
    
    setIsMoving(true);
    try {
      const previousPosition = currentPosition;
      const newPosition = player.move();
      
      // Mark the new biome as discovered
      const states = automaton.getStates();
      const newState = states.find(s => s.biome === newPosition.biome);
      if (newState) {
        newState.discovered = true;
      }
      
      setCurrentPosition(newPosition);
      
      // Reset moving state after animation duration
      setTimeout(() => {
        setIsMoving(false);
      }, 1000);
    } catch (error) {
      console.error('Move failed:', error);
      setIsMoving(false);
    }
  }, [player, currentPosition, isMoving, automaton]);

  const states = automaton.getStates();

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <Tabs defaultValue="graph" className="w-full h-full">
        <TabsList className="fixed top-4 right-4 z-50">
          <TabsTrigger value="cards">Card View</TabsTrigger>
          <TabsTrigger value="graph">Graph View</TabsTrigger>
        </TabsList>
        <TabsContent value="cards" className="w-full h-full p-6 pt-20 overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {states.map((state) => (
              <StateCard key={state.biome} state={state} />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="graph" className="w-full h-full m-0 p-0">
          <AutomatonGraph 
            automaton={automaton} 
            player={player}
          />
        </TabsContent>
      </Tabs>
      
      {/* Control Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
          <Button 
            onClick={handleMove}
            disabled={isMoving}
            size="lg"
          >
            {isMoving ? 'Moving...' : 'Move'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface StateCardProps {
  state: State;
}

function StateCard({ state }: StateCardProps) {
  const hasTransitions = state.transitions.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{state.biome}</CardTitle>
          <Badge variant="secondary">{state.variant}</Badge>
        </div>
        <CardDescription>
          {hasTransitions
            ? `${state.transitions.length} transition${state.transitions.length !== 1 ? 's' : ''}`
            : 'No transitions'}
        </CardDescription>
      </CardHeader>
      {hasTransitions && (
        <CardContent>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">Transitions:</h4>
            <div className="space-y-1.5">
              {state.transitions.map((transition, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{transition.to.biome}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {(transition.weight * 100).toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
