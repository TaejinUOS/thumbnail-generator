import http from 'node:http';
import { readdir, readFile, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const backgroundRoot = path.join(root, 'background-images');
const publicRoot = path.join(root, 'public');
const extensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.svg': 'image/svg+xml' };

export function createServer() {
  return http.createServer(async (req, res) => {
    const send = (status, body, type = 'text/plain; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(body);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'Method not allowed');
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      if (pathname === '/api/backgrounds') {
        const entries = await readdir(backgroundRoot, { withFileTypes: true });
        const images = entries.filter(entry => entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase()))
          .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
          .map(entry => ({ name: entry.name, url: `/background-images/${encodeURIComponent(entry.name)}` }));
        return send(200, JSON.stringify(images), mime['.json']);
      }
      const isBackground = pathname.startsWith('/background-images/');
      const base = isBackground ? backgroundRoot : publicRoot;
      const relative = isBackground ? pathname.slice('/background-images/'.length) : pathname === '/' ? 'index.html' : pathname.slice(1);
      const target = path.resolve(base, relative);
      const inside = file => { const rel = path.relative(base, file); return rel && !rel.startsWith('..') && !path.isAbsolute(rel); };
      if (!inside(target)) return send(403, 'Forbidden');
      const resolved = await realpath(target);
      if (!inside(resolved)) return send(403, 'Forbidden');
      if (isBackground && !extensions.has(path.extname(resolved).toLowerCase())) return send(403, 'Forbidden');
      if (!(await stat(resolved)).isFile()) return send(404, 'Not found');
      send(200, req.method === 'HEAD' ? undefined : await readFile(resolved), mime[path.extname(resolved).toLowerCase()] || 'application/octet-stream');
    } catch (error) {
      send(error instanceof URIError ? 400 : error.code === 'ENOENT' ? 404 : 500, error instanceof URIError ? 'Bad request' : error.code === 'ENOENT' ? 'Not found' : '파일을 읽지 못했습니다.');
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const server = createServer();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `포트 ${port}이 사용 중입니다. 다른 창에서 실행 중인 생성기를 확인하세요.` : error); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`썸네일 생성기 → http://127.0.0.1:${port}\n종료: Ctrl+C`));
}
