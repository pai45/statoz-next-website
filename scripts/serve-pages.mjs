import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('out');
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/statoz-next-website';
const port = Number(process.env.CITY_TEST_PORT || 4411);
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.txt':'text/plain', '.xml':'application/xml', '.webmanifest':'application/manifest+json', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.avif':'image/avif', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2', '.wasm':'application/wasm', '.glb':'model/gltf-binary' };
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (basePath && url.pathname === basePath) { response.writeHead(301, { Location: basePath + '/' }); response.end(); return; }
    if (!url.pathname.startsWith(basePath + '/')) throw new Error('Outside site');
    const route = decodeURIComponent(url.pathname.slice(basePath.length));
    let file = path.resolve(root, '.' + route);
    if (!file.startsWith(root + path.sep) && file !== root) throw new Error('Outside export');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/html' });
    response.end(await readFile(path.join(root, '404.html')).catch(() => 'Not found'));
  }
}).listen(port, '127.0.0.1', () => console.log(`Pages preview: http://127.0.0.1:${port}${basePath}/`));
