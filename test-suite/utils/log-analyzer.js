#!/usr/bin/env node
/**
 * 日志分析器
 * 分析 [Agent] 日志，提取关键信息和错误模式
 */

class LogAnalyzer {
  constructor() {
    // 定义问题模式
    this.patterns = {
      // 数据行数相关
      rowCount: {
        extracted: /\[Agent\] Final extracted rows:\s*(\d+)/,
        fromIPC: /\[Agent\] Full data from IPC.*rowCount:\s*(\d+)/,
        afterSlice: /\[Agent\] After slice\/processing.*dataRows count:\s*(\d+)/,
      },
      // 数据结构相关
      dataStructure: {
        headers: /\[Agent\] (?:Using AI analysis|Using original headers).*fields:\s*\[([^\]]+)\]/,
        dataStartRow: /\[Agent\] Using AI analysis.*dataStartRow:\s*(\d+)/,
      },
      // 错误相关
      errors: {
        filePathMissing: /无法读取完整数据：文件路径不可用/,
        ipcError: /读取 Excel 失败/,
        extractionFailed: /提取失败/,
        dataStartRowTooLarge: /dataStartRow too large/,
      },
      // 流程相关
      flow: {
        readingExcel: /\[Agent\] Reading Excel sheet:/,
        usingAI: /\[Agent\] Using AI analysis:/,
        usingOriginal: /\[Agent\] Using original headers/,
        extractionComplete: /\[Agent\] Extraction complete:/,
      }
    };
  }

  /**
   * 分析日志内容
   */
  analyze(logs) {
    const text = typeof logs === 'string' ? logs : logs.join('\n');
    const result = {
      rowCounts: {},
      dataStructure: {},
      errors: [],
      flow: [],
      summary: {
        success: false,
        extractedRows: 0,
        expectedRows: 0,
        issues: []
      }
    };

    // 提取行数信息
    const extractedMatch = text.match(this.patterns.rowCount.extracted);
    if (extractedMatch) {
      result.rowCounts.extracted = parseInt(extractedMatch[1]);
      result.summary.extractedRows = result.rowCounts.extracted;
    }

    const ipcMatch = text.match(this.patterns.rowCount.fromIPC);
    if (ipcMatch) {
      result.rowCounts.fromIPC = parseInt(ipcMatch[1]);
      result.summary.expectedRows = result.rowCounts.fromIPC;
    }

    const afterSliceMatch = text.match(this.patterns.rowCount.afterSlice);
    if (afterSliceMatch) {
      result.rowCounts.afterSlice = parseInt(afterSliceMatch[1]);
    }

    // 提取数据结构信息
    const dataStartRowMatch = text.match(this.patterns.dataStructure.dataStartRow);
    if (dataStartRowMatch) {
      result.dataStructure.dataStartRow = parseInt(dataStartRowMatch[1]);
    }

    // 检查错误
    for (const [name, pattern] of Object.entries(this.patterns.errors)) {
      if (pattern.test(text)) {
        result.errors.push(name);
        result.summary.issues.push(name);
      }
    }

    // 检查流程
    for (const [name, pattern] of Object.entries(this.patterns.flow)) {
      if (pattern.test(text)) {
        result.flow.push(name);
      }
    }

    // 判断成功
    result.summary.success = result.flow.includes('extractionComplete') &&
                             result.errors.length === 0;

    return result;
  }

  /**
   * 比较期望和实际的行数
   */
  compareRowCounts(expected, actual, tolerance = 0.05) {
    const diff = Math.abs(expected - actual);
    const diffPercent = diff / expected;

    return {
      expected,
      actual,
      diff,
      diffPercent,
      match: diffPercent <= tolerance,
      significantDifference: diffPercent > 0.1 // 10% 差异视为显著
    };
  }

  /**
   * 生成诊断报告
   */
  generateDiagnosis(analysis) {
    const diagnosis = [];

    // 检查行数问题
    if (analysis.rowCounts.fromIPC && analysis.rowCounts.extracted) {
      const comparison = this.compareRowCounts(
        analysis.rowCounts.fromIPC,
        analysis.rowCounts.extracted
      );

      if (comparison.significantDifference) {
        diagnosis.push({
          type: 'warning',
          issue: 'ROW_COUNT_MISMATCH',
          message: `行数不匹配：IPC读取 ${comparison.expected} 行，但只提取了 ${comparison.actual} 行`,
          suggestion: '检查 dataStartRow 设置或表头识别逻辑'
        });
      }
    }

    // 检查 dataStartRow 问题
    if (analysis.dataStructure.dataStartRow > 0) {
      if (analysis.rowCounts.afterSlice && analysis.rowCounts.fromIPC) {
        const expectedAfterSlice = analysis.rowCounts.fromIPC - analysis.dataStructure.dataStartRow;
        const actualDiff = Math.abs(expectedAfterSlice - analysis.rowCounts.afterSlice);

        if (actualDiff > 10) {
          diagnosis.push({
            type: 'warning',
            issue: 'DATA_START_ROW_INCORRECT',
            message: `dataStartRow (${analysis.dataStructure.dataStartRow}) 可能导致数据丢失`,
            suggestion: '验证 AI 分析的 dataStartRow 是否正确'
          });
        }
      }
    }

    // 检查错误
    if (analysis.errors.includes('filePathMissing')) {
      diagnosis.push({
        type: 'error',
        issue: 'FILE_PATH_MISSING',
        message: '文件路径未保存，无法读取完整数据',
        suggestion: '检查 App.tsx 中的 saveTempFile 调用和 path 保存逻辑'
      });
    }

    if (analysis.errors.includes('ipcError')) {
      diagnosis.push({
        type: 'error',
        issue: 'IPC_ERROR',
        message: 'IPC 调用失败',
        suggestion: '检查 electron/main.ts 中的 excel:readSheet handler'
      });
    }

    return diagnosis;
  }

  /**
   * 从文件读取并分析日志
   */
  analyzeFile(logPath) {
    const fs = require('fs');
    if (!fs.existsSync(logPath)) {
      return { error: '日志文件不存在', path: logPath };
    }

    const content = fs.readFileSync(logPath, 'utf-8');
    const analysis = this.analyze(content);
    analysis.diagnosis = this.generateDiagnosis(analysis);

    return analysis;
  }
}

module.exports = { LogAnalyzer };
