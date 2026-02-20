#!/usr/bin/env node
/**
 * IPC API 测试
 * 验证 Electron IPC 通道是否正常工作
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { launchApp } = require('../utils/electron-launcher');
const { PageHelper } = require('../utils/page-helper');

const TEST_CONFIG = {
  timeout: 30000,
};

/**
 * 主测试函数
 */
async function run(context = {}) {
  console.log('[APITest] 开始 IPC API 测试');

  let launcher = null;
  let page = null;

  try {
    // 1. 启动应用
    console.log('[APITest] 启动 Electron...');
    const { launcher: l, port } = await launchApp({ headless: true });
    launcher = l;

    // 2. 连接到页面
    page = new PageHelper(port);
    await page.connect();

    // 3. 测试 electronAPI 存在性
    console.log('[APITest] 检查 electronAPI...');
    const apiExists = await page.evaluate(`typeof window.electronAPI !== 'undefined'`);

    if (!apiExists) {
      throw new Error('window.electronAPI 未定义');
    }

    // 4. 测试各个 IPC 方法
    const testResults = {};

    // 4.1 测试 getUserDataPath
    console.log('[APITest] 测试 getUserDataPath...');
    try {
      const userDataPath = await page.callIPC('getUserDataPath');
      testResults.getUserDataPath = {
        success: typeof userDataPath === 'string' && userDataPath.length > 0,
        path: userDataPath,
      };
    } catch (error) {
      testResults.getUserDataPath = { success: false, error: error.message };
    }

    // 4.2 测试 saveTempFile
    console.log('[APITest] 测试 saveTempFile...');
    try {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const saveResult = await page.evaluate(`
        (async () => {
          const buffer = new Uint8Array(${JSON.stringify(Array.from(testData))}).buffer;
          return await window.electronAPI.saveTempFile('test-api.bin', buffer);
        })()
      `);

      testResults.saveTempFile = {
        success: saveResult.success === true && typeof saveResult.path === 'string',
        path: saveResult.path,
      };

      // 验证文件是否真的保存了
      if (saveResult.success && saveResult.path) {
        testResults.saveTempFile.fileExists = fs.existsSync(saveResult.path);

        // 清理
        if (fs.existsSync(saveResult.path)) {
          fs.unlinkSync(saveResult.path);
        }
      }
    } catch (error) {
      testResults.saveTempFile = { success: false, error: error.message };
    }

    // 4.3 测试 exportJSON
    console.log('[APITest] 测试 exportJSON...');
    try {
      const testData = [{ id: 1, name: 'test' }, { id: 2, name: 'test2' }];
      const exportPath = path.join(os.tmpdir(), `api-test-${Date.now()}.json`);

      const exportResult = await page.callIPC('exportJSON', testData, exportPath);

      testResults.exportJSON = {
        success: exportResult.success === true,
        path: exportResult.path,
      };

      // 验证文件内容
      if (exportResult.success && fs.existsSync(exportPath)) {
        const content = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
        testResults.exportJSON.contentValid = JSON.stringify(content) === JSON.stringify(testData);

        // 清理
        fs.unlinkSync(exportPath);
      }
    } catch (error) {
      testResults.exportJSON = { success: false, error: error.message };
    }

    // 4.4 测试 readExcelSheet（需要测试文件）
    console.log('[APITest] 测试 readExcelSheet...');
    const testFile = path.join(__dirname, '../../raw/阿里202501.xlsx');

    if (fs.existsSync(testFile)) {
      try {
        const fileBuffer = fs.readFileSync(testFile);

        const tempResult = await page.evaluate(`
          (async () => {
            const buffer = new Uint8Array(${JSON.stringify(Array.from(fileBuffer))}).buffer;
            return await window.electronAPI.saveTempFile('api-excel-test.xlsx', buffer);
          })()
        `);

        if (tempResult.success) {
          // 获取 sheet 名称
          const sheetInfo = await page.evaluate(`
            (async () => {
              const XLSX = require('xlsx');
              const workbook = XLSX.readFile('${tempResult.path}');
              return workbook.SheetNames;
            })()
          `);

          if (sheetInfo.length > 0) {
            const readResult = await page.callIPC('readExcelSheet', tempResult.path, sheetInfo[0]);

            testResults.readExcelSheet = {
              success: readResult.success === true,
              hasHeaders: Array.isArray(readResult.data?.headers),
              hasRows: Array.isArray(readResult.data?.rows),
              rowCount: readResult.data?.rowCount,
            };
          } else {
            testResults.readExcelSheet = { success: false, error: '没有可用的 sheet' };
          }

          // 清理
          if (fs.existsSync(tempResult.path)) {
            fs.unlinkSync(tempResult.path);
          }
        }
      } catch (error) {
        testResults.readExcelSheet = { success: false, error: error.message };
      }
    } else {
      testResults.readExcelSheet = { success: false, skipped: true, reason: '测试文件不存在' };
    }

    // 5. 汇总结果
    const allTests = Object.entries(testResults);
    const passedTests = allTests.filter(([_, result]) => result.success);
    const failedTests = allTests.filter(([_, result]) => !result.success && !result.skipped);

    console.log('[APITest] 测试结果:', {
      total: allTests.length,
      passed: passedTests.length,
      failed: failedTests.length,
    });

    const allPassed = failedTests.length === 0;

    return {
      success: allPassed,
      message: allPassed
        ? `所有 ${allTests.length} 个 API 测试通过`
        : `${failedTests.length}/${allTests.length} 个测试失败: ${failedTests.map(([name]) => name).join(', ')}`,
      details: testResults,
    };

  } catch (error) {
    console.error('[APITest] 错误:', error.message);
    return {
      success: false,
      message: error.message,
      details: { error: error.stack }
    };

  } finally {
    if (page) page.disconnect();
    if (launcher) await launcher.stop();
  }
}

module.exports = { name: 'api', run };

// 如果直接运行
if (require.main === module) {
  run().then(result => {
    console.log('\n=== 测试结果 ===');
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
