import { useState, useCallback, useEffect } from 'react'
import { useStore } from '../store/useStore'
import type { DataFile, TableStructureAnalysis } from '../types'

// 分析状态指示器组件
function AnalysisStatusIndicator({ analysis }: { analysis: TableStructureAnalysis }) {
  const getStatusInfo = () => {
    if (analysis.sheetType === 'irregular') {
      return { color: '#f59e0b', text: '异形', icon: '⚠️' }
    }
    if (analysis.sheetType === 'standard') {
      const fieldCount = analysis.fields?.length || analysis.fieldHierarchy?.length || 0
      return { color: '#22c55e', text: fieldCount > 0 ? `${fieldCount}字段` : '标准表', icon: '✅' }
    }
    if (analysis.status === 'analyzing') {
      return { color: '#f59e0b', text: '分析中...', icon: '⏳' }
    }
    if (analysis.status === 'failed') {
      return { color: '#ef4444', text: '失败', icon: '❌' }
    }
    return { color: '#9ca3af', text: '未分析', icon: '❓' }
  }

  const { color, text, icon } = getStatusInfo()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        background: `${color}15`,
        borderRadius: 12,
        fontSize: 11,
        color,
      }}
      title={analysis.sheetTypeReason || analysis.error || ''}
    >
      <span>{icon}</span>
      {text}
    </div>
  )
}

interface FileCardProps {
  file: DataFile
  onExport?: (fileId: string) => void
}

type ResizeDirection = 'right' | 'bottom' | 'corner'

