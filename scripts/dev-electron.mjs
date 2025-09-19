#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import process from 'node:process';

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

function startRenderer() {
  const args = ['run', 'dev', '--', '--host'];
  return spawn(npmCommand, args, { stdio: 'inherit', env: process.env });
}

async function waitForRenderer(url, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok || response.status === 404) {
        return;
      }
    } catch {
      // swallow errors while the dev server is booting
    }
    await wait(500);
  }
  throw new Error(`Timed out waiting for dev server at ${url}`);
}

async function startElectron() {
  const electronModule = await import('electron');
  const electronPath = electronModule.default || electronModule;
  const env = { ...process.env, VITE_DEV_SERVER_URL: DEV_SERVER_URL, NODE_ENV: 'development' };
  return spawn(electronPath, ['.'], { stdio: 'inherit', env });
}

async function main() {
  const renderer = startRenderer();

  renderer.on('exit', (code) => {
    if (code !== 0) {
      console.error('Renderer process exited unexpectedly.');
      process.exit(code ?? 1);
    }
  });

  try {
    await waitForRenderer(DEV_SERVER_URL);
  } catch (error) {
    console.error(error.message);
    renderer.kill();
    process.exit(1);
  }

  const electronProcess = await startElectron();

  const shutdown = (code = 0) => {
    electronProcess?.kill();
    renderer?.kill();
    process.exit(code);
  };

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  electronProcess.on('exit', (code) => {
    shutdown(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
