# DataClean AI 项目完整诊断文档

**生成时间**: 2026-02-20
**项目版本**: 0.1.0
**仓库**: https://github.com/cindeboss/Aidata.git

---

## 1. 项目概述

### 1.1 基本信息
- **项目名称**: DataClean AI
- **类型**: Electron + React + TypeScript 桌面应用
- **用途**: AI-native 数据清洗工具，具有无限画布、语义缩放、文件卡片、数据流可视化
- **目标用户**: 需要处理和清洗 Excel/CSV 数据的数据分析师

### 1.2 核心功能
1. **无限画布**: 支持缩放（0.1-2x）和平移，文件卡片可拖拽定位
2. **文件卡片**: 展示 Excel/CSV/JSON 文件内容，支持多 sheet 切换
3. **AI 对话面板**: 与 AI 协作进行数据清洗和分析
4. **数据流可视化**: 显示文件间的数据流动关系
5. **表格结构分析**: AI 自动分析复杂表头（合并单元格、多行表头）
6. **字段层级视图**: 树状展示嵌套字段结构

---

## 2. 技术栈详情

| 类别 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | ^18.2.0 |
| 桌面框架 | Electron | ^28.1.0 |
| 语言 | TypeScript | ^5.3.3 |
| 构建工具 | Vite | ^5.0.10 |
| 状态管理 | Zustand | ^4.5.0 |
| 文件解析 | SheetJS (xlsx) | ^0.18.5 |
| CSV 解析 | PapaParse | ^5.4.1 |
| 测试框架 | Vitest | ^1.1.0 |
| E2E 测试 | Playwright | ^1.58.2 |
| UUID 生成 | uuid | ^9.0.0 |

---

## 3. 项目结构

```
/Users/wanghui/claude/dataclean-ai/
├── docs/                          # 项目文档
│   ├── README.md
│   ├── CHANGELOG.md
│   ├── API.md
│   ├── CLAUDE.md                  # 开发指南
│   ├── agents.md
│   └── TESTING.md
├── electron/                      # Electron 主进程
│   ├── main.ts                    # 主进程入口 (267行)
│   └── preload.ts                 # 预加载脚本 (63行)
├── src/                           # 前端源代码
│   ├── main.tsx                   # React 入口
│   ├── App.tsx                    # 主应用组件 (149行)
│   ├── components/                # React 组件
│   │   ├── Canvas.tsx             # 无限画布 (329行)
│   │   ├── FileCard.tsx           # 文件卡片
│   │   ├── AIPanel.tsx            # AI 对话面板
│   │   ├── ZoomControl.tsx        # 缩放控制
│   │   ├── Settings.tsx           # 设置面板
│   │   ├── FieldHierarchyView.tsx # 字段层级视图
│   │   ├── AnalysisConfirmModal.tsx # 分析确认弹窗
│   │   ├── MarkdownMessage.tsx    # Markdown 渲染
│   │   ├── DataFlowLines.tsx      # 数据流连线
│   │   ├── AlignmentLines.tsx     # 对齐线
│   │   ├── ExportModal.tsx        # 导出弹窗
│   │   └── DropOverlay.tsx        # 拖放覆盖层
│   ├── store/
│   │   └── useStore.ts            # Zustand 状态管理 (230行)
│   ├── types/
│   │   └── index.ts               # TypeScript 类型定义 (162行)
│   ├── utils/                     # 工具函数
│   │   ├── aiService.ts           # AI 服务 (503行)
│   │   ├── fileParser.ts          # 文件解析 (367行)
│   │   ├── sheetAnalyzer.ts       # Sheet 分析
│   │   ├── aiAgent.ts             # AI Agent
│   │   ├── aiTools.ts             # AI 工具
│   │   ├── errorHandler.ts        # 错误处理
│   │   └── fileExporter.ts        # 文件导出
│   └── tools/
│       └── dataTools.ts           # 数据处理工具
├── tests/                         # 单元测试
│   ├── aiService.test.ts
│   ├── fileParser.test.ts
│   ├── store.test.ts
│   ├── agentBehavior.test.ts
│   └── setup.ts
├── test-suite/                    # 测试套件
│   ├── index.js
│   ├── runner.js
│   ├── cases/
│   │   ├── api.test.js
│   │   ├── extract.test.js
│   │   └── hidden-sheet.test.js
│   └── utils/
│       ├── electron-launcher.js
│       ├── log-analyzer.js
│       └── page-helper.js
├── test-temp/                     # 测试产物（不提交）
│   ├── screenshots/               # 测试截图
│   └── scripts/                   # 临时测试脚本
├── raw/                           # 原始数据文件（示例 Excel）
├── package.json
├── tsconfig.json
├── tsconfig.electron.json
├── vite.config.ts
└── vitest.config.ts
```