export default function FileCard({ file, onExport }: FileCardProps) {
  console.log('[FileCard] Rendering:', file.id, file.name, 'position:', file.position)
  const { updateFile, canvas, setActiveFile, removeFile } = useStore()
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, posX: 0, posY: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>('corner')
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })
  const [showHiddenSheets, setShowHiddenSheets] = useState(false)

  // 最小尺寸
  const MIN_WIDTH = 280
  const MIN_HEIGHT = 200

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 只有点击 sheet 标签、表格内容或调整大小手柄时不启动拖动
      // 其他区域（标题栏、卡片边缘等）都可以拖动
      if ((e.target as HTMLElement).closest('.sheet-tab') ||
          (e.target as HTMLElement).closest('table') ||
          (e.target as HTMLElement).closest('.resize-handle')) return

      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        posX: file.position.x,
        posY: file.position.y,
      })
      setActiveFile(file.id)
    },
    [file, setActiveFile]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return

      const dx = (e.clientX - dragStart.x) / canvas.scale
      const dy = (e.clientY - dragStart.y) / canvas.scale

      updateFile(file.id, {
        position: {
          x: dragStart.posX + dx,
          y: dragStart.posY + dy,
        },
      })
    },
    [isDragging, dragStart, canvas.scale, file.id, updateFile]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // 调整大小 - 开始
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, direction: ResizeDirection) => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      setResizeDirection(direction)
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: file.size.width,
        height: file.size.height,
      })
      setActiveFile(file.id)
    },
    [file, setActiveFile]
  )

  // 调整大小 - 全局鼠标移动
  useEffect(() => {
    if (!isResizing) return

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - resizeStart.x) / canvas.scale
      const dy = (e.clientY - resizeStart.y) / canvas.scale

      let newWidth = resizeStart.width
      let newHeight = resizeStart.height

      if (resizeDirection === 'right' || resizeDirection === 'corner') {
        newWidth = Math.max(MIN_WIDTH, resizeStart.width + dx)
      }
      if (resizeDirection === 'bottom' || resizeDirection === 'corner') {
        newHeight = Math.max(MIN_HEIGHT, resizeStart.height + dy)
      }

      updateFile(file.id, {
        size: {
          width: Math.round(newWidth),
          height: Math.round(newHeight),
        },
      })
    }

    const handleGlobalMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleGlobalMouseMove)
    document.addEventListener('mouseup', handleGlobalMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isResizing, resizeDirection, resizeStart, canvas.scale, file.id, updateFile])

  // 右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenuPos({ x: e.clientX, y: e.clientY })
    setShowContextMenu(true)
  }, [])

  // 点击其他地方关闭菜单
  const handleClickOutside = useCallback(() => {
    setShowContextMenu(false)
  }, [setShowContextMenu])

  // 监听点击事件关闭菜单
  useEffect(() => {
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showContextMenu, handleClickOutside])

  const handleSheetChange = (sheetName: string) => {
    updateFile(file.id, { activeSheet: sheetName })
  }

  // 截断 sheet 名称，最多显示6个汉字
  const truncateSheetName = (name: string) => {
    if (name.length <= 6) return name
    return name.slice(0, 6) + '...'
  }

  // 获取可见的 sheets（默认隐藏隐藏的 sheet）
  const visibleSheets = file.sheets.filter((sheet) => showHiddenSheets || !sheet.hidden)
  const hiddenSheetsCount = file.sheets.filter((sheet) => sheet.hidden).length

  // 当前活动的 sheet 是否在可见列表中，如果不在则选择第一个可见的
  const activeSheetInVisible = visibleSheets.find((s) => s.name === file.activeSheet)
  const currentSheet = activeSheetInVisible || visibleSheets[0]

  // 根据 scale 决定显示模式
  const displayMode = canvas.scale < 0.7 ? 'summary' : 'full'
  const isSelected = canvas.selectedCards.includes(file.id)

  // 获取表格数据
  const getTableData = () => {
    const sheet = currentSheet
    if (!sheet) {
      return { headers: ['Column 1', 'Column 2', 'Column 3'], rows: [] }
    }

    // 如果有 AI 分析结果，使用分析结果确定表头和数据
    if (sheet.structureAnalysis && sheet.structureAnalysis.status === 'completed') {
      const analysis = sheet.structureAnalysis

      // 异形表格：保持原有样式和内容
      if (analysis.sheetType === 'irregular') {
        const headers = sheet.headers || ['Column 1', 'Column 2', 'Column 3']
        const rows = sheet.sampleRows?.slice(0, 50) || []
        return { headers, rows, isIrregular: true }
      }

      // 标准表格：从 rawData 获取正确的数据（保持列对齐）
      if (analysis.sheetType === 'standard' && sheet.rawData) {
        const rawData = sheet.rawData
        const headerRow = analysis.headerRow

        // 从 rawData 中获取表头
        const headerCells = rawData.cells[headerRow] || []
        const maxCols = Math.max(headerCells.length, 1)

        // 使用 rawData 中的实际表头
        const headers = []
        for (let c = 0; c < maxCols; c++) {
          const val = headerCells[c]?.value
          headers.push(val ? String(val).trim() : `Column ${c + 1}`)
        }

        // 从 dataStartRow 开始获取数据
        const dataStartRow = analysis.dataStartRow
        const rows: any[][] = []
        for (let r = dataStartRow; r < rawData.cells.length && rows.length < 50; r++) {
          const row = rawData.cells[r] || []
          // 保持列对齐，用 null 填充空值
          const rowData = []
          for (let c = 0; c < maxCols; c++) {
            rowData.push(row[c]?.value ?? null)
          }
          rows.push(rowData)
        }

        return { headers, rows }
      }

      // 有分析结果但没有 rawData，使用 fields 和 sampleRows
      if (analysis.sheetType === 'standard' && analysis.fields.length > 0) {
        const headers = analysis.fields
        const dataOffset = Math.max(0, analysis.dataStartRow - 1)
        const rows = (sheet.sampleRows || []).slice(dataOffset).slice(0, 50)
        return { headers, rows }
      }
    }

    // 默认：使用原始解析的表头和数据
    const headers = sheet.headers || ['Column 1', 'Column 2', 'Column 3']
    const rows = sheet.sampleRows?.slice(0, 50) || []
    return { headers, rows }
  }

  const tableData = getTableData()

  // 调整大小手柄样式
  const resizeHandleStyle = {
    position: 'absolute' as const,
    background: 'transparent',
    zIndex: 10,
  }

  if (displayMode === 'summary') {
    return (
      <div
        className={`file-card summary ${isSelected ? 'selected' : ''}`}
        style={{
          position: 'absolute',
          left: file.position.x,
          top: file.position.y,
          width: 234,
          background: 'var(--bg-white)',
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: isDragging ? 'none' : 'box-shadow 0.2s, border-color 0.2s',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{file.name.replace(/\.(xlsx|csv|json)$/, '')}</div>
        </div>
        <div style={{ padding: '8px 16px 12px' }}>
          {file.sheets.map((sheet) => (
            <div key={sheet.name} style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '2px 0' }}>
              {sheet.name}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`file-card full ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{
        position: 'absolute',
        left: file.position.x,
        top: file.position.y,
        width: file.size.width,
        height: file.size.height,
        background: 'var(--bg-white)',
        borderRadius: 12,
        boxShadow: isDragging ? '0 8px 24px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: isDragging || isResizing ? 'none' : 'box-shadow 0.2s, border-color 0.2s',
        overflow: 'hidden',
        zIndex: isDragging ? 100 : 1,
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      {/* 标题栏 - 拖动区域 */}
      <div
        className="card-header"
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 600 }}>{file.name.replace(/\.(xlsx|csv|json)$/, '')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 分析状态指示器 */}
          {currentSheet?.structureAnalysis && (
            <AnalysisStatusIndicator analysis={currentSheet.structureAnalysis} />
          )}
          {/* 显示/隐藏隐藏的 Sheet 按钮 */}
          {hiddenSheetsCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowHiddenSheets(!showHiddenSheets)
              }}
              style={{
                padding: '2px 8px',
                fontSize: 11,
                background: showHiddenSheets ? '#e0e7ff' : '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                cursor: 'pointer',
                color: showHiddenSheets ? '#4f46e5' : '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title={showHiddenSheets ? '隐藏隐藏的 Sheet' : `显示 ${hiddenSheetsCount} 个隐藏的 Sheet`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                {showHiddenSheets ? (
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                ) : (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                )}
              </svg>
              {hiddenSheetsCount}
            </button>
          )}
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{file.rowCount} 行</div>
        </div>
      </div>

      {/* Sheet 标签 */}
      {visibleSheets.length > 1 && (
        <div
          style={{
            display: 'flex',
            padding: '0 16px',
            background: '#f9fafb',
            borderBottom: '1px solid #f3f4f6',
            gap: 4,
            flexShrink: 0,
            overflowX: 'auto',
            scrollbarWidth: 'thin',
          }}
          onWheel={(e) => {
            e.stopPropagation()
            e.currentTarget.scrollLeft += e.deltaY
          }}
        >
          {visibleSheets.map((sheet) => (
            <button
              key={sheet.name}
              className="sheet-tab"
              title={sheet.name + (sheet.hidden ? ' (隐藏)' : '')}
              style={{
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                color: sheet.name === currentSheet?.name ? 'var(--accent)' : sheet.hidden ? '#9ca3af' : 'var(--text-secondary)',
                fontSize: 13,
                cursor: 'pointer',
                borderBottom: `2px solid ${sheet.name === currentSheet?.name ? 'var(--accent)' : 'transparent'}`,
                marginBottom: -1,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                fontStyle: sheet.hidden ? 'italic' : 'normal',
              }}
              onClick={() => handleSheetChange(sheet.name)}
            >
              {truncateSheetName(sheet.name)}
              {sheet.hidden && <span style={{ fontSize: 10, marginLeft: 2 }}>👁</span>}
            </button>
          ))}
        </div>
      )}

      {/* 表格内容 - 阻止事件冒泡到画布，确保只能滚动表格 */}
      <div
        className="table-body"
        style={{ flex: 1, overflow: 'auto', minHeight: 0, cursor: 'default' }}
        onWheel={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <table
          style={{ width: 'max-content', minWidth: '100%', fontSize: 13, borderCollapse: 'collapse' }}
        >
          <thead>
            <tr>
              {tableData.headers.map((h, i) => {
                const headerText = h === null || h === undefined ? '' : String(h)
                const shouldWrap = headerText.length > 10
                return (
                  <th
                    key={i}
                    style={{
                      padding: '10px 14px',
                      textAlign: 'left',
                      borderBottom: '1px solid #f3f4f6',
                      background: '#f9fafb',
                      position: 'sticky',
                      top: 0,
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      fontSize: 12,
                      whiteSpace: shouldWrap ? 'normal' : 'nowrap',
                      wordBreak: 'break-all',
                      maxWidth: 200,
                    }}
                    title={headerText}
                  >
                    {headerText}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => {
                  const cellText = cell === null || cell === undefined ? '' : String(cell)
                  // 超过10个字符时换行
                  const shouldWrap = cellText.length > 10
                  return (
                    <td
                      key={j}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #f3f4f6',
                        whiteSpace: shouldWrap ? 'normal' : 'nowrap',
                        wordBreak: 'break-all',
                        maxWidth: 200,
                      }}
                      title={cellText}
                    >
                      {cellText}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 调整大小手柄 - 右边 */}
      <div
        className="resize-handle"
        style={{
          ...resizeHandleStyle,
          right: 0,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'ew-resize',
        }}
        onMouseDown={(e) => handleResizeStart(e, 'right')}
      />

      {/* 调整大小手柄 - 底部 */}
      <div
        className="resize-handle"
        style={{
          ...resizeHandleStyle,
          left: 0,
          right: 0,
          bottom: 0,
          height: 6,
          cursor: 'ns-resize',
        }}
        onMouseDown={(e) => handleResizeStart(e, 'bottom')}
      />

      {/* 调整大小手柄 - 右下角 */}
      <div
        className="resize-handle"
        style={{
          ...resizeHandleStyle,
          right: 0,
          bottom: 0,
          width: 16,
          height: 16,
          cursor: 'nwse-resize',
        }}
        onMouseDown={(e) => handleResizeStart(e, 'corner')}
      >
        <svg
          viewBox="0 0 16 16"
          style={{ position: 'absolute', right: 2, bottom: 2, opacity: 0.3 }}
          width="12"
          height="12"
        >
          <path d="M14 14H10M14 14V10M14 14L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* 右键菜单 */}
      {showContextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenuPos.x,
            top: contextMenuPos.y,
            background: 'white',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            border: '1px solid var(--border)',
            padding: '6px 0',
            minWidth: 160,
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
            onClick={() => {
              setShowContextMenu(false)
              onExport?.(file.id)
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            📤 导出
          </div>
          <div
            style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
            onClick={() => {
              setShowContextMenu(false)
              // 复制功能
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            📋 复制数据
          </div>
          <div style={{ height: 1, background: '#f3f4f6', margin: '6px 0' }} />
          <div
            style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--error)' }}
            onClick={() => {
              setShowContextMenu(false)
              removeFile(file.id)
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            🗑️ 删除
          </div>
        </div>
      )}
    </div>
  )
}
