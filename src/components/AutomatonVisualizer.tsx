import { useState } from 'react';
import { Automaton, type State } from '@/lib/automaton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AutomatonGraph } from './AutomatonGraph';

export function AutomatonVisualizer() {
  const [automaton, setAutomaton] = useState<Automaton>(Automaton.createRandom());

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
          <AutomatonGraph automaton={automaton} />
        </TabsContent>
      </Tabs>
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
                    <span className="font-medium">{transition.to}</span>
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
