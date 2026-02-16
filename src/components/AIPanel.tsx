import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { callAI, DEFAULT_AI_CONFIG, type AIMessage } from '../utils/aiService'

export default function AIPanel() {
  const { messages, addMessage, clearMessages, files, isLoading, setLoading } = useStore()
  const [input, setInput] = useState('')
  const [isResizing, setIsResizing] = useState(false)
  const [panelWidth, setPanelWidth] = useState(380)
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)

  // AI 配置 - 默认使用 Kimi
  const aiConfig = DEFAULT_AI_CONFIG

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
    addMessage({ role: 'user', content: text })
    setLoading(true)

    try {
      // 构建 AI 消息历史
      const aiMessages: AIMessage[] = messages.slice(-10).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
      aiMessages.push({ role: 'user', content: text })

      // 添加文件上下文
      if (files.length > 0) {
        const context = `\n\n当前已加载的文件：\n${files.map((f) => `- ${f.name} (${f.rowCount} 行, ${f.sheets.length} 个工作表)`).join('\n')}`
        aiMessages[0] = {
          ...aiMessages[0],
          content: aiMessages[0].content + context,
        }
      }

      const response = await callAI(aiMessages, aiConfig)

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

  return (
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
      <div style={{ padding: '6px 12px', display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
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
            {msg.content}

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
      </div>

      {/* 输入区域 */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            background: '#f4f4f5',
            borderRadius: 16,
            padding: '8px 8px 8px 12px',
            gap: 8,
          }}
        >
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
              minHeight: 40,
              maxHeight: 120,
              lineHeight: 1.5,
            }}
            rows={1}
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
  )
}
