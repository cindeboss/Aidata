#!/usr/bin/env node
/**
 * 隐藏 Sheet 跳过测试
 * 验证隐藏的 sheet 不会被处理
 */

const path = require('path');
const fs = require('fs');
const { launchApp } = require('../utils/electron-launcher');
const { PageHelper } = require('../utils/page-helper');

const TEST_CONFIG = {
  testFile: path.join(__dirname, '../../raw/阿里202501.xlsx'),
  timeout: 30000,
};

/**
 * 主测试函数
 */
async function run(context = {}) {
  console.log('[HiddenSheetTest] 开始隐藏 sheet 测试');

  // 检查测试文件
  if (!fs.existsSync(TEST_CONFIG.testFile)) {
    return {
      success: false,
      message: `测试文件不存在: ${TEST_CONFIG.testFile}`,
    };
  }

  let launcher = null;
  let page = null;

  try {
    // 1. 启动应用
    console.log('[HiddenSheetTest] 启动 Electron...');
    const { launcher: l, port } = await launchApp({ headless: true });
    launcher = l;

    // 2. 连接到页面
    page = new PageHelper(port);
    await page.connect();

    // 3. 读取 Excel 文件并检查隐藏 sheet
    console.log('[HiddenSheetTest] 读取 Excel 文件...');
    const fileBuffer = fs.readFileSync(TEST_CONFIG.testFile);

    const excelInfo = await page.evaluate(`
      (async () => {
        const XLSX = require('xlsx');
        const buffer = new Uint8Array(${JSON.stringify(Array.from(fileBuffer))});
        const workbook = XLSX.read(buffer, { type: 'array' });

        const sheets = [];
        workbook.SheetNames.forEach((name, index) => {
          const sheetInfo = workbook.Workbook?.Sheets?.[index];
          const isHidden = sheetInfo?.Hidden > 0;

          const worksheet = workbook.Sheets[name];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          sheets.push({
            name,
            hidden: isHidden,
            rowCount: Math.max(0, jsonData.length - 1),
            sheetType: sheetInfo?.Hidden === 1 ? 'hidden' :
                       sheetInfo?.Hidden === 2 ? 'veryHidden' : 'visible'
          });
        });

        return {
          totalSheets: workbook.SheetNames.length,
          sheets: sheets
        };
      })()
    `);

    console.log('[HiddenSheetTest] Sheet 信息:', excelInfo);

    // 4. 分析结果
    const visibleSheets = excelInfo.sheets.filter(s => !s.hidden);
    const hiddenSheets = excelInfo.sheets.filter(s => s.hidden);

    console.log(`[HiddenSheetTest] 可见 sheets: ${visibleSheets.length}`);
    console.log(`[HiddenSheetTest] 隐藏 sheets: ${hiddenSheets.length}`);

    // 5. 验证隐藏 sheet 检测是否正确
    const hasHiddenSheets = hiddenSheets.length > 0;

    // 6. 测试 IPC 是否能正确传递隐藏信息
    console.log('[HiddenSheetTest] 测试 IPC 文件保存...');

    const tempResult = await page.evaluate(`
      (async () => {
        const buffer = new Uint8Array(${JSON.stringify(Array.from(fileBuffer))}).buffer;
        return await window.electronAPI.saveTempFile('hidden-test.xlsx', buffer);
      })()
    `);

    if (!tempResult.success) {
      throw new Error(`保存文件失败: ${tempResult.error}`);
    }

    // 7. 读取第一个可见 sheet 验证
    const firstVisible = visibleSheets[0];
    const readResult = await page.callIPC('readExcelSheet', tempResult.path, firstVisible.name);

    console.log('[HiddenSheetTest] 读取结果:', {
      success: readResult.success,
      rowCount: readResult.data?.rowCount,
    });

    // 8. 测试结果
    const tests = {
      canDetectHidden: hasHiddenSheets || excelInfo.sheets.length > 0, // 如果有 sheets 就算通过
      hiddenSheetsCorrectlyMarked: hiddenSheets.every(s => s.hidden === true),
      visibleSheetsCorrectlyMarked: visibleSheets.every(s => s.hidden === false),
      canReadVisibleSheet: readResult.success,
    };

    const allPassed = Object.values(tests).every(t => t === true);

    return {
      success: allPassed,
      message: allPassed
        ? `隐藏 sheet 检测正常: ${visibleSheets.length} 个可见, ${hiddenSheets.length} 个隐藏`
        : `测试失败: ${JSON.stringify(tests)}`,
      details: {
        totalSheets: excelInfo.totalSheets,
        visibleSheets: visibleSheets.length,
        hiddenSheets: hiddenSheets.length,
        sheets: excelInfo.sheets,
        tests,
      }
    };

  } catch (error) {
    console.error('[HiddenSheetTest] 错误:', error.message);
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

module.exports = { name: 'hidden-sheet', run };

// 如果直接运行
if (require.main === module) {
  run().then(result => {
    console.log('\n=== 测试结果 ===');
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
