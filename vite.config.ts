import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
export default defineConfig({plugins:[react(),{name:'offline-shell',generateBundle(_options,bundle){
 const publicFiles=readdirSync('public',{recursive:true,withFileTypes:true}).filter(f=>f.isFile()).map(f=>(f.parentPath+'/'+f.name).replace(/^public/,'')).sort();
 const files=['/','/index.html',...Object.keys(bundle).map(f=>'/'+f),...publicFiles];
 const hash=createHash('sha256').update(JSON.stringify(files));
 for(const file of publicFiles)hash.update(readFileSync('public'+file));
 const version=hash.digest('hex').slice(0,12);
 this.emitFile({type:'asset',fileName:'sw.js',source:`const CACHE='silksense-${version}';const FILES=${JSON.stringify(files)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('silksense-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/'))return;if(e.request.mode==='navigate'){e.respondWith(caches.match('/index.html').then(r=>r||fetch(e.request)));return;}if(FILES.includes(url.pathname))e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});`});
 }}],server:{proxy:{'/api':'http://127.0.0.1:8787'}},build:{target:'es2022',rollupOptions:{output:{manualChunks(id){if(id.includes('/node_modules/')&&!id.includes('/onnxruntime-web/'))return 'vendor';}}}}});
