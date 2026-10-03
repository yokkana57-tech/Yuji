// アプリに入れるファイルだけを www/ にコピーする（サーバー側のコードなどは入れない）
import { cpSync, mkdirSync, rmSync } from 'node:fs';
const files = ['index.html', 'app.css', 'app.js', 'geo.js', 'legal.js', 'config.js', 'manifest.webmanifest', 'icons'];
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const f of files) cpSync(f, `www/${f}`, { recursive: true });
console.log('www/ を作りました:', files.join(', '));
