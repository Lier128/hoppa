/**
 * 在无法直连 github.com:443 的网络环境下，通过 GitHub Git Data API 推送整个工作树。
 *
 * 背景：本机 `github.com` 的 443 端口被网络阻断（`api.github.com` 正常），
 * `git push` 会超时，因此改用 API 创建 blob / tree / commit 并更新 main。
 *
 * 用法（PowerShell）：
 *   $env:GH_TOKEN = "<你的 token>"      # 需要 repo + workflow 权限
 *   node scripts/push-to-github.mjs "feat: 更新说明"
 *
 * 也可以直接在有正常网络的环境里 `git push`，本脚本只是备用通道。
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OWNER = process.env.GH_OWNER || 'Lier128';
const REPO = process.env.GH_REPO || 'hoppa';
const BRANCH = process.env.GH_BRANCH || 'main';
const API = 'https://api.github.com';
const token = process.env.GH_TOKEN;

if (!token) {
  console.error('缺少 GH_TOKEN 环境变量（需要 repo + workflow 权限）');
  process.exit(1);
}

const headers = {
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'user-agent': 'hoppa-portfolio-push',
  'x-github-api-version': '2022-11-28',
  'content-type': 'application/json',
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = execSync('git ls-files -z', { cwd: root, maxBuffer: 64 * 1024 * 1024 })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);

const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|pdf|zip|woff2?|ttf|otf|xlsx|docx|pptx)$/i;

function isBinary(path, buffer) {
  if (BINARY_EXT.test(path)) return true;
  return buffer.subarray(0, 8000).includes(0);
}

async function api(pathname, init = {}) {
  const response = await fetch(`${API}${pathname}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(`${init.method || 'GET'} ${pathname} → ${response.status} ${String(text).slice(0, 300)}`);
  }
  return data;
}

async function main() {
  console.log(`files: ${files.length}`);

  // 空仓库不能直接创建 blob/tree（409 Git Repository is empty）：先用 Contents API 建立第一个提交
  let parent;
  try {
    parent = (await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`)).object.sha;
  } catch {
    parent = undefined;
  }
  if (!parent) {
    console.log('empty repo → bootstrap initial commit');
    await api(`/repos/${OWNER}/${REPO}/contents/README.md`, {
      method: 'PUT',
      body: JSON.stringify({
        message: 'chore: initialize repository',
        content: Buffer.from('# HOPPA\n\n初始化提交，随后推送完整代码与文档。\n').toString('base64'),
      }),
    });
    parent = (await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`)).object.sha;
  }

  const entries = [];
  for (const path of files) {
    const buffer = readFileSync(resolve(root, path));
    if (isBinary(path, buffer) || buffer.length > 90_000) {
      const blob = await api(`/repos/${OWNER}/${REPO}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: buffer.toString('base64'), encoding: 'base64' }),
      });
      entries.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
    } else {
      entries.push({ path, mode: '100644', type: 'blob', content: buffer.toString('utf8') });
    }
  }

  const tree = await api(`/repos/${OWNER}/${REPO}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ tree: entries }),
  });

  const message = process.argv[2] || 'chore: update HOPPA portfolio';
  const commit = await api(`/repos/${OWNER}/${REPO}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [parent] }),
  });

  await api(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  console.log('commit', commit.sha);
  console.log('url', `https://github.com/${OWNER}/${REPO}/commit/${commit.sha}`);
}

main().catch((error) => {
  console.error('PUSH_FAILED', error.message);
  process.exit(1);
});