---

## 4. 配置文件详情

### 4.1 package.json
```json
{
  "name": "dataclean-ai",
  "version": "0.1.0",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build && npm run build:electron",
    "build:electron": "tsc -p tsconfig.electron.json",
    "electron:dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
    "test": "vitest",
    "test:unit": "vitest",
    "test:integration": "node test-integration.js",
    "test:diagnose": "node test-diagnose.js"
  }
}
```

### 4.2 TypeScript 配置 (tsconfig.json)
- target: ES2020
- module: ESNext
- 严格模式启用
- 路径别名: `@/*` → `src/*`

### 4.3 Vite 配置
- React 插件
- 路径别名 `@/` → `./src`
- base: './' (相对路径)
- 开发端口: 5173

---

## 5. 核心类型定义 (src/types/index.ts)

```typescript
// 关键类型
interface DataFile {
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
}

interface SheetInfo {
  name: string
  headers: string[]
  rowCount: number
  columnTypes: ColumnType[]
  sampleRows?: any[][]
  hidden?: boolean
  rawData?: RawSheetData
  structureAnalysis?: TableStructureAnalysis
}

interface TableStructureAnalysis {
  sheetType: 'standard' | 'irregular' | 'unknown'
  headerRow: number
  dataStartRow: number
  fields: string[]
  confidence: number
  status: 'pending' | 'analyzing' | 'completed' | 'failed'
}

interface AIConfig {
  provider: 'kimi-coding' | 'kimi' | 'zhipu' | 'openai' | 'anthropic' | 'local'
  apiKey?: string
  model?: string
}
```

---

## 6. Electron 架构

### 6.1 IPC 通信通道

| 通道 | 方向 | 功能 |
|------|------|------|
| `dialog:openFile` | 双向 | 打开文件对话框 |
| `dialog:saveFile` | 双向 | 保存文件对话框 |
| `file:read` | 双向 | 读取文件内容 |
| `file:write` | 双向 | 写入文件 |
| `file:saveTemp` | 双向 | 保存到临时目录 |
| `ai:call` | 双向 | AI API 调用（绕过 CORS）|
| `excel:readSheet` | 双向 | 读取 Excel sheet 完整数据 |
| `data:exportJSON` | 双向 | 导出 JSON |
| `data:exportCSV` | 双向 | 导出 CSV |
| `app:getUserDataPath` | 双向 | 获取用户数据目录 |

### 6.2 AI API 调用绕过 CORS 方案
Electron 主进程使用 Node.js 的 `http/https` 模块直接发起请求，避免浏览器的 CORS 限制。

---

## 7. AI 服务架构 (src/utils/aiService.ts)

### 7.1 支持的 AI 提供商

| 提供商 | 默认模型 | API 基础地址 |
|--------|----------|--------------|
| kim-coding (默认) | Kimi code | https://api.kimi.com/coding |
| kimi | moonshot-v1-8k | https://api.moonshot.cn |
| zhipu | glm-4-flash | https://open.bigmodel.cn/api/paas/v4 |
| openai | gpt-4o-mini | https://api.openai.com |
| anthropic | claude-3-haiku | https://api.anthropic.com |
| local | 模拟响应 | 本地 |

### 7.2 表格结构分析流程
1. 提取 Excel 前 20 行原始单元格数据
2. 发送给 AI 进行分析
3. 解析返回的 JSON（支持代码块和裸 JSON）
4. 返回 `TableStructureAnalysis` 对象

### 7.3 系统提示词
```
你是 DataClean AI 的数据分析助手。你的任务是帮助用户：
1. 理解和分析数据
2. 发现数据质量问题（空值、重复、异常等）
3. 提供数据清洗建议
4. 回答关于数据的问题
```

---

## 8. 状态管理 (src/store/useStore.ts)

