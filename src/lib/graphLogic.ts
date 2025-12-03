// Graph visualization logic utilities

export interface NodeData {
  id: string;
  biome: string;
  variant: string;
  discovered: boolean;
  specialElement: string | null;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface LinkData {
  id: string;
  source: NodeData;
  target: NodeData;
  weight: number;
}

export const NODE_RADIUS = 50;
export const ANIMATION_DURATION = 4000; // ms for one complete cycle
export const DOTS_PER_EDGE = 5; // Number of dots per edge for continuous flow
export const DOT_SPACING = 0.2; // Spacing between dots (as fraction of path length)

/**
 * Generate a deterministic random color based on biome name (hash-based)
 */
export const getBiomeColor = (biome: string): string => {
  // Hash function for deterministic randomness
  let hash = 0;
  for (let i = 0; i < biome.length; i++) {
    const char = biome.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  // Use hash to generate HSL color with good saturation and lightness
  const hue = Math.abs(hash) % 360;
  const saturation = 50 + (Math.abs(hash) % 30); // 50-80%
  const lightness = 40 + (Math.abs(hash >> 8) % 30); // 40-70%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

/**
 * Generate random string of 8-10 characters
 */
export const generateRandomString = (): string => {
  const length = 8 + Math.floor(Math.random() * 3); // 8-10 characters
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Hash a string to a number (for deterministic positioning)
 */
export const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

/**
 * Check if a point is too close to any node
 */
export const isPointNearNode = (
  x: number,
  y: number,
  nodes: NodeData[],
  excludeIds: string[]
): boolean => {
  return nodes.some((node) => {
    if (excludeIds.includes(node.id) || !node.x || !node.y) return false;
    const dist = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2));
    return dist < NODE_RADIUS + 5; // 5px buffer
  });
};

/**
 * Calculate edge path avoiding nodes
 */
export const getEdgePath = (link: LinkData, nodes: NodeData[]): string => {
  const source = link.source;
  const target = link.target;
  
  if (!source.x || !source.y || !target.x || !target.y) {
    return '';
  }

  // Calculate angle from source to target
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const angle = Math.atan2(dy, dx);
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Start and end points on node perimeters
  const startX = source.x + Math.cos(angle) * NODE_RADIUS;
  const startY = source.y + Math.sin(angle) * NODE_RADIUS;
  const endX = target.x - Math.cos(angle) * NODE_RADIUS;
  const endY = target.y - Math.sin(angle) * NODE_RADIUS;

  // Perpendicular vector for offset
  const perpX = -dy / distance;
  const perpY = dx / distance;

  // Check multiple points along the path for node intersections
  let maxOffset = 0;
  const excludeIds = [source.id, target.id];
  
  // Sample points along the direct path
  for (let t = 0.1; t < 0.9; t += 0.1) {
    const testX = startX + (endX - startX) * t;
    const testY = startY + (endY - startY) * t;
    
    if (isPointNearNode(testX, testY, nodes, excludeIds)) {
      // Find the closest node to this point
      let minDist = Infinity;
      for (const node of nodes) {
        if (excludeIds.includes(node.id) || !node.x || !node.y) continue;
        const dist = Math.sqrt(
          Math.pow(testX - node.x, 2) + Math.pow(testY - node.y, 2)
        );
        minDist = Math.min(minDist, dist);
      }
      
      // Calculate needed offset
      const neededOffset = NODE_RADIUS + 10 - minDist;
      maxOffset = Math.max(maxOffset, neededOffset);
    }
  }

  // Apply offset with smooth curve
  const offset = maxOffset;
  const cp1x = startX + (endX - startX) * 0.3 + perpX * offset;
  const cp1y = startY + (endY - startY) * 0.3 + perpY * offset;
  const cp2x = startX + (endX - startX) * 0.7 + perpX * offset;
  const cp2y = startY + (endY - startY) * 0.7 + perpY * offset;

  // Create cubic bezier path
  return `M ${startX},${startY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${endX},${endY}`;
};

/**
 * Get point along path at given progress (0-1)
 */
export const getPointOnPath = (pathString: string, progress: number): [number, number] | null => {
  const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathEl.setAttribute('d', pathString);
  
  try {
    const length = pathEl.getTotalLength();
    const point = pathEl.getPointAtLength(length * progress);
    return [point.x, point.y];
  } catch {
    return null;
  }
};

/**
 * Get midpoint and angle of path for label positioning
 */
export const getPathMidpoint = (pathString: string): { x: number; y: number; angle: number } | null => {
  const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathEl.setAttribute('d', pathString);
  
  try {
    const length = pathEl.getTotalLength();
    const midpoint = pathEl.getPointAtLength(length * 0.5);
    const pointBefore = pathEl.getPointAtLength(length * 0.49);
    const pointAfter = pathEl.getPointAtLength(length * 0.51);
    const angle = Math.atan2(pointAfter.y - pointBefore.y, pointAfter.x - pointBefore.x);
    return { x: midpoint.x, y: midpoint.y, angle };
  } catch {
    return null;
  }
};

/**
 * Initialize node positions using hash-based deterministic positioning
 */
export const initializeNodePositions = (
  nodes: NodeData[],
  width: number,
  height: number
): void => {
  nodes.forEach((node) => {
    const hash = hashString(node.id);
    const angle = (hash % 360) * (Math.PI / 180);
    const radius = 150 + (hash % 150);
    node.x = width / 2 + radius * Math.cos(angle);
    node.y = height / 2 + radius * Math.sin(angle);
  });
};

