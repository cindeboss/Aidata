interface Props {
  scale: number
  mode: 'drag' | 'select'
  onZoomIn: () => void
  onZoomOut: () => void
  onModeChange: (mode: 'drag' | 'select') => void
  onResetView?: () => void
  onFitContent?: () => void
}

export default function ZoomControl({ scale, mode, onZoomIn, onZoomOut, onModeChange, onResetView, onFitContent }: Props) {
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
        <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px' }} />
        <button
          onClick={onResetView}
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
          }}
          title="重置视图"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" />
          </svg>
        </button>
        <button
          onClick={onFitContent}
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
          }}
          title="适配所有内容"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
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
