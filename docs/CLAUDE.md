# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DataClean AI is an AI-native data cleaning desktop application built with Electron + React + TypeScript. It features an infinite canvas with semantic zooming, file cards with drag-and-drop, data flow visualization, and an AI conversation panel for collaborative data processing.

## Development Commands

```bash
# Development (runs Vite dev server and Electron)
npm run electron:dev

# Build for production
npm run build

# Run tests
npm test

# Run tests with watch mode
npm test -- --watch

# Run a single test file
npm test -- tests/fileParser.test.ts

# Run tests matching a pattern
npm test -- -t "should parse CSV"

# Lint
npm run lint

# Preview production build
npm run preview
```

## Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Desktop**: Electron 28 with context isolation
- **State Management**: Zustand with persistence
- **File Parsing**: SheetJS (xlsx) + PapaParse (CSV)
- **Testing**: Vitest + jsdom + @testing-library/react

### IPC Architecture

The Electron main process (`electron/main.ts`) exposes APIs to the renderer via a preload script (`electron/preload.ts`). Key IPC handlers:

- `dialog:openFile` / `dialog:saveFile` - File dialogs
- `file:read` / `file:write` - File system operations
- `ai:call` - AI API calls (bypasses CORS by using Node's http/https modules)

The preload script exposes `window.electronAPI` for renderer access.

### AI Service Architecture

The AI service (`src/utils/aiService.ts`) supports multiple providers:
- **kimi-coding** (default): Anthropic-compatible API at api.kimi.com/coding
- **kimi**: Moonshot AI API
- **zhipu**: Zhipu GLM API
- **openai**: OpenAI API
- **anthropic**: Anthropic API
- **local**: Mock responses for testing

In Electron, AI calls go through `electronAPI.callAI()` to bypass browser CORS. In browser mode, it uses standard fetch.

### File Parsing Architecture

The file parser (`src/utils/fileParser.ts`) handles:
- CSV via PapaParse
- Excel via SheetJS with raw cell data extraction for AI analysis
- JSON array/object parsing

For Excel files, it extracts both structured data (for display) and raw cell data including merge information (for AI table structure analysis).

### State Management

Zustand store (`src/store/useStore.ts`) manages:
- Files with sheet metadata and sample rows
- Data flows between files
- AI conversation messages
- Canvas state (scale, pan, selection mode)
- AI configuration (provider, API key)

State is persisted to localStorage except for loading/error states.

### Type System

Core types (`src/types/index.ts`):
- `DataFile`: File with multiple sheets, position on canvas
- `SheetInfo`: Headers, column types, sample rows, optional raw data
- `RawSheetData`: Cell data + merge ranges for AI analysis
- `TableStructureAnalysis`: AI-analyzed table structure (header row, field hierarchy)
- `DataFlow`: Connections between files

## Development Guidelines

### Testing and Verification Requirement

**所有代码修改必须经过测试验证，禁止未经测试直接提交。**

- 修改后必须运行相关测试确保通过
- 对于 UI 修改，必须通过截图或实际验证确认效果
- 对于逻辑修改，必须运行单元测试和集成测试
- 尽可能使用工具自动验证，减少对用户的手动测试依赖
- 如需要特殊权限或环境才能测试，可向用户申请
- 测试不通过时，必须修复后再提交，禁止绕过测试

测试命令：
```bash
# TypeScript 编译检查
npx tsc --noEmit

# 单元测试
npm run test:unit

# 集成测试
npm run test:integration

# 诊断测试
npm run test:diagnose

# Electron 构建测试
npm run build:electron
```

### Preserving Working Parameters

**重要**: 非必要情况下，不要改变原有生效的参数和配置。不要"顺手"修改代码中的数值、阈值或配置：
- 避免在修复一个 bug 时顺手"优化"其他不相关的代码

如果不确定某个参数是否应该修改，请先询问用户。

### No Mocking Policy

**默认情况下，所有功能必须实现真实的逻辑，禁止使用模拟/占位代码。**

- 禁止提交临时性的 `console.log`、注释掉的代码或 `// TODO: implement` 标记
- 如果需要调用外部服务（如 AI API），确保有真实的调用逻辑，而不是返回硬编码的响应
- 如果某个功能暂时无法实现，需要显式告知用户并说明原因，而不是假装已实现
- 只有在用户明确同意的情况下，才可以使用模拟数据（如用于原型演示）

### Hidden Sheets Policy

**数据处理时，默认排除隐藏的 sheet，除非用户特别指明要处理。**

- 分析、提取、转换等操作默认只处理可见的 sheet
- 如果用户提到"包括隐藏的"或"所有 sheet"，才处理隐藏的 sheet
- 在结果中说明处理/排除了哪些 sheet

## Key Implementation Notes

### Table Structure Analysis

Excel files with complex headers (merged cells, multi-row headers) are analyzed by AI. The `analyzeTableStructure` function sends the first 20 rows of raw cell data to the AI, which returns a JSON structure identifying:
- `sheetType`: 'standard' | 'irregular' | 'unknown'
- `headerRow`: Which row contains the actual headers
- `fieldHierarchy`: Tree structure for nested headers

### Canvas System

The canvas uses a zoom/pan system with scale factor (default 0.8). File cards are positioned absolutely and can be dragged. Alignment lines appear when dragging cards near each other.

### CORS Handling

AI API calls in Electron use the main process's `https`/`http` modules instead of fetch to avoid CORS restrictions. The `ai:call` IPC handler makes the request and returns the response.
