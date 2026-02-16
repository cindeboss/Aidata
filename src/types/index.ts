// 数据文件类型
export interface DataFile {
  id: string
  name: string
  type: 'csv' | 'excel' | 'json'
  path?: string
  sheets: SheetInfo[]
  activeSheet: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  quality: number
  rowCount: number
  createdAt: number
}

// Sheet 信息
export interface SheetInfo {
  name: string
  headers: string[]
  rowCount: number
  columnTypes: ColumnType[]
}

// 列类型
export type ColumnType = 'string' | 'number' | 'date' | 'boolean' | 'mixed' | 'empty'

// 表格数据
export interface TableData {
  headers: string[]
  rows: any[][]
  highlightCol?: number
  highlightRows?: number[]
  cellHighlights?: { row: number; col: number }[]
}

// 数据流连接
export interface DataFlow {
  id: string
  from: string
  to: string
  label: string
  type: 'transform' | 'merge' | 'filter' | 'aggregate'
}

// AI 消息
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  actions?: MessageAction[]
  mentions?: string[]
}

// 消息操作按钮
export interface MessageAction {
  id: string
  label: string
  emoji?: string
  action: string
}

// 画布状态
export interface CanvasState {
  scale: number
  panX: number
  panY: number
  mode: 'drag' | 'select'
  selectedCards: string[]
}

// 应用状态
export interface AppState {
  files: DataFile[]
  flows: DataFlow[]
  messages: Message[]
  canvas: CanvasState
  activeFileId: string | null
  isLoading: boolean
  error: string | null
}

// AI API 配置
export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'local'
  apiKey?: string
  model?: string
  baseUrl?: string
}

// 数据分析结果
export interface AnalysisResult {
  summary: string
  insights: string[]
  issues: DataIssue[]
  suggestions: string[]
}

// 数据问题
export interface DataIssue {
  type: 'missing' | 'duplicate' | 'outlier' | 'format' | 'inconsistency'
  column?: string
  rows?: number[]
  description: string
  severity: 'low' | 'medium' | 'high'
}

// 导出配置
export interface ExportConfig {
  format: 'xlsx' | 'csv' | 'json' | 'pdf'
  includeHeaders: boolean
  sheetName?: string
}
