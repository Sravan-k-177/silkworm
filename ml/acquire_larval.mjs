/** Public browser download of CC BY 4.0 dataset; no login or access-control bypass. */
import {chromium} from '@playwright/test';
import {writeFile,mkdir,appendFile} from 'node:fs/promises';
const url='https://data.mendeley.com/datasets/g4b89vpp9c/1';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/home/sravan/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true});
try{
 const page=await browser.newPage({acceptDownloads:true});
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Network.enable');
 cdp.on('Network.requestWillBeSent',event=>{if(event.redirectResponse&&/file_downloaded|amazonaws|mendeley|s3/.test(event.redirectResponse.url))appendFile('ml/data/larval/redirects.jsonl',JSON.stringify({url:event.redirectResponse.url,status:event.redirectResponse.status,location:event.redirectResponse.headers.location||event.redirectResponse.headers.Location,next:event.request.url})+'\n');});
 await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:process.cwd()+'/ml/data/larval/downloads'});

 await page.goto(url,{waitUntil:'networkidle',timeout:45000});
 const body=await page.locator('body').innerText();
 if(!body.includes('CC BY 4.0'))throw new Error('Publisher license not confirmed');
 await mkdir('ml/data/larval',{recursive:true});
 await writeFile('artifacts/larval-source-page.txt',body);
 console.log(await page.getByRole('link').evaluateAll(els=>els.map(e=>({text:e.textContent,href:e.href})).filter(e=>/download|zip|file/i.test(e.text+' '+e.href))));
 if(await page.getByRole('button',{name:'Accept only necessary cookies',exact:true}).count())await page.getByRole('button',{name:'Accept only necessary cookies',exact:true}).click();
 const [download]=await Promise.all([
  page.waitForEvent('download',{timeout:180000}),
  page.locator('a[href*="file_downloaded"]').click({timeout:15000})
 ]);
 console.log('Downloading',download.suggestedFilename());
 await download.saveAs('ml/data/larval/source.zip');
 const error=await download.failure();if(error)throw new Error(error);
 await writeFile('artifacts/larval-download.json',JSON.stringify({source:url,doi:'10.17632/g4b89vpp9c.1',authors:['Kajal Mungase','Shwetambari Chiwhane'],license:'CC BY 4.0',downloadedAt:new Date().toISOString(),filename:download.suggestedFilename(),url:download.url()},null,2));
 console.log('Download complete');
}finally{await browser.close();}
