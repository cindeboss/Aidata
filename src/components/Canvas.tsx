import { useRef, useState, useCallback, useEffect } from 'react'
import { useStore } from '../store/useStore'
import FileCard from './FileCard'
import DataFlowLines from './DataFlowLines'
import ZoomControl from './ZoomControl'
import AlignmentLines from './AlignmentLines'
import ExportModal from './ExportModal'

export default function Canvas() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const wheelHandlerRef = useRef<((e: WheelEvent) => void) | null>(null)
  const store = useStore()
  const {
    files,
    flows,
    canvas,
    setCanvasScale,
    setCanvasPan,
    setCanvasMode,
    selectCards,
    clearSelection,
  } = store

  // Debug: log files changes
  useEffect(() => {
    console.log('[Canvas] Files updated:', files.length, files.map(f => ({ id: f.id, name: f.name, position: f.position })))
  }, [files])

  // Debug: log canvas state
  useEffect(() => {
    console.log('[Canvas] Canvas state:', { scale: canvas.scale, panX: canvas.panX, panY: canvas.panY, mode: canvas.mode })
  }, [canvas])

  // Force reset view on first load with files
  const hasResetRef = useRef(false)

  useEffect(() => {
    if (files.length > 0 && !hasResetRef.current) {
      hasResetRef.current = true
      console.log('[Canvas] First load with files, resetting view')

      // Force reset to default view position
      setCanvasScale(0.8)
      setCanvasPan(80, 60)
    }
  }, [files.length, setCanvasScale, setCanvasPan])

  // Auto-fit view when files change
  useEffect(() => {
    if (files.length === 0) return

    const canvasWidth = canvasRef.current?.clientWidth || window.innerWidth
    const canvasHeight = canvasRef.current?.clientHeight || window.innerHeight

    // Calculate bounds of all files
    const minX = Math.min(...files.map(f => f.position.x))
    const minY = Math.min(...files.map(f => f.position.y))
    const maxX = Math.max(...files.map(f => f.position.x + f.size.width))
    const maxY = Math.max(...files.map(f => f.position.y + f.size.height))

    // Calculate visible area
    const visibleLeft = -canvas.panX / canvas.scale
    const visibleTop = -canvas.panY / canvas.scale
    const visibleRight = visibleLeft + canvasWidth / canvas.scale
    const visibleBottom = visibleTop + canvasHeight / canvas.scale

    // Check if files are outside viewport
    const isOutside = minX > visibleRight || maxX < visibleLeft || minY > visibleBottom || maxY < visibleTop

    if (isOutside) {
      console.log('[Canvas] Files outside viewport, auto-fitting')

      const contentWidth = maxX - minX
      const contentHeight = maxY - minY

      const padding = 100
      const scaleX = (canvasWidth - padding * 2) / contentWidth
      const scaleY = (canvasHeight - padding * 2) / contentHeight
      const newScale = Math.max(0.1, Math.min(1.0, Math.min(scaleX, scaleY)))

      const newPanX = (canvasWidth - contentWidth * newScale) / 2 - minX * newScale
      const newPanY = (canvasHeight - contentHeight * newScale) / 2 - minY * newScale

      setCanvasScale(newScale)
      setCanvasPan(newPanX, newPanY)
    }
  }, [files, canvas.scale, canvas.panX, canvas.panY, setCanvasScale, setCanvasPan])

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

  // 滚轮缩放 - 使用原生事件监听以避免 passive 事件警告
  useEffect(() => {
    const canvasEl = canvasRef.current
    if (!canvasEl) return

    const handleWheel = (e: WheelEvent) => {
      // 如果事件来自表格区域，不处理（让表格自己滚动）
      if ((e.target as HTMLElement).closest('.table-body')) {
        return
      }

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const newScale = Math.max(0.1, Math.min(2, canvas.scale - e.deltaY * 0.001))
        setCanvasScale(newScale)
      } else {
        // 平移
        e.preventDefault()
        setCanvasPan(canvas.panX - e.deltaX, canvas.panY - e.deltaY)
      }
    }

    // 保存引用以便清理
    wheelHandlerRef.current = handleWheel

    // 使用 { passive: false } 绑定原生事件
    canvasEl.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      canvasEl.removeEventListener('wheel', handleWheel)
    }
  }, [canvas.scale, canvas.panX, canvas.panY, setCanvasScale, setCanvasPan])

  // 鼠标按下
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 如果点击的是文件卡片或表格区域，不启动画布拖动
      if ((e.target as HTMLElement).closest('.file-card')) return
      if ((e.target as HTMLElement).closest('.table-body')) return

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
      <ZoomControl
        scale={canvas.scale}
        mode={canvas.mode}
        onZoomIn={() => setCanvasScale(Math.min(2, canvas.scale + 0.1))}
        onZoomOut={() => setCanvasScale(Math.max(0.1, canvas.scale - 0.1))}
        onModeChange={setCanvasMode}
        onResetView={() => {
          setCanvasScale(0.8)
          setCanvasPan(80, 60)
        }}
        onFitContent={() => {
          if (files.length === 0) return
          // 计算所有文件的边界框
          const minX = Math.min(...files.map(f => f.position.x))
          const minY = Math.min(...files.map(f => f.position.y))
          const maxX = Math.max(...files.map(f => f.position.x + f.size.width))
          const maxY = Math.max(...files.map(f => f.position.y + f.size.height))
          const contentWidth = maxX - minX
          const contentHeight = maxY - minY
          // 获取画布尺寸
          const canvasWidth = canvasRef.current?.clientWidth || 800
          const canvasHeight = canvasRef.current?.clientHeight || 600
          // 计算合适的缩放比例
          const padding = 100
          const scaleX = (canvasWidth - padding * 2) / contentWidth
          const scaleY = (canvasHeight - padding * 2) / contentHeight
          const newScale = Math.max(0.1, Math.min(1.5, Math.min(scaleX, scaleY)))
          // 设置新的平移位置，使内容居中
          const newPanX = (canvasWidth - contentWidth * newScale) / 2 - minX * newScale
          const newPanY = (canvasHeight - contentHeight * newScale) / 2 - minY * newScale
          setCanvasScale(newScale)
          setCanvasPan(newPanX, newPanY)
          console.log('[Canvas] Fit content:', { newScale, newPanX, newPanY, bounds: { minX, minY, maxX, maxY } })
        }}
      />

      {/* 导出模态框 */}
      {exportFileId && <ExportModal fileId={exportFileId} onClose={() => setExportFileId(null)} />}
    </div>
  )
}
