import { BaseEdge, type EdgeProps, getBezierPath } from 'reactflow';

export function CustomEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* Base wire */}
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{ 
          ...style, 
          strokeWidth: (style.strokeWidth as number) || 2,
          stroke: style.stroke || 'rgba(0, 0, 0, 0)',
          strokeDasharray: 'none',
          animation: 'none',
          opacity: 0,
        }} 
      />
      
      {/* Moving particles */}
      <BaseEdge
        path={edgePath}
        style={{
          strokeWidth: (style.strokeWidth as number) || 2,
          stroke: '#000000',
          strokeDasharray: '5 15',
          strokeLinecap: 'round',
          fill: 'none',
          animation: 'dashdraw 1s linear infinite',
          opacity: 0.8,
        }}
      />
      
      {/* Label */}
      {label && (
        <foreignObject
          x={labelX - 20}
          y={labelY - 10}
          width={40}
          height={20}
          className="overflow-visible pointer-events-none"
        >
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            background: labelBgStyle?.fill || 'white',
            borderRadius: 4,
            padding: '2px 4px',
            border: `1px solid ${labelBgStyle?.stroke || 'transparent'}`,
            fontSize: 10,
            fontWeight: 600,
            color: labelStyle?.fill?.toString() || 'black',
            whiteSpace: 'nowrap',
            position: 'absolute',
            transform: 'translate(-50%, -50%)',
            left: '50%',
            top: '50%'
          }}>
            {label}
          </div>
        </foreignObject>
      )}
      <style>
        {`
          @keyframes dashdraw {
            from {
              stroke-dashoffset: 20;
            }
            to {
              stroke-dashoffset: 0;
            }
          }
        `}
      </style>
    </>
  );
}

