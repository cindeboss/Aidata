// 统一错误处理模块
// 提供结构化错误码、用户友好提示和恢复建议

// 错误码定义
export enum ErrorCode {
  // 文件相关错误 (1xx)
  FILE_NOT_FOUND = 'FILE_001',
  FILE_TOO_LARGE = 'FILE_002',
  FILE_FORMAT_INVALID = 'FILE_003',
  FILE_READ_ERROR = 'FILE_004',
  FILE_PATH_MISSING = 'FILE_005',

  // 数据相关错误 (2xx)
  DATA_EMPTY = 'DATA_001',
  DATA_PARSE_ERROR = 'DATA_002',
  SHEET_NOT_FOUND = 'DATA_003',
  TARGET_NOT_FOUND = 'DATA_004',

  // AI 相关错误 (3xx)
  AI_API_KEY_MISSING = 'AI_001',
  AI_API_CALL_FAILED = 'AI_002',
  AI_RATE_LIMIT = 'AI_003',
  AI_TIMEOUT = 'AI_004',
  AI_RESPONSE_INVALID = 'AI_005',

  // Agent 相关错误 (4xx)
  AGENT_INTENT_UNKNOWN = 'AGENT_001',
  AGENT_EXECUTION_FAILED = 'AGENT_002',
  AGENT_BUDGET_EXCEEDED = 'AGENT_003',

  // 系统相关错误 (5xx)
  SYSTEM_ELECTRON_UNAVAILABLE = 'SYS_001',
  SYSTEM_IPC_FAILED = 'SYS_002',
  SYSTEM_UNKNOWN = 'SYS_999'
}

// 错误详情接口
export interface ErrorDetail {
  code: ErrorCode
  message: string
  userMessage: string  // 给用户看的友好提示
  suggestion: string   // 恢复建议
  recoverable: boolean // 是否可恢复
}

