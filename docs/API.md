# DataClean AI API 文档

## 核心模块

### 1. AI Agent 模块 (`src/utils/aiAgent.ts`)

处理用户指令，执行数据提取、分析、转换操作。

#### `executeAgentCommand(command, context)`

执行用户输入的指令。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `command` | `string` | 用户输入的指令，如"提取机票数据" |
| `context.files` | `DataFile[]` | 当前已上传的文件列表 |

**返回：**
```typescript
{
  success: boolean
  message: string
  data?: {
    results: Array<{ fileName, sheetName, newFileId, rowCount }>
    totalRows: number
    count: number
  }
}
```

**示例：**
```typescript
const result = await executeAgentCommand('提取机票数据', { files })
if (result.success) {
  console.log(result.message) // "已成功提取 2 个文件，共 180 行数据"
}
```

#### `parseIntent(command)`

解析用户意图，返回意图类型、目标和置信度。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `command` | `string` | 用户输入 |

**返回：**
```typescript
{
  type: 'extract' | 'analyze' | 'transform' | 'unknown'
  target?: string
  confidence: number  // 0-1
  reason: string
}
```

**示例：**
```typescript
const intent = parseIntent('提取机票数据')
// { type: 'extract', target: '机票', confidence: 0.95, reason: '包含强关键词: 提取' }
```

---

### 2. 工具注册表模块 (`src/utils/toolRegistry.ts`)

统一管理工具定义和执行。

#### `registerTool(tool)`

注册一个新工具。

**参数：**
```typescript
{
  name: string           // 工具唯一标识
  description: string    // 工具描述（给 AI 看）
  parameters: [{         // 参数定义
    name: string
    type: 'string' | 'number' | 'boolean' | 'array' | 'object'
    description: string
    required?: boolean
    enum?: string[]
  }]
  handler: (params, context) => Promise<ToolResult>
}
```

**示例：**
```typescript
registerTool({
  name: 'extract_data',
  description: '从文件中提取指定类型数据',
  parameters: [
    { name: 'target', type: 'string', required: true, enum: ['机票', '酒店'] }
  ],
  handler: async (params, context) => {
    // 执行提取逻辑
    return { success: true, message: '提取完成', data: {...} }
  }
})
```

#### `executeTool(name, params, context)`

执行指定工具。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 工具名称 |
| `params` | `Record<string, any>` | 工具参数 |
| `context` | `ToolContext` | 执行上下文 |

**示例：**
```typescript
const result = await executeTool('extract_data',
  { target: '机票' },
  { files, addMessage: () => {}, setLoading: () => {} }
)
```

---

### 3. 错误处理模块 (`src/utils/errorHandler.ts`)

统一的错误码定义和处理。

#### 错误码列表

| 错误码 | 说明 | 可恢复 |
|--------|------|--------|
| `FILE_001` | 文件不存在 | ✅ |
| `FILE_002` | 文件过大 | ❌ |
| `FILE_003` | 格式不支持 | ❌ |
| `FILE_004` | 读取失败 | ✅ |
| `DATA_001` | 数据为空 | ❌ |
| `DATA_004` | 未找到目标数据 | ❌ |
| `AI_001` | API Key 未配置 | ✅ |
| `AI_002` | API 调用失败 | ✅ |
| `AI_004` | 请求超时 | ✅ |
| `AGENT_001` | 意图无法识别 | ✅ |
| `SYS_001` | Electron 不可用 | ❌ |

#### `createErrorResult(code, details)`

创建标准化的错误结果。

**示例：**
```typescript
return createErrorResult(ErrorCode.TARGET_NOT_FOUND, {
  target: '机票',
  availableTargets: ['机票', '酒店', '火车']
})
// 返回：
// {
//   success: false,
//   message: '未找到"机票"相关数据。\n\n💡 可用数据类型: 机票、酒店、火车',
//   errorCode: 'DATA_004',
//   recoverable: false
// }
```

#### `createErrorFromException(error)`

从异常自动推断错误码。

**示例：**
```typescript
try {
  await callAI()
} catch (error) {
  return createErrorFromException(error)
}
```

---

### 4. AI 服务模块 (`src/utils/aiService.ts`)

调用 AI API 进行对话和表结构分析。

#### `callAI(messages, config)`

