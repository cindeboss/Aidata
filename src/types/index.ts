// 单元格数据
export interface CellData {
  value: any
  formula?: string
  mergeId?: string // 如果是合并单元格的一部分，标识所属的合并区域
}

// 原始 Sheet 数据（用于 AI 分析）
export interface RawSheetData {
  cells: CellData[][]
  merges: MergeRange[]
}

// 合并单元格范围
export interface MergeRange {
  s: { r: number; c: number } // 起始行列 (row, col)
  e: { r: number; c: number } // 结束行列
}

// 字段层级（用于树状字段）
export interface FieldHierarchy {
  fullPath: string        // "基本信息.地址.省份"
  displayName: string     // "省份"
  parent?: string         // "地址"
  columnIndex: number
  level: number           // 层级深度，0 表示顶层
}

// 表格结构分析结果
export interface TableStructureAnalysis {
  sheetType: 'standard' | 'irregular' | 'unknown'
  sheetTypeReason?: string
  headerRow: number
  dataStartRow: number
  fields: string[]
  confidence: number      // 0-1 的置信度
  status: 'pending' | 'analyzing' | 'completed' | 'failed'
  error?: string
  // 保留旧字段以兼容
  headerRegion?: { startRow: number; endRow: number; startCol: number; endCol: number }
  fieldHierarchy?: FieldHierarchy[]
  rawHeaders?: string[][] // 原始表头数据（多行表头时为二维数组）
}

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
  sampleRows?: any[][] // 添加示例数据
  hidden?: boolean // 是否为隐藏的 sheet
  rawData?: RawSheetData // 原始单元格数据（用于 AI 分析）
  structureAnalysis?: TableStructureAnalysis // AI 分析结果
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
