#!/usr/bin/env node
/**
 * DataClean AI Agent 测试套件入口
 * 用法: npm test 或 node test-suite/index.js
 */

const path = require('path');

// 确保可以导入本地模块
require('module').globalPaths.push(path.join(__dirname, 'utils'));

// 导入测试用例
const extractTest = require('./cases/extract.test');
const hiddenSheetTest = require('./cases/hidden-sheet.test');
const apiTest = require('./cases/api.test');

const tests = [
  extractTest,
  hiddenSheetTest,
  apiTest,
];

async function runAll() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     DataClean AI Agent 测试套件                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\n▶ ${test.name} 测试`);
    console.log('─'.repeat(50));

    try {
      const result = await test.run();
      results.push({ name: test.name, ...result });

      if (result.success) {
        console.log(`✅ 通过: ${result.message}`);
        passed++;
      } else {
        console.log(`❌ 失败: ${result.message}`);
        failed++;
      }
    } catch (error) {
      console.error(`💥 错误: ${error.message}`);
      results.push({ name: test.name, success: false, error: error.message });
      failed++;
    }
  }

  // 汇总
  console.log('\n' + '═'.repeat(50));
  console.log('测试结果汇总');
  console.log('═'.repeat(50));
  console.log(`总计: ${tests.length} 个测试`);
  console.log(`通过: ${passed} ✅`);
  console.log(`失败: ${failed} ❌`);

  if (failed === 0) {
    console.log('\n🎉 所有测试通过！');
  } else {
    console.log(`\n⚠️ 有 ${failed} 个测试失败`);
  }

  return failed === 0;
}

// 运行测试
runAll().then(success => {
  process.exit(success ? 0 : 1);
});