发送消息给 AI。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `messages` | `Array<{role, content}>` | 消息历史 |
| `config.provider` | `'kimi-coding' \| 'kimi' \| 'zhipu' \| 'openai' \| 'anthropic' \| 'local'` | AI 提供商 |
| `config.apiKey` | `string` | API Key |

**示例：**
```typescript
const response = await callAI([
  { role: 'user', content: '分析这个数据文件' }
], {
  provider: 'kimi-coding',
  apiKey: 'sk-xxx'
})
```

#### `analyzeAllSheets(sheetsData, config, onProgress)`

批量分析多个 sheet 的表结构。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `sheetsData` | `Array<{name, rawData}>` | sheet 名称和原始数据 |
| `config` | `AIConfig` | AI 配置 |
| `onProgress` | `(current, total, sheetName) => void` | 进度回调 |

**返回：**
```typescript
Array<{
  name: string
  type: 'standard' | 'irregular' | 'unknown'
  headerRow: number
  dataStartRow: number
  fields: string[]
  confidence: number
}>
```

---

## 类型定义

### DataFile

```typescript
interface DataFile {
  id: string
  name: string
  type: 'excel' | 'csv' | 'json'
  path?: string
  sheets: SheetInfo[]
  activeSheet: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  quality: number
  rowCount: number
  createdAt: number
}
```

### SheetInfo

```typescript
interface SheetInfo {
  name: string
  headers: string[]
  rowCount: number
  columnTypes: string[]
  sampleRows: any[][]
  hidden?: boolean
  structureAnalysis?: TableStructureAnalysis
}
```

---

## 使用示例

### 场景 1：处理用户提取请求

```typescript
// 在 AIPanel.tsx 中
const handleSend = async () => {
  const text = input.trim()

  // 1. 识别意图
  const intent = parseIntent(text)

  if (intent.confidence >= 0.8) {
    // 2. 高置信度，直接执行
    const result = await executeAgentCommand(text, { files })
    addMessage({ role: 'assistant', content: result.message })
  } else if (intent.confidence >= 0.5) {
    // 3. 中置信度，询问确认
    addMessage({
      role: 'assistant',
      content: `您是想${intent.type === 'extract' ? '提取' : '分析'}数据吗？`
    })
  } else {
    // 4. 低置信度，提供建议
    addMessage({
      role: 'assistant',
      content: '请说得更明确一些，比如"提取机票数据"'
    })
  }
}
```

### 场景 2：使用工具注册表

```typescript
// 1. 注册工具
import { registerTool } from './utils/toolRegistry'

registerTool({
  name: 'custom_analysis',
  description: '自定义数据分析',
  parameters: [
    { name: 'fileId', type: 'string', required: true },
    { name: 'metric', type: 'string', enum: ['mean', 'sum', 'count'] }
  ],
  handler: async (params, context) => {
    const file = context.files.find(f => f.id === params.fileId)
    // 分析逻辑...
    return { success: true, message: '分析完成' }
  }
})

// 2. 执行工具
const result = await executeTool(
  'custom_analysis',
  { fileId: 'xxx', metric: 'sum' },
  { files, addMessage, setLoading }
)
```

### 场景 3：统一错误处理

```typescript
import { createErrorResult, ErrorCode } from './utils/errorHandler'

async function processFile(file: File) {
  try {
    if (file.size > 50 * 1024 * 1024) {
      return createErrorResult(ErrorCode.FILE_TOO_LARGE, {
        fileName: file.name,
        size: (file.size / 1024 / 1024).toFixed(1),
        limit: 50
      })
    }

    const result = await parseFile(file)
    return { success: true, message: '解析成功', data: result }

  } catch (error) {
    return createErrorFromException(error)
  }
}
```

---

## 开发指南

### 添加新意图

1. 在 `parseIntent` 中添加关键词匹配
2. 在 `executeByIntent` 中添加处理逻辑
3. 在 `agents.md` 中更新指令说明

### 添加新工具

1. 在 `src/tools/` 创建工具文件
2. 使用 `registerTool()` 注册
3. 在 `AIPanel.tsx` 中调用

### 添加新错误码

1. 在 `ErrorCode` 枚举中添加
2. 在 `errorMap` 中定义错误信息
3. 使用 `createErrorResult()` 返回