### 8.1 Zustand Store 结构
```typescript
interface AppStore {
  files: DataFile[]
  flows: DataFlow[]
  messages: Message[]
  canvas: CanvasState
  activeFileId: string | null
  isLoading: boolean
  error: string | null
  aiConfig: AIConfigStore
}
```

### 8.2 画布默认状态
```typescript
canvas: {
  scale: 0.8,       // 默认缩放
  panX: 80,         // X 偏移
  panY: 60,         // Y 偏移
  mode: 'drag',     // 拖动/选择模式
  selectedCards: [] // 选中的卡片
}
```

### 8.3 AI 配置持久化
AI 配置自动保存到 localStorage，键名为 `dataclean-ai-ai-config`

---

## 9. 文件解析 (src/utils/fileParser.ts)

### 9.1 支持格式
- **CSV**: 通过 PapaParse 解析
- **Excel**: 通过 SheetJS (xlsx) 解析
- **JSON**: 原生解析，支持数组和对象

### 9.2 数据质量评分算法
```typescript
quality = (nonEmptyCells / totalCells) * 60 +  // 空值占比 60%
          (uniqueRows / totalRows) * 40         // 去重占比 40%
```

### 9.3 隐藏 Sheet 处理
- 默认排除隐藏的 sheet
- 通过 `workbook.Workbook.Sheets` 检测隐藏状态

---

## 10. 画布系统 (src/components/Canvas.tsx)

### 10.1 交互方式
| 操作 | 功能 |
|------|------|
| 滚轮 | 平移画布 |
| Ctrl + 滚轮 | 缩放画布 |
| 拖拽空白处 | 平移画布 |
| 框选 | 多选文件卡片 |

### 10.2 自动适配
- 首次加载文件时自动重置视图
- 文件移出视口时自动适配

### 10.3 背景网格
动态网格，随缩放比例变化：
```
backgroundSize: `${24 * scale}px ${24 * scale}px`
```

---

## 11. 已知问题和限制

### 11.1 架构问题
1. **代码重复**: `aiService.ts` 和 `sheetAnalyzer.ts` 存在功能重复
2. **类型导出混乱**: `inferStructureFromData` 被重复导出
3. **硬编码配置**: 部分阈值（如空值检测）硬编码

### 11.2 性能问题
1. **大数据处理**: 所有数据加载到内存，未做虚拟化
2. **AI 调用**: 同步阻塞，无并发控制
3. **文件卡片**: 大数据表滚动未优化

### 11.3 用户体验问题
1. **AI 响应**: 无流式响应，等待时间较长
2. **错误处理**: 部分错误提示不够友好
3. **加载状态**: 全局 loading，粒度较粗

### 11.4 测试问题
1. **测试覆盖**: 部分组件缺乏测试
2. **E2E 测试**: 依赖 Electron 环境，运行复杂

---

## 12. 开发命令

```bash
# 开发模式
npm run electron:dev

# 构建
npm run build

# 测试
npm test                    # 运行所有测试
npm run test:unit          # 单元测试
npm run test:integration   # 集成测试
npm run test:diagnose      # 诊断测试

# 代码检查
npm run lint
```

---

## 13. 文件统计

```
总文件数: 约 45 个源代码文件
代码行数估算:
- TypeScript/React: ~5000+ 行
- 测试代码: ~2000+ 行
- 配置文件: ~500 行
```

---

## 14. 依赖分析

### 生产依赖
- electron-store: 本地存储
- papaparse: CSV 解析
- react/react-dom: UI 框架
- uuid: UUID 生成
- xlsx: Excel 处理
- zustand: 状态管理

### 开发依赖
- @playwright/test: E2E 测试
- @testing-library: 组件测试
- concurrently: 并行运行
- electron: 桌面框架
- jsdom: 测试环境
- typescript: 类型检查
- vite: 构建工具
- vitest: 单元测试

---

## 15. 扩展建议

### 15.1 高优先级
1. 添加虚拟滚动处理大数据表
2. 实现 AI 流式响应
3. 优化文件解析内存占用

### 15.2 中优先级
1. 添加数据预览分页
2. 实现操作历史/撤销
3. 添加更多导出格式

### 15.3 低优先级
1. 添加主题切换
2. 实现插件系统
3. 添加协作功能

---

**文档结束**

如需更详细的某部分代码分析，请指定具体文件或模块。
