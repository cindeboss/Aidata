import { useState, useCallback, useEffect } from 'react'
import { useStore } from '../store/useStore'
import type { DataFile } from '../types'

interface FileCardProps {
  file: DataFile
  onExport?: (fileId: string) => void
}

export default function FileCard({ file, onExport }: FileCardProps) {
  const { updateFile, canvas, setActiveFile, removeFile } = useStore()
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, posX: 0, posY: 0 })
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.sheet-tab') || (e.target as HTMLElement).closest('table')) return

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
  }, [])

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

  // 根据 scale 决定显示模式
  const displayMode = canvas.scale < 0.7 ? 'summary' : 'full'
  const isSelected = canvas.selectedCards.includes(file.id)

  // 生成示例表格数据
  const getTableData = () => {
    const headers = file.sheets.find((s) => s.name === file.activeSheet)?.headers || ['Column 1', 'Column 2', 'Column 3']
    const rows = Array(Math.min(6, file.rowCount))
      .fill(null)
      .map((_, i) => headers.map(() => `Data ${i + 1}`))
    return { headers, rows }
  }

  const tableData = getTableData()

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
        background: 'var(--bg-white)',
        borderRadius: 12,
        boxShadow: isDragging ? '0 8px 24px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: isDragging ? 'none' : 'box-shadow 0.2s, border-color 0.2s',
        overflow: 'hidden',
        zIndex: isDragging ? 100 : 1,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      {/* 标题栏 */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontWeight: 600 }}>{file.name.replace(/\.(xlsx|csv|json)$/, '')}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{file.rowCount} 行</div>
      </div>

      {/* Sheet 标签 */}
      {file.sheets.length > 1 && (
        <div
          style={{
            display: 'flex',
            padding: '0 16px',
            background: '#f9fafb',
            borderBottom: '1px solid #f3f4f6',
            gap: 4,
          }}
        >
          {file.sheets.map((sheet) => (
            <button
              key={sheet.name}
              className="sheet-tab"
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                color: sheet.name === file.activeSheet ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 13,
                cursor: 'pointer',
                borderBottom: `2px solid ${sheet.name === file.activeSheet ? 'var(--accent)' : 'transparent'}`,
                marginBottom: -1,
                fontWeight: 500,
              }}
              onClick={() => handleSheetChange(sheet.name)}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {/* 表格内容 */}
      <div style={{ maxHeight: 240, overflow: 'auto' }}>
        <table style={{ width: 'max-content', minWidth: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {tableData.headers.map((h, i) => (
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
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid #f3f4f6',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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
