import { useRef, useState, useCallback } from 'react'
import { useStore } from '../store/useStore'
import FileCard from './FileCard'
import DataFlowLines from './DataFlowLines'
import ZoomControl from './ZoomControl'
import AlignmentLines from './AlignmentLines'
import ExportModal from './ExportModal'

export default function Canvas() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const {
    files,
    flows,
    canvas,
    setCanvasScale,
    setCanvasPan,
    setCanvasMode,
    selectCards,
    clearSelection,
  } = useStore()

  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionBox, setSelectionBox] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    visible: false,
  })
  const [exportFileId, setExportFileId] = useState<string | null>(null)

  // 滚轮缩放
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const newScale = Math.max(0.1, Math.min(2, canvas.scale - e.deltaY * 0.001))
        setCanvasScale(newScale)
      } else {
        // 平移
        e.preventDefault()
        setCanvasPan(canvas.panX - e.deltaX, canvas.panY - e.deltaY)
      }
    },
    [canvas, setCanvasScale, setCanvasPan]
  )

  // 鼠标按下
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.file-card')) return

      if (canvas.mode === 'select') {
        setIsSelecting(true)
        const rect = canvasRef.current?.getBoundingClientRect()
        if (rect) {
          setSelectionBox({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            width: 0,
            height: 0,
            visible: true,
          })
        }
        clearSelection()
      } else {
        setIsDragging(true)
        setDragStart({
          x: e.clientX - canvas.panX,
          y: e.clientY - canvas.panY,
        })
      }
    },
    [canvas, clearSelection]
  )

  // 鼠标移动
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setCanvasPan(e.clientX - dragStart.x, e.clientY - dragStart.y)
      }

      if (isSelecting && selectionBox.visible) {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (rect) {
          const currentX = e.clientX - rect.left
          const currentY = e.clientY - rect.top
          setSelectionBox({
            x: Math.min(selectionBox.x, currentX),
            y: Math.min(selectionBox.y, currentY),
            width: Math.abs(currentX - selectionBox.x),
            height: Math.abs(currentY - selectionBox.y),
            visible: true,
          })
        }
      }
    },
    [isDragging, dragStart, setCanvasPan, isSelecting, selectionBox]
  )

  // 鼠标释放
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    if (isSelecting) {
      setIsSelecting(false)
      // 检测选中的卡片
      if (selectionBox.width > 10 && selectionBox.height > 10) {
        const selectedIds = files
          .filter((file) => {
            // 简单的碰撞检测
            const cardX = file.position.x * canvas.scale + canvas.panX
            const cardY = file.position.y * canvas.scale + canvas.panY
            const cardW = file.size.width * canvas.scale
            const cardH = file.size.height * canvas.scale

            return (
              cardX < selectionBox.x + selectionBox.width &&
              cardX + cardW > selectionBox.x &&
              cardY < selectionBox.y + selectionBox.height &&
              cardY + cardH > selectionBox.y
            )
          })
          .map((f) => f.id)
        selectCards(selectedIds)
      }
      setTimeout(() => {
        setSelectionBox((prev) => ({ ...prev, visible: false }))
      }, 100)
    }
  }, [isSelecting, selectionBox, files, canvas, selectCards])

  // 画布背景网格
  const gridStyle = {
    backgroundImage: `
      linear-gradient(#f0f0f0 1px, transparent 1px),
      linear-gradient(90deg, #f0f0f0 1px, transparent 1px)
    `,
    backgroundSize: `${24 * canvas.scale}px ${24 * canvas.scale}px`,
    backgroundPosition: `${canvas.panX}px ${canvas.panY}px`,
  }

  return (
    <div
      ref={canvasRef}
      className="canvas-area"
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--bg-canvas)',
        cursor: canvas.mode === 'drag' ? (isDragging ? 'grabbing' : 'grab') : 'crosshair',
        ...gridStyle,
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 数据流连线 */}
      <DataFlowLines flows={flows} files={files} scale={canvas.scale} panX={canvas.panX} panY={canvas.panY} />

      {/* 文件卡片 */}
      <div
        className="canvas-content"
        style={{
          position: 'absolute',
          transform: `translate(${canvas.panX}px, ${canvas.panY}px) scale(${canvas.scale})`,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
      >
        {files.map((file) => (
          <FileCard key={file.id} file={file} onExport={setExportFileId} />
        ))}
      </div>

      {/* 对齐线 */}
      <AlignmentLines scale={canvas.scale} panX={canvas.panX} panY={canvas.panY} />

      {/* 框选框 */}
      {selectionBox.visible && (
        <div
          className="selection-box"
          style={{
            position: 'absolute',
            left: selectionBox.x,
            top: selectionBox.y,
            width: selectionBox.width,
            height: selectionBox.height,
            border: '2px solid var(--accent)',
            background: 'rgba(99, 102, 241, 0.1)',
            pointerEvents: 'none',
            zIndex: 200,
          }}
        />
      )}

      {/* 缩放和模式控件 */}
      <ZoomControl scale={canvas.scale} mode={canvas.mode} onZoomIn={() => setCanvasScale(Math.min(2, canvas.scale + 0.1))} onZoomOut={() => setCanvasScale(Math.max(0.1, canvas.scale - 0.1))} onModeChange={setCanvasMode} />

      {/* 导出模态框 */}
      {exportFileId && <ExportModal fileId={exportFileId} onClose={() => setExportFileId(null)} />}
    </div>
  )
}
