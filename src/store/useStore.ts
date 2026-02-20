import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { DataFile, DataFlow, Message, CanvasState } from '../types'

// AI 配置类型
export interface AIConfigStore {
  provider: 'local' | 'kimi-coding' | 'kimi' | 'zhipu' | 'openai' | 'anthropic'
  apiKey: string
}

interface AppStore {
  // 文件
  files: DataFile[]
  addFile: (file: Omit<DataFile, 'id' | 'createdAt'>) => string
  updateFile: (id: string, updates: Partial<DataFile>) => void
  removeFile: (id: string) => void

  // 数据流
  flows: DataFlow[]
  addFlow: (flow: Omit<DataFlow, 'id'>) => void
  removeFlow: (id: string) => void

  // 消息
  messages: Message[]
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  clearMessages: () => void

  // 画布
  canvas: CanvasState
  setCanvasScale: (scale: number) => void
  setCanvasPan: (x: number, y: number) => void
  setCanvasMode: (mode: 'drag' | 'select') => void
  selectCards: (ids: string[]) => void
  clearSelection: () => void

  // 活动文件
  activeFileId: string | null
  setActiveFile: (id: string | null) => void

  // 加载状态
  isLoading: boolean
  setLoading: (loading: boolean) => void

  // 错误
  error: string | null
  setError: (error: string | null) => void

  // AI 配置
  aiConfig: AIConfigStore
  setAIConfig: (config: Partial<AIConfigStore>) => void
}

export const useStore = create<AppStore>()(
  (set, get) => ({
    // 文件
    files: [],
    addFile: (file) => {
      // 检查是否已存在相同路径的文件
      const existingFile = get().files.find((f) => f.path === file.path)
      if (existingFile) {
        return existingFile.id // 返回现有文件ID，不创建新文件
      }
      const id = uuid()
      set((state) => ({
        files: [
          ...state.files,
          {
            ...file,
            id,
            createdAt: Date.now(),
          },
        ],
      }))
      return id
    },
    updateFile: (id, updates) => {
      set((state) => ({
        files: state.files.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      }))
    },
    removeFile: (id) => {
      set((state) => ({
        files: state.files.filter((f) => f.id !== id),
        flows: state.flows.filter((f) => f.from !== id && f.to !== id),
      }))
    },

    // 数据流
    flows: [],
    addFlow: (flow) => {
      set((state) => ({
        flows: [...state.flows, { ...flow, id: uuid() }],
      }))
    },
    removeFlow: (id) => {
      set((state) => ({
        flows: state.flows.filter((f) => f.id !== id),
      }))
    },

    // 消息
    messages: [
      {
        id: 'welcome',
        role: 'assistant' as const,
        content: '你好！我是 DataClean AI 助手。你可以拖拽文件到画布上，或者用自然语言告诉我你想做什么。',
        timestamp: Date.now(),
      },
    ],
    addMessage: (message) => {
      set((state) => ({
        messages: [
          ...state.messages,
          {
            ...message,
            id: uuid(),
            timestamp: Date.now(),
          },
        ],
      }))
    },
    clearMessages: () => {
      set({
        messages: [
          {
            id: 'welcome',
            role: 'assistant' as const,
            content: '对话已清空。有什么我可以帮助你的吗？',
            timestamp: Date.now(),
          },
        ],
      })
    },

    // 画布
    canvas: {
      scale: 0.8,
      panX: 80,
      panY: 60,
      mode: 'drag',
      selectedCards: [],
    },
    setCanvasScale: (scale) => {
      set((state) => ({
        canvas: { ...state.canvas, scale },
      }))
    },
    setCanvasPan: (x, y) => {
      set((state) => ({
        canvas: { ...state.canvas, panX: x, panY: y },
      }))
    },
    setCanvasMode: (mode) => {
      set((state) => ({
        canvas: { ...state.canvas, mode, selectedCards: mode === 'drag' ? [] : state.canvas.selectedCards },
      }))
    },
    selectCards: (ids) => {
      set((state) => ({
        canvas: { ...state.canvas, selectedCards: ids },
      }))
    },
    clearSelection: () => {
      set((state) => ({
        canvas: { ...state.canvas, selectedCards: [] },
      }))
    },

    // 活动文件
    activeFileId: null,
    setActiveFile: (id) => {
      set({ activeFileId: id })
    },

    // 加载状态
    isLoading: false,
    setLoading: (loading) => {
      set({ isLoading: loading })
    },

    // 错误
    error: null,
    setError: (error) => {
      set({ error })
    },

    // AI 配置（仅从 localStorage 读取初始值）
    aiConfig: {
      provider: (() => {
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('dataclean-ai-ai-config')
          if (saved) {
            try {
              const parsed = JSON.parse(saved)
              return parsed.provider || 'kimi-coding'
            } catch {
              return 'kimi-coding'
            }
          }
        }
        return 'kimi-coding'
      })(),
      apiKey: (() => {
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('dataclean-ai-ai-config')
          if (saved) {
            try {
              const parsed = JSON.parse(saved)
              return parsed.apiKey || ''
            } catch {
              return ''
            }
          }
        }
        return ''
      })(),
    },
    setAIConfig: (config) => {
      set((state) => {
        const newConfig = { ...state.aiConfig, ...config }
        // 保存 AI 配置到 localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('dataclean-ai-ai-config', JSON.stringify(newConfig))
        }
        return { aiConfig: newConfig }
      })
    },
  })
)
