import {chromium} from '@playwright/test';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/home/sravan/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1100,height:950}});
 await page.goto('http://127.0.0.1:8787/?demo=1');
 await page.getByText('Backend connected · production frontend running').waitFor();
 for(const name of ['Bring temperature into the confirmed reference range','Bring humidity into the confirmed reference range','Improve ventilation'])await page.getByLabel(name).check();
 if(!(await page.getByText('Checklist comparison:').textContent()).includes('100 → 60'))throw Error('Incorrect scenario');
 await page.screenshot({path:'artifacts/deployed-care-demo.png',fullPage:true});
 console.log('Live frontend, backend health and interactive 100 → 60 scenario verified.');
}finally{await browser.close();}