// 错误工厂函数
export function createError(
  code: ErrorCode,
  details?: Record<string, any>
): ErrorDetail {
  const errorMap: Record<ErrorCode, Omit<ErrorDetail, 'code'>> = {
    [ErrorCode.FILE_NOT_FOUND]: {
      message: '文件不存在',
      userMessage: `找不到文件 "${details?.fileName || '未知'}"，请检查文件是否被移动或删除。`,
      suggestion: '请重新上传文件，或检查文件路径是否正确。',
      recoverable: true
    },
    [ErrorCode.FILE_TOO_LARGE]: {
      message: '文件过大',
      userMessage: `文件 "${details?.fileName}" 太大 (${details?.size}MB)，超过限制 ${details?.limit}MB。`,
      suggestion: '请压缩文件、分批处理，或联系管理员放宽限制。',
      recoverable: false
    },
    [ErrorCode.FILE_FORMAT_INVALID]: {
      message: '文件格式不支持',
      userMessage: `不支持的文件格式 "${details?.format}"。`,
      suggestion: '请上传 CSV、Excel (.xlsx/.xls) 或 JSON 格式的文件。',
      recoverable: false
    },
    [ErrorCode.FILE_READ_ERROR]: {
      message: '文件读取失败',
      userMessage: `无法读取文件 "${details?.fileName}"，文件可能已损坏。`,
      suggestion: '请检查文件是否完整，尝试用 Excel 打开后重新保存。',
      recoverable: true
    },
    [ErrorCode.FILE_PATH_MISSING]: {
      message: '文件路径缺失',
      userMessage: '文件路径不可用，可能是拖拽上传的问题。',
      suggestion: '请重新上传文件，或刷新页面后重试。',
      recoverable: true
    },

    [ErrorCode.DATA_EMPTY]: {
      message: '数据为空',
      userMessage: `"${details?.sheetName}" 没有数据可处理。`,
      suggestion: '请检查文件内容是否为空，或选择其他 sheet。',
      recoverable: false
    },
    [ErrorCode.DATA_PARSE_ERROR]: {
      message: '数据解析失败',
      userMessage: '解析数据时出错，可能是格式不兼容。',
      suggestion: '请检查文件格式是否正确，或尝试先另存为标准 Excel 格式。',
      recoverable: true
    },
    [ErrorCode.SHEET_NOT_FOUND]: {
      message: 'Sheet 不存在',
      userMessage: `找不到 sheet "${details?.sheetName}"。`,
      suggestion: `可用的 sheets: ${details?.availableSheets?.join(', ') || '请检查文件名'}`,
      recoverable: false
    },
    [ErrorCode.TARGET_NOT_FOUND]: {
      message: '未找到目标数据',
      userMessage: `未找到 "${details?.target}" 相关数据。`,
      suggestion: `可用数据类型: ${details?.availableTargets?.join(', ') || '机票、酒店、火车、用车、对账单'}，请检查关键词是否正确。`,
      recoverable: false
    },

    [ErrorCode.AI_API_KEY_MISSING]: {
      message: 'API Key 未配置',
      userMessage: `未配置 ${details?.provider} 的 API Key。`,
      suggestion: '请在设置面板中配置 API Key，或切换到本地模式使用。',
      recoverable: true
    },
    [ErrorCode.AI_API_CALL_FAILED]: {
      message: 'AI API 调用失败',
      userMessage: '调用 AI 服务失败，可能是网络问题或服务不可用。',
      suggestion: '请检查网络连接，稍后重试，或切换到本地模式。',
      recoverable: true
    },
    [ErrorCode.AI_RATE_LIMIT]: {
      message: 'AI 请求频率超限',
      userMessage: '请求太频繁，已达到速率限制。',
      suggestion: `请等待 ${details?.retryAfter || '几分钟'} 后重试，或切换到本地模式。`,
      recoverable: true
    },
    [ErrorCode.AI_TIMEOUT]: {
      message: 'AI 请求超时',
      userMessage: 'AI 服务响应超时，可能是请求太复杂。',
      suggestion: '请尝试减少文件大小或分批处理，或切换到本地模式。',
      recoverable: true
    },
    [ErrorCode.AI_RESPONSE_INVALID]: {
      message: 'AI 响应格式无效',
      userMessage: 'AI 返回的数据格式不正确。',
      suggestion: '已切换到备用方案，如果问题持续请反馈给开发者。',
      recoverable: true
    },

    [ErrorCode.AGENT_INTENT_UNKNOWN]: {
      message: '无法识别用户意图',
      userMessage: '无法理解您的指令，请说得更明确一些。',
      suggestion: '您可以尝试："提取机票数据"、"分析数据质量"、"导出为 JSON"。',
      recoverable: true
    },
    [ErrorCode.AGENT_EXECUTION_FAILED]: {
      message: 'Agent 执行失败',
      userMessage: '执行指令时出错。',
      suggestion: details?.suggestion || '请检查文件是否正确上传，或尝试重新操作。',
      recoverable: true
    },
    [ErrorCode.AGENT_BUDGET_EXCEEDED]: {
      message: '超出处理限制',
      userMessage: `处理超出限制：${details?.limitType} (${details?.current}/${details?.max})。`,
      suggestion: '请减少文件数量或分批处理，或联系管理员放宽限制。',
      recoverable: false
    },

    [ErrorCode.SYSTEM_ELECTRON_UNAVAILABLE]: {
      message: 'Electron 环境不可用',
      userMessage: '文件操作功能在当前环境不可用。',
      suggestion: '请使用桌面版应用，或刷新页面后重试。',
      recoverable: false
    },
    [ErrorCode.SYSTEM_IPC_FAILED]: {
      message: 'IPC 通信失败',
      userMessage: '与系统通信失败，可能是 Electron 主进程问题。',
      suggestion: '请重启应用，或检查是否有杀毒软件阻止了进程通信。',
      recoverable: true
    },
    [ErrorCode.SYSTEM_UNKNOWN]: {
      message: '未知系统错误',
      userMessage: '发生未知错误，请稍后重试。',
      suggestion: '如果问题持续，请截图并反馈给开发者。',
      recoverable: false
    }
  }

  const template = errorMap[code] || errorMap[ErrorCode.SYSTEM_UNKNOWN]

  return {
    code,
    ...template
  }
}

// Agent 结果工厂
export function createAgentResult(
  success: boolean,
  message: string,
  data?: any
): { success: boolean; message: string; data?: any } {
  return { success, message, data }
}

// 错误结果工厂
export function createErrorResult(
  code: ErrorCode,
  details?: Record<string, any>
): { success: false; message: string; errorCode: ErrorCode; recoverable: boolean } {
  const error = createError(code, details)
  return {
    success: false,
    message: `${error.userMessage}\n\n💡 ${error.suggestion}`,
    errorCode: code,
    recoverable: error.recoverable
  }
}

// 从异常创建错误
export function createErrorFromException(
  error: unknown,
  defaultCode: ErrorCode = ErrorCode.SYSTEM_UNKNOWN
): { success: false; message: string; errorCode: ErrorCode; recoverable: boolean } {
  const message = error instanceof Error ? error.message : String(error)

  // 根据错误消息推断错误码
  if (message.includes('API Key') || message.includes('api key')) {
    return createErrorResult(ErrorCode.AI_API_KEY_MISSING)
  }
  if (message.includes('timeout') || message.includes('超时')) {
    return createErrorResult(ErrorCode.AI_TIMEOUT)
  }
  if (message.includes('rate limit') || message.includes('限速')) {
    return createErrorResult(ErrorCode.AI_RATE_LIMIT)
  }
  if (message.includes('not found') || message.includes('找不到')) {
    return createErrorResult(ErrorCode.FILE_NOT_FOUND, { fileName: message })
  }

  return createErrorResult(defaultCode, { originalError: message })
}

// 日志记录
export function logError(
  code: ErrorCode,
  error: unknown,
  context?: Record<string, any>
): void {
  console.error(`[Error] ${code}:`, {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString()
  })
}
