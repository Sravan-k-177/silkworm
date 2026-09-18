import {chromium} from '@playwright/test';
import {writeFileSync,readFileSync} from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/home/sravan/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:960}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8787/?deep=1');
 const prediction=page.waitForResponse(r=>r.url().endsWith('/api/model/predict'));
 await page.getByLabel('Upload image for backend inference').setInputFiles('artifacts/larval-heldout-parity.png');
 const response=await prediction;if(!response.ok())throw Error('Backend prediction failed');const verified=await page.request.post('http://127.0.0.1:8787/api/model/predict',{headers:{'Content-Type':'image/png'},data:readFileSync('artifacts/larval-heldout-parity.png')});const result=await verified.json();
 await page.getByText('Executed on: backend').waitFor();
 await page.getByText('Class scores and visual evidence',{exact:true}).click();
 await page.screenshot({path:'artifacts/deployed-deep-learning-desktop.png',fullPage:true});
 if(errors.length)throw Error(errors.join('\n'));
 writeFileSync('artifacts/deployed-inference-evidence.json',JSON.stringify({checkedAt:new Date().toISOString(),url:page.url(),fixture:'larval-heldout-parity.png',result},null,2));
 console.log(JSON.stringify({execution:result.execution,label:result.label,inferenceMs:result.inferenceMs,sha256:result.modelSha256}));
}finally{await browser.close();}
