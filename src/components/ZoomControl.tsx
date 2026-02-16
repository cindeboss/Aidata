interface Props {
  scale: number
  mode: 'drag' | 'select'
  onZoomIn: () => void
  onZoomOut: () => void
  onModeChange: (mode: 'drag' | 'select') => void
}

export default function ZoomControl({ scale, mode, onZoomIn, onZoomOut, onModeChange }: Props) {
  return (
    <>
      {/* 缩放控件 */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: 'var(--bg-white)',
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--border)',
          padding: 4,
          zIndex: 50,
        }}
      >
        <button
          onClick={onZoomOut}
          style={{
            width: 32,
            height: 32,
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
        >
          −
        </button>
        <span style={{ padding: '0 12px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', minWidth: 50, textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={onZoomIn}
          style={{
            width: 32,
            height: 32,
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
        >
          +
        </button>
      </div>

      {/* 模式切换 */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 160,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: 'var(--bg-white)',
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--border)',
          padding: 4,
          zIndex: 50,
        }}
      >
        <button
          onClick={() => onModeChange('drag')}
          style={{
            width: 32,
            height: 32,
            background: mode === 'drag' ? '#eef2ff' : 'transparent',
            border: 'none',
            borderRadius: 6,
            color: mode === 'drag' ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="拖拽模式"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
          </svg>
        </button>
        <button
          onClick={() => onModeChange('select')}
          style={{
            width: 32,
            height: 32,
            background: mode === 'select' ? '#eef2ff' : 'transparent',
            border: 'none',
            borderRadius: 6,
            color: mode === 'select' ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="选择模式"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
          </svg>
        </button>
      </div>
    </>
  )
}
