#!/usr/bin/env node
/**
 * 数据提取功能测试
 * 验证从 Excel 文件中提取数据的完整流程
 */

const path = require('path');
const fs = require('fs');
const { launchApp } = require('../utils/electron-launcher');
const { PageHelper } = require('../utils/page-helper');
const { LogAnalyzer } = require('../utils/log-analyzer');

const TEST_CONFIG = {
  // 测试文件
  testFile: path.join(__dirname, '../../raw/阿里202501.xlsx'),
  // 期望的行数（根据实际文件调整）
  expectedMinRows: 1000,
  // 超时时间
  timeout: 60000,
};

/**
 * 读取测试文件为 ArrayBuffer
 */
function readTestFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/**
 * 主测试函数
 */
async function run(context = {}) {
  console.log('[ExtractTest] 开始数据提取测试');
  console.log(`[ExtractTest] 测试文件: ${TEST_CONFIG.testFile}`);

  // 检查测试文件是否存在
  if (!fs.existsSync(TEST_CONFIG.testFile)) {
    return {
      success: false,
      message: `测试文件不存在: ${TEST_CONFIG.testFile}`,
      details: { fileExists: false }
    };
  }

  let launcher = null;
  let page = null;

  try {
    // 1. 启动应用
    console.log('[ExtractTest] 启动 Electron...');
    const { launcher: l, port } = await launchApp({ headless: true, debug: true });
    launcher = l;

    // 2. 连接到页面
    console.log('[ExtractTest] 连接到页面...');
    page = new PageHelper(port);
    await page.connect();

    // 3. 检查 electronAPI 是否可用
    const hasAPI = await page.checkElectronAPI();
    if (!hasAPI) {
      throw new Error('electronAPI 不可用');
    }
    console.log('[ExtractTest] electronAPI 可用');

    // 4. 使用 IPC 直接保存测试文件
    console.log('[ExtractTest] 保存测试文件...');
    const fileBuffer = fs.readFileSync(TEST_CONFIG.testFile);
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    );

    const tempResult = await page.evaluate(`
      (async () => {
        const buffer = new Uint8Array(${JSON.stringify(Array.from(fileBuffer))}).buffer;
        const result = await window.electronAPI.saveTempFile('test-extract.xlsx', buffer);
        return result;
      })()
    `);

    console.log('[ExtractTest] 保存结果:', tempResult);

    if (!tempResult.success) {
      throw new Error(`保存文件失败: ${tempResult.error}`);
    }

    const filePath = tempResult.path;

    // 5. 读取 Excel sheet 信息
    console.log('[ExtractTest] 读取 Excel sheets...');
    const excelInfo = await page.evaluate(`
      (async () => {
        // 使用 XLSX 读取文件信息
        const XLSX = require('xlsx');
        const workbook = XLSX.readFile('${filePath}');
        return {
          sheetNames: workbook.SheetNames,
          sheets: workbook.SheetNames.map(name => {
            const sheet = workbook.Sheets[name];
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            return {
              name,
              rowCount: json.length - 1, // 减去表头
              hidden: workbook.Workbook?.Sheets?.find(
                (s, i) => workbook.SheetNames[i] === name
              )?.Hidden > 0
            };
          })
        };
      })()
    `);

    console.log('[ExtractTest] Excel 信息:', excelInfo);

    // 6. 找到机票相关的 sheet
    const ticketSheet = excelInfo.sheets.find(s =>
      s.name.includes('机票') || s.name.toLowerCase().includes('flight')
    );

    if (!ticketSheet) {
      console.log('[ExtractTest] 警告: 未找到机票 sheet，使用第一个非隐藏 sheet');
    }

    const targetSheet = ticketSheet || excelInfo.sheets.find(s => !s.hidden);

    if (!targetSheet) {
      throw new Error('没有可用的 sheet');
    }

    console.log(`[ExtractTest] 目标 sheet: ${targetSheet.name} (${targetSheet.rowCount} 行)`);

    // 7. 使用 IPC 读取完整数据
    console.log('[ExtractTest] 读取完整数据...');
    const fullData = await page.callIPC('readExcelSheet', filePath, targetSheet.name);

    console.log('[ExtractTest] 完整数据:', {
      success: fullData.success,
      headers: fullData.data?.headers?.slice(0, 5),
      rowCount: fullData.data?.rowCount,
    });

    if (!fullData.success) {
      throw new Error(`读取 Excel 失败: ${fullData.error}`);
    }

    // 8. 验证数据行数
    const actualRows = fullData.data.rowCount;
    const expectedRows = targetSheet.rowCount;

    console.log(`[ExtractTest] 行数验证: ${actualRows} / ${expectedRows}`);

    // 允许 1% 的误差（可能有一些空行被过滤）
    const rowCountValid = actualRows >= expectedRows * 0.99;

    // 9. 验证表头
    const headers = fullData.data.headers;
    const hasValidHeaders = headers.length > 0 && headers.every(h => typeof h === 'string');

    console.log(`[ExtractTest] 表头验证: ${headers.length} 列, 有效: ${hasValidHeaders}`);

    // 10. 导出 JSON 测试
    console.log('[ExtractTest] 测试导出 JSON...');
    const exportPath = path.join(require('os').tmpdir(), `test-export-${Date.now()}.json`);

    const exportResult = await page.callIPC('exportJSON', fullData.data.rows, exportPath);

    console.log('[ExtractTest] 导出结果:', exportResult);

    // 11. 验证导出的文件
    let exportValid = false;
    if (exportResult.success && fs.existsSync(exportPath)) {
      const exportedData = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
      exportValid = Array.isArray(exportedData) && exportedData.length === actualRows;
      console.log(`[ExtractTest] 导出验证: ${exportedData.length} 行`);

      // 清理临时文件
      fs.unlinkSync(exportPath);
    }

    // 12. 收集测试结果
    const testResults = {
      filePath: filePath,
      sheetName: targetSheet.name,
      headers: headers,
      rowCount: actualRows,
      expectedRowCount: expectedRows,
      rowCountValid,
      hasValidHeaders,
      exportValid,
    };

    // 获取页面日志
    const logs = launcher.getLogs();
    const analyzer = new LogAnalyzer();
    const analysis = analyzer.analyze(logs.map(l => l.line).join('\n'));

    // 判断是否通过
    const passed = rowCountValid && hasValidHeaders && exportValid;

    return {
      success: passed,
      message: passed
        ? `成功提取 ${actualRows} 行数据，${headers.length} 列`
        : `测试失败: 行数=${actualRows}/${expectedRows}, 表头=${hasValidHeaders}, 导出=${exportValid}`,
      details: {
        ...testResults,
        logAnalysis: analysis,
      }
    };

  } catch (error) {
    console.error('[ExtractTest] 错误:', error.message);

    // 尝试获取日志
    let logs = [];
    if (launcher) {
      logs = launcher.getLogs();
    }

    return {
      success: false,
      message: error.message,
      details: {
        error: error.stack,
        logs: logs.slice(-50), // 最后50条日志
      }
    };

  } finally {
    // 清理
    if (page) {
      page.disconnect();
    }
    if (launcher) {
      await launcher.stop();
    }
  }
}

module.exports = { name: 'extract', run };

// 如果直接运行
if (require.main === module) {
  run().then(result => {
    console.log('\n=== 测试结果 ===');
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
