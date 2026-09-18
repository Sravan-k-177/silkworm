import {mkdirSync,copyFileSync} from 'node:fs';
mkdirSync('public/runtime',{recursive:true});
for(const name of ['ort-wasm-simd-threaded.wasm','ort-wasm-simd-threaded.mjs'])copyFileSync('node_modules/onnxruntime-web/dist/'+name,'public/runtime/'+name);
