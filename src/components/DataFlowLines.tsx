import type { DataFlow, DataFile } from '../types'

interface Props {
  flows: DataFlow[]
  files: DataFile[]
  scale: number
  panX: number
  panY: number
}

export default function DataFlowLines({ flows, files, scale, panX, panY }: Props) {
  if (flows.length === 0) return null

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 3000,
        height: 3000,
        pointerEvents: 'none',
        zIndex: 1,
        transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
        transformOrigin: '0 0',
      }}
    >
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1" />
        </marker>
      </defs>

      {flows.map((flow) => {
        const fromFile = files.find((f) => f.id === flow.from)
        const toFile = files.find((f) => f.id === flow.to)
        if (!fromFile || !toFile) return null

        const fromX = fromFile.position.x + fromFile.size.width
        const fromY = fromFile.position.y + fromFile.size.height / 2
        const toX = toFile.position.x
        const toY = toFile.position.y + toFile.size.height / 2

        const controlOffset = Math.min(80, Math.abs(toX - fromX) / 3)
        const controlX1 = fromX + controlOffset
        const controlX2 = toX - controlOffset
        const midX = (fromX + toX) / 2
        const midY = (fromY + toY) / 2

        return (
          <g key={flow.id}>
            <path
              d={`M ${fromX} ${fromY} C ${controlX1} ${fromY}, ${controlX2} ${toY}, ${toX} ${toY}`}
              fill="none"
              stroke="#6366f1"
              strokeWidth={2}
              strokeOpacity={0.6}
              strokeDasharray="8 4"
              markerEnd="url(#arrowhead)"
              style={{
                animation: 'flowDash 1s linear infinite',
              }}
            />
            <rect x={midX - 30} y={midY - 10} width={60} height={20} rx={4} fill="white" />
            <text x={midX} y={midY + 4} textAnchor="middle" fill="#6b7280" fontSize={11} fontWeight={500}>
              {flow.label}
            </text>
          </g>
        )
      })}

      <style>
        {`
          @keyframes flowDash {
            to {
              stroke-dashoffset: -12;
            }
          }
        `}
      </style>
    </svg>
  )
}
