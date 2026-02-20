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
      console.log('[App] handleDrop triggered')
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      console.log('[App] files dropped:', files.length)
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

          // 如果是 Electron 环境，保存文件到临时目录以便后续读取完整数据
          let filePath: string | undefined
          const electronAPI = (window as any).electronAPI
          console.log('[App] electronAPI:', electronAPI)
          console.log('[App] saveTempFile:', electronAPI?.saveTempFile)
          if (electronAPI?.saveTempFile) {
            try {
              const arrayBuffer = await file.arrayBuffer()
              console.log('[App] Saving temp file:', file.name, arrayBuffer.byteLength)
              const tempResult = await electronAPI.saveTempFile(file.name, arrayBuffer)
              console.log('[App] Temp result:', tempResult)
              if (tempResult.success) {
                filePath = tempResult.path
              }
            } catch (err) {
              console.error('[App] saveTempFile error:', err)
            }
          }

          // 检查是否为重复文件
          const existingFile = useStore.getState().files.find(f => f.path === filePath)
          if (existingFile) {
            addMessage({
              role: 'assistant',
              content: `文件 "${file.name}" 已存在于画布上，未重复添加。`
            })
            continue
          }

          // 计算新文件位置，使用网格布局避免重叠
          const gridSize = 550 // 文件宽度 + 间距
          const cols = 3 // 每行3个文件
          const row = Math.floor(fileCount / cols)
          const col = fileCount % cols

          addFile({
            name: file.name,
            type: result.type,
            path: filePath,
            sheets: result.sheets,
            activeSheet: result.sheets[0]?.name || 'Sheet1',
            position: {
              x: 100 + col * gridSize,
              y: 100 + row * 400,
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
