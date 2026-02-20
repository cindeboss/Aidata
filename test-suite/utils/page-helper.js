#!/usr/bin/env node
/**
 * 页面操作封装
 * 通过 Chrome DevTools Protocol 与 Electron 应用交互
 */

const WebSocket = require('ws');

class PageHelper {
  constructor(debugPort) {
    this.port = debugPort;
    this.ws = null;
    this.messageId = 0;
    this.pending = new Map();
  }

  /**
   * 连接到 DevTools 协议
   */
  async connect() {
    // 获取页面列表
    const response = await fetch(`http://localhost:${this.port}/json/list`);
    const pages = await response.json();

    if (pages.length === 0) {
      throw new Error('没有可用的页面');
    }

    // 连接到第一个页面
    const page = pages[0];
    const wsUrl = page.webSocketDebuggerUrl;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('[PageHelper] 已连接到页面');
        resolve();
      });

      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.id && this.pending.has(message.id)) {
          const { resolve, reject } = this.pending.get(message.id);
          this.pending.delete(message.id);

          if (message.error) {
            reject(new Error(message.error.message));
          } else {
            resolve(message.result);
          }
        }
      });

      this.ws.on('error', reject);
    });
  }

  /**
   * 发送 CDP 命令
   */
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.pending.set(id, { resolve, reject });

      this.ws.send(JSON.stringify({
        id,
        method,
        params,
      }));

      // 设置超时
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`命令超时: ${method}`));
        }
      }, 10000);
    });
  }

  /**
   * 执行 JavaScript
   */
  async evaluate(script) {
    const result = await this.send('Runtime.evaluate', {
      expression: script,
      awaitPromise: true,
      returnByValue: true,
    });

    if (result.exceptionDetails) {
      throw new Error(`JS 错误: ${result.exceptionDetails.exception?.description}`);
    }

    return result.result.value;
  }

  /**
   * 等待元素出现
   */
  async waitForSelector(selector, timeout = 10000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const exists = await this.evaluate(`
        document.querySelector('${selector}') !== null
      `);

      if (exists) return true;
      await this.sleep(100);
    }

    throw new Error(`等待元素超时: ${selector}`);
  }

  /**
   * 等待特定文本出现
   */
  async waitForText(text, timeout = 10000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const found = await this.evaluate(`
        document.body.innerText.includes('${text}')
      `);

      if (found) return true;
      await this.sleep(100);
    }

    throw new Error(`等待文本超时: ${text}`);
  }

  /**
   * 点击元素
   */
  async click(selector) {
    await this.evaluate(`
      const el = document.querySelector('${selector}');
      if (el) {
        el.click();
        return true;
      }
      return false;
    `);
  }

  /**
   * 输入文本
   */
  async type(selector, text) {
    await this.evaluate(`
      const el = document.querySelector('${selector}');
      if (el) {
        el.value = '${text.replace(/'/g, "\\'")}';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    `);
  }

  /**
   * 获取元素文本
   */
  async getText(selector) {
    return await this.evaluate(`
      document.querySelector('${selector}')?.innerText || ''
    `);
  }

  /**
   * 检查 store 状态
   */
  async getStoreState() {
    return await this.evaluate(`
      (() => {
        // 尝试从 window 获取 store
        const state = window.__STORE_STATE__ || window.store?.getState?.();
        if (state) return state;

        // 尝试从 React DevTools 获取
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (hook) {
          // 获取 fiber 树查找 store
          const fibers = [];
          hook.renderers.forEach((renderer, id) => {
            const fiber = renderer.findFiberByHostInstance?.(document.body);
            if (fiber) fibers.push(fiber);
          });
          return { fibers: fibers.length };
        }

        return null;
      })()
    `);
  }

  /**
   * 调用 Electron IPC
   */
  async callIPC(method, ...args) {
    const argsJson = JSON.stringify(args).slice(1, -1);
    return await this.evaluate(`
      window.electronAPI?.${method}?.(${argsJson})
    `);
  }

  /**
   * 检查 electronAPI 是否可用
   */
  async checkElectronAPI() {
    return await this.evaluate(`
      !!window.electronAPI
    `);
  }

  /**
   * 获取控制台日志
   */
  async getConsoleLogs() {
    return await this.evaluate(`
      (() => {
        // 尝试获取捕获的日志
        if (window.__CAPTURED_LOGS__) {
          return window.__CAPTURED_LOGS__;
        }
        return [];
      })()
    `);
  }

  /**
   * 截取屏幕截图
   */
  async screenshot(filePath) {
    const result = await this.send('Page.captureScreenshot');
    const buffer = Buffer.from(result.data, 'base64');
    require('fs').writeFileSync(filePath, buffer);
    return filePath;
  }

  /**
   * 等待指定时间
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

module.exports = { PageHelper };
