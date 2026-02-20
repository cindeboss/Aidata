import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { callAI, analyzeAllSheets, type AIMessage } from '../utils/aiService'
import { executeAgentCommand } from '../utils/aiAgent'
import MarkdownMessage from './MarkdownMessage'
import Settings from './Settings'
import { parseFile, parseExcelWithRawData } from '../utils/fileParser'
import type { TableStructureAnalysis } from '../types'

// 分析进度状态
interface AnalysisProgress {
  isAnalyzing: boolean
  current: number
  total: number
  message: string
}

export default function AIPanel() {
  const { messages, addMessage, clearMessages, files, addFile, updateFile, isLoading, setLoading, aiConfig } = useStore()
  const [input, setInput] = useState('')
  const [isResizing, setIsResizing] = useState(false)
  const [panelWidth, setPanelWidth] = useState(380)
  const [showSettings, setShowSettings] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<string[]>([])
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null)
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight
    }
  }, [messages])

  // 发送消息
  const handleSend = async () => {
    const text = input.trim()
    if (!text) return

    setInput('')
    setAttachedFiles([])
    addMessage({ role: 'user', content: text })
    setLoading(true)

    try {
      // 构建 AI 消息历史
      const aiMessages: AIMessage[] = messages.slice(-10).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      // 添加文件上下文（排除隐藏的 sheet）
      let userContent = text
      if (files.length > 0) {
        const fileContext = files.map((f) => {
          const visibleSheets = f.sheets.filter(s => !s.hidden)
          const sheets = visibleSheets.map(s => `    - ${s.name} (${s.headers.length} 列, ${s.rowCount} 行)`).join('\n')
          const hiddenCount = f.sheets.length - visibleSheets.length
          const hiddenInfo = hiddenCount > 0 ? ` (另有 ${hiddenCount} 个隐藏 sheet)` : ''
          return `- ${f.name}${hiddenInfo}\n${sheets}`
        }).join('\n')
        userContent += `\n\n可用文件:\n${fileContext}`
      }
      aiMessages.push({ role: 'user', content: userContent })

      // 检查是否是数据处理指令
      const isDataCommand = text.includes('提取') || text.includes('导出') || text.includes('转换')

      if (isDataCommand && files.length > 0) {
        // 使用简化版 Agent 直接执行
        const result = await executeAgentCommand(text, { files })

        addMessage({
          role: 'assistant',
          content: result.message,
        })
      } else {
        // 普通对话模式
        const response = await callAI(aiMessages, {
          provider: aiConfig.provider,
          apiKey: aiConfig.apiKey,
        })

        addMessage({
          role: 'assistant',
          content: response,
          actions: text.includes('清洗') || text.includes('clean')
            ? [
                { id: '1', label: '执行清洗', emoji: '✅', action: 'clean' },
                { id: '2', label: '查看详情', emoji: '🔍', action: 'detail' },
              ]
            : undefined,
        })
      }
    } catch (error) {
      addMessage({
        role: 'assistant',
        content: `抱歉，处理请求时出错：${(error as Error).message}`,
      })
    } finally {
      setLoading(false)
    }
  }

  // 处理快捷操作
  const handleAction = (action: string) => {
    addMessage({ role: 'user', content: action })
    setTimeout(() => {
      addMessage({
        role: 'assistant',
        content: '操作已执行！数据已更新。',
      })
    }, 500)
  }

  // 面板宽度调整
  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = panelWidth
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      const deltaX = resizeStartX.current - e.clientX
      const newWidth = Math.max(300, Math.min(window.innerWidth / 2, resizeStartWidth.current + deltaX))
      setPanelWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // 获取当前 AI 状态（用于状态指示器）
  const getAIStatus = () => {
    // local 模式：明确是本地模拟
    if (aiConfig.provider === 'local') {
      return {
        name: '本地模式',
        color: '#9ca3af', // 灰色
        tooltip: '使用本地模拟响应，请在设置中配置 AI API'
      }
    }

    // 其他提供商：检查是否有 API Key
    if (!aiConfig.apiKey || aiConfig.apiKey.trim() === '') {
      return {
        name: '未配置 API Key',
        color: '#ef4444', // 红色
        tooltip: `请在设置中配置 ${aiConfig.provider} 的 API Key`
      }
    }

    // 有 API Key，显示提供商名称（绿色）
    const names: Record<string, string> = {
      'kimi-coding': 'Kimi Coding',
      kimi: 'Kimi',
      zhipu: '智谱 GLM',
      openai: 'OpenAI',
      anthropic: 'Anthropic',
    }
    return {
      name: names[aiConfig.provider] || aiConfig.provider,
      color: '#22c55e', // 绿色
      tooltip: `已配置 ${names[aiConfig.provider] || aiConfig.provider} API`
    }
  }

  // 处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[AIPanel] handleFileUpload triggered')
    const selectedFiles = e.target.files
    console.log('[AIPanel] selectedFiles:', selectedFiles?.length)
    if (!selectedFiles || selectedFiles.length === 0) return

    for (const file of Array.from(selectedFiles)) {
      try {
        let result
        let fileId: string | null = null

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          // Excel 文件：使用带原始数据的解析
          result = await parseExcelWithRawData(file)
          console.log('[AIPanel] Excel parsed, sheets:', result.sheets.length)

          // 保存到临时目录以便后续读取完整数据
          let filePath: string | undefined
          const electronAPI = (window as any).electronAPI
          if (electronAPI?.saveTempFile) {
            try {
              const arrayBuffer = await file.arrayBuffer()
              const tempResult = await electronAPI.saveTempFile(file.name, arrayBuffer)
              if (tempResult.success) {
                filePath = tempResult.path
              }
            } catch (err) {
              console.error('[AIPanel] saveTempFile error:', err)
            }
          }

          // 添加文件到 store
          // 计算新文件位置，避免与已有文件重叠
          const fileCount = files.length
          const gridSize = 550 // 文件宽度 + 间距
          const cols = 3 // 每行3个文件
          const row = Math.floor(fileCount / cols)
          const col = fileCount % cols
          const position = {
            x: 100 + col * gridSize,
            y: 100 + row * 400 // 文件高度 + 间距
          }

          const fileData = {
            name: file.name,
            type: 'excel' as const,
            path: filePath,
            sheets: result.sheets,
            activeSheet: result.sheets[0]?.name || 'Sheet1',
            position,
            size: { width: 500, height: 350 },
            quality: result.quality,
            rowCount: result.sheets[0]?.rowCount || 0,
          }
          console.log('[AIPanel] Adding file to store:', fileData)
          fileId = addFile(fileData)
          console.log('[AIPanel] File added with ID:', fileId)

          setAttachedFiles((prev) => [...prev, file.name])

          // 批量分析所有 sheets（跳过隐藏的 sheet）
          if (aiConfig.provider !== 'local') {
            try {
              const sheetsData = result.sheets
                .filter(s => s.rawData && !s.hidden)
                .map(s => ({ name: s.name, rawData: s.rawData! }))

              // 设置进度状态
              setAnalysisProgress({
                isAnalyzing: true,
                current: 0,
                total: sheetsData.length,
                message: `正在分析 ${file.name}...`,
              })

              const analysisResults = await analyzeAllSheets(
                sheetsData,
                {
                  provider: aiConfig.provider,
                  apiKey: aiConfig.apiKey,
                },
                (current, total, sheetName) => {
                  setAnalysisProgress({
                    isAnalyzing: true,
                    current,
                    total,
                    message: sheetName ? `正在分析: ${sheetName}` : '分析中...',
                  })
                }
              )

              // 清除进度状态
              setAnalysisProgress(null)

              // 更新每个 sheet 的分析结果
              if (fileId) {
                const { files: currentFiles } = useStore.getState()
                const currentFile = currentFiles.find(f => f.id === fileId)
                if (currentFile) {
                  const updatedSheets = currentFile.sheets.map(sheet => {
                    const analysis = analysisResults.find(a => a.name === sheet.name)
                    if (analysis) {
                      const structureAnalysis: TableStructureAnalysis = {
                        sheetType: analysis.type,
                        sheetTypeReason: analysis.typeReason || '',
                        headerRow: analysis.headerRow ?? 0,
                        dataStartRow: analysis.dataStartRow ?? 1,
                        fields: analysis.fields || [],
                        confidence: analysis.confidence ?? 0.5,
                        status: 'completed',
                      }
                      return { ...sheet, structureAnalysis }
                    }
                    return sheet
                  })
                  updateFile(fileId, { sheets: updatedSheets })
                }
              }

              // 显示分析结果汇总
              const standardSheets = analysisResults.filter(r => r.type === 'standard')
              const irregularSheets = analysisResults.filter(r => r.type === 'irregular')

              let summary = `分析完成！${file.name}\n\n`
              summary += `📊 共 ${result.sheets.length} 个 sheet：\n`
              summary += `  ✅ 标准表格：${standardSheets.length} 个\n`
              summary += `  ⚠️ 异形表格：${irregularSheets.length} 个\n\n`

              if (standardSheets.length > 0) {
                summary += `标准表格：\n`
                standardSheets.slice(0, 5).forEach(s => {
                  const fieldCount = s.fields?.length || s.headerRow !== undefined ? '已识别表头' : '待解析'
                  summary += `  • ${s.name}（${fieldCount}）\n`
                })
                if (standardSheets.length > 5) {
                  summary += `  ... 还有 ${standardSheets.length - 5} 个\n`
                }
              }

              if (irregularSheets.length > 0) {
                summary += `\n异形表格（无法自动表格化）：\n`
                irregularSheets.slice(0, 3).forEach(s => {
                  summary += `  • ${s.name}\n`
                })
                if (irregularSheets.length > 3) {
                  summary += `  ... 还有 ${irregularSheets.length - 3} 个\n`
                }
              }

              addMessage({ role: 'assistant', content: summary })
            } catch (analysisError) {
              console.error('Analysis error:', analysisError)
              addMessage({
                role: 'assistant',
                content: `分析过程中出现错误：${(analysisError as Error).message}\n\n文件已上传，但自动分析失败。`,
              })
            }
          } else {
            addMessage({
              role: 'assistant',
              content: `已上传文件：${file.name}（${result.sheets.length} 个 sheet）\n\n⚠️ 本地模式不支持自动分析。`,
            })
          }
        } else {
          // CSV/JSON 文件：使用标准解析
          result = await parseFile(file)

          // 保存到临时目录以便后续读取完整数据
          let filePath: string | undefined
          const electronAPI = (window as any).electronAPI
          if (electronAPI?.saveTempFile) {
            try {
              const arrayBuffer = await file.arrayBuffer()
              const tempResult = await electronAPI.saveTempFile(file.name, arrayBuffer)
              if (tempResult.success) {
                filePath = tempResult.path
              }
            } catch (err) {
              console.error('[AIPanel] saveTempFile error:', err)
            }
          }

          fileId = addFile({
            name: file.name,
            type: file.name.endsWith('.csv') ? 'csv' : 'json',
            path: filePath,
            sheets: result.sheets,
            activeSheet: result.sheets[0]?.name || 'Sheet1',
            position: { x: 100 + files.length * 50, y: 100 + files.length * 50 },
            size: { width: 500, height: 350 },
            quality: result.quality,
            rowCount: result.sheets[0]?.rowCount || 0,
          })

          setAttachedFiles((prev) => [...prev, file.name])
          addMessage({ role: 'assistant', content: `已上传文件：${file.name}（${result.sheets[0]?.rowCount || 0} 行）` })
        }
      } catch (error) {
        addMessage({ role: 'assistant', content: `上传失败：${(error as Error).message}` })
      }
    }

    // 清空 input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <div
        className="ai-panel"
        style={{
          width: panelWidth,
          minWidth: 300,
          maxWidth: '50vw',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          margin: 16,
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
        }}
      >
        {/* 调整宽度手柄 */}
        <div
          style={{
            position: 'absolute',
            left: -3,
            top: 16,
            bottom: 16,
            width: 6,
            cursor: 'col-resize',
            zIndex: 10,
            borderRadius: 3,
            background: isResizing ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.5) 0%, transparent 100%)' : 'transparent',
          }}
          onMouseDown={handleResizeStart}
        />

        {/* 工具栏 */}
        <div style={{ padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
            {(() => {
              const status = getAIStatus()
              return (
                <>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: status.color,
                    }}
                    title={status.tooltip}
                  />
                  <span title={status.tooltip}>{status.name}</span>
                </>
              )
            })()}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setShowSettings(true)}
              style={{
                width: 32,
                height: 32,
                background: 'transparent',
                border: 'none',
                borderRadius: 8,
                color: '#9ca3af',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="设置"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <button
              onClick={() => clearMessages()}
              style={{
                width: 32,
                height: 32,
                background: 'transparent',
                border: 'none',
                borderRadius: 8,
                color: '#9ca3af',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="清空对话"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>

        {/* 对话区域 */}
        <div
          ref={chatAreaRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 20px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                maxWidth: '100%',
                padding: '12px 16px',
                lineHeight: 1.6,
                fontSize: 14,
                background: msg.role === 'user' ? '#f4f4f5' : 'transparent',
                borderRadius: 18,
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                color: '#1f2937',
                whiteSpace: 'pre-wrap',
              }}
            >
              <MarkdownMessage content={msg.content} />

              {/* 操作按钮 */}
              {msg.actions && msg.actions.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {msg.actions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleAction(action.label)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        background: '#ffffff',
                        border: '1px solid var(--border)',
                        borderRadius: 20,
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#374151',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {action.emoji && <span>{action.emoji}</span>}
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
              <span className="pulse">AI 正在思考...</span>
            </div>
          )}

          {/* 分析进度 */}
          {analysisProgress && analysisProgress.isAnalyzing && (
            <div style={{ padding: '12px 16px', color: '#0369a1', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ imageRendering: 'pixelated' }}>
                  <path d="M6 1H10V3H6V1ZM4 3H6V5H4V3ZM10 3H12V5H10V3ZM2 5H4V9H2V5ZM12 5H14V9H12V5ZM4 9H6V11H4V9ZM10 9H12V11H10V9ZM6 11H10V13H6V11ZM6 13H10V15H6V13Z" fill="#0369a1"/>
                </svg>
              </span>
              <span>正在分析...</span>
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          {/* 附件预览 */}
          {attachedFiles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {attachedFiles.map((name, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    background: '#e0e7ff',
                    color: '#4f46e5',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  {name}
                </span>
              ))}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              background: '#f4f4f5',
              borderRadius: 16,
              padding: '8px 8px 8px 8px',
              gap: 8,
            }}
          >
            {/* 上传按钮 */}
            <button
              onClick={async () => {
                console.log('[AIPanel] Upload button clicked')

                // 使用 Electron 原生文件对话框（如果可用）
                if (typeof window !== 'undefined' && (window as any).electronAPI?.openFile) {
                  console.log('[AIPanel] Using Electron native file dialog')
                  try {
                    const filePaths = await (window as any).electronAPI.openFile()
                    console.log('[AIPanel] Selected files:', filePaths)
                    if (filePaths && filePaths.length > 0) {
                      // 读取文件并处理
                      for (const filePath of filePaths) {
                        const result = await (window as any).electronAPI.readFile(filePath)
                        if (result.success) {
                          const fileName = filePath.split('/').pop() || filePath
                          const file = new File([result.data], fileName)
                          // 触发处理
                          const event = { target: { files: [file] } } as any
                          await handleFileUpload(event)
                        }
                      }
                    }
                  } catch (err) {
                    console.error('[AIPanel] Electron file dialog error:', err)
                  }
                } else {
                  // 回退到 HTML input
                  console.log('[AIPanel] Using HTML input fallback')
                  fileInputRef.current?.click()
                }
              }}
              style={{
                width: 36,
                height: 36,
                background: 'transparent',
                border: 'none',
                borderRadius: 8,
                color: '#9ca3af',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              title="上传附件"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              multiple
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="发送消息..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                padding: '6px 4px',
                fontSize: 14,
                fontFamily: 'inherit',
                color: '#1f2937',
                outline: 'none',
                resize: 'none',
                minHeight: 60,
                maxHeight: 150,
                lineHeight: 1.5,
              }}
              rows={3}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                width: 36,
                height: 36,
                background: input.trim() ? '#6366f1' : '#e5e7eb',
                border: 'none',
                borderRadius: '50%',
                color: 'white',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 设置弹窗 */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </>
  )
}
