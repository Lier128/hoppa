/**
 * 构建包装器：把 esbuild 的临时目录指到项目内 .tmp。
 *
 * 原因：本机 %TEMP% 下 esbuild 完成转译后清理临时文件会被系统拒绝
 * （`[vite:esbuild-transpile] remove ... Access is denied`），导致 `vite build` 失败。
 * 这是运行环境问题而不是代码问题；把 TEMP/TMP 限定在项目内即可稳定构建，
 * 对 CI（Ubuntu）没有副作用，也不会影响其它命令。
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = resolve(root, '.tmp');
mkdirSync(tmpDir, { recursive: true });

const viteBin = resolve(root, 'node_modules', 'vite', 'bin', 'vite.js');
const child = spawn(process.execPath, [viteBin, 'build', ...process.argv.slice(2)], {
  cwd: root,
  env: { ...process.env, TEMP: tmpDir, TMP: tmpDir },
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`build terminated by signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
