import { useState, useEffect, useCallback } from 'react'
import Canvas from './components/Canvas'
import AIPanel from './components/AIPanel'
import DropOverlay from './components/DropOverlay'
import { useStore } from './store/useStore'
import { parseFile } from './utils/fileParser'

function App() {
  const { addFile, addMessage, setLoading, setError } = useStore()
  const [isDragging, setIsDragging] = useState(false)

  // 处理文件拖拽
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.relatedTarget === null) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      const validFiles = files.filter(
        (f) =>
          f.name.endsWith('.csv') ||
          f.name.endsWith('.xlsx') ||
          f.name.endsWith('.xls') ||
          f.name.endsWith('.json')
      )

      if (validFiles.length === 0) {
        setError('请拖入 CSV、Excel 或 JSON 文件')
        return
      }

      setLoading(true)

      for (const file of validFiles) {
        try {
          const result = await parseFile(file)
          const fileCount = useStore.getState().files.length

          addFile({
            name: file.name,
            type: result.type,
            sheets: result.sheets,
            activeSheet: result.sheets[0]?.name || 'Sheet1',
            position: {
              x: 60 + fileCount * 30,
              y: 60 + fileCount * 30,
            },
            size: {
              width: result.type === 'excel' ? 676 : 400,
              height: 400,
            },
            quality: result.quality,
            rowCount: result.rowCount,
          })

          addMessage({
            role: 'assistant',
            content: `已导入文件 "${file.name}"，包含 ${result.sheets.length} 个工作表，共 ${result.rowCount} 行数据。${
              result.quality < 100
                ? `数据质量评分：${result.quality}%，建议检查数据问题。`
                : '数据质量良好！'
            }`,
          })
        } catch (err) {
          setError(`解析文件 ${file.name} 失败: ${(err as Error).message}`)
        }
      }

      setLoading(false)
    },
    [addFile, addMessage, setLoading, setError]
  )

  // 监听 Electron 文件拖拽事件
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.onFileDrop) {
      (window as any).electronAPI.onFileDrop((paths: string[]) => {
        console.log('Files dropped from Electron:', paths)
      })
    }
  }, [])

  return (
    <div
      className="app-container"
      style={{ display: 'flex', height: '100vh' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Canvas />
      <AIPanel />
      {isDragging && <DropOverlay />}
    </div>
  )
}

export default App
