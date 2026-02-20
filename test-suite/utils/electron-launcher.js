#!/usr/bin/env node
/**
 * Electron 应用启动器
 * 用于在无头/有头模式下启动 Electron 应用进行测试
 */

const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

class ElectronLauncher {
  constructor(options = {}) {
    this.electronPath = options.electronPath || path.join(__dirname, '../../node_modules/.bin/electron');
    this.appPath = options.appPath || path.join(__dirname, '../..');
    this.headless = options.headless !== false;
    this.debug = options.debug || false;
    this.process = null;
    this.logs = [];
    this.isReady = false;
  }

  /**
   * 查找可用的调试端口
   */
  async findFreePort(startPort = 9222) {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(startPort, () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
      server.on('error', () => {
        // 端口被占用，尝试下一个
        resolve(this.findFreePort(startPort + 1));
      });
    });
  }

  /**
   * 启动 Electron 应用
   */
  async launch() {
    const port = await this.findFreePort();

    const args = [
      this.appPath,
      '--remote-debugging-port=' + port,
    ];

    if (this.headless) {
      // macOS 无头模式
      args.push('--headless');
    }

    if (this.debug) {
      args.push('--enable-logging');
    }

    // 设置环境变量
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_ENABLE_LOGGING: '1',
      ELECTRON_ENABLE_STACK_DUMPING: '1',
    };

    console.log(`[Launcher] 启动 Electron (port: ${port})...`);

    this.process = spawn(this.electronPath, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // 收集 stdout
    this.process.stdout.on('data', (data) => {
      const line = data.toString();
      this.logs.push({ type: 'stdout', line, time: Date.now() });
      if (this.debug) {
        process.stdout.write(`[Electron] ${line}`);
      }
    });

    // 收集 stderr
    this.process.stderr.on('data', (data) => {
      const line = data.toString();
      this.logs.push({ type: 'stderr', line, time: Date.now() });
      if (this.debug) {
        process.stderr.write(`[Electron:err] ${line}`);
      }
    });

    // 等待应用就绪
    await this.waitForReady(port);

    return {
      port,
      process: this.process,
      logs: this.logs,
    };
  }

  /**
   * 等待应用就绪
   */
  async waitForReady(port, timeout = 30000) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const check = async () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('等待 Electron 启动超时'));
          return;
        }

        try {
          // 检查调试端口是否可用
          const response = await fetch(`http://localhost:${port}/json/version`);
          if (response.ok) {
            this.isReady = true;
            console.log('[Launcher] Electron 已就绪');
            resolve();
            return;
          }
        } catch {
          // 继续等待
        }

        setTimeout(check, 500);
      };

      check();
    });
  }

  /**
   * 关闭 Electron 应用
   */
  async stop() {
    if (!this.process) return;

    console.log('[Launcher] 关闭 Electron...');

    return new Promise((resolve) => {
      // 先尝试优雅关闭
      this.process.kill('SIGTERM');

      const timeout = setTimeout(() => {
        console.log('[Launcher] 强制关闭...');
        this.process.kill('SIGKILL');
        resolve();
      }, 5000);

      this.process.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  /**
   * 获取收集的日志
   */
  getLogs(filter = {}) {
    let logs = this.logs;

    if (filter.type) {
      logs = logs.filter(l => l.type === filter.type);
    }

    if (filter.pattern) {
      const regex = new RegExp(filter.pattern);
      logs = logs.filter(l => regex.test(l.line));
    }

    return logs;
  }

  /**
   * 清空日志
   */
  clearLogs() {
    this.logs = [];
  }
}

// 辅助函数：快速启动
async function launchApp(options = {}) {
  const launcher = new ElectronLauncher(options);
  const result = await launcher.launch();
  return { launcher, ...result };
}

module.exports = {
  ElectronLauncher,
  launchApp,
};
