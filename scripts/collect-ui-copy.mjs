import ts from 'typescript';import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const en=JSON.parse(readFileSync('src/locales/en.json','utf8'));
for(const dir of ['src','shared'])for(const name of readdirSync(dir).filter(n=>/\.tsx?$/.test(n)&&n!=='i18n.ts')){
 const s=readFileSync(dir+'/'+name,'utf8'),f=ts.createSourceFile(name,s,99,true,name.endsWith('tsx')?4:3);
 function walk(n){if((ts.isCallExpression(n)||ts.isNewExpression(n))&&n.arguments){const target=n.expression.getText(f);if(['t','Error','setError','setMessage','setNotice','missing.push','warnings.push'].includes(target)){for(const a of n.arguments)if(ts.isStringLiteral(a)&&a.text)en[a.text]=a.text;}}
 if(name==='domain.ts'&&ts.isPropertyAssignment(n)&&n.name.getText(f)==='message'&&ts.isStringLiteral(n.initializer))en[n.initializer.text]=n.initializer.text;
 ts.forEachChild(n,walk);}
 walk(f);
}
writeFileSync('src/locales/en.json',JSON.stringify(en,null,2)+'\n');
const te=JSON.parse(readFileSync('src/locales/te.json','utf8'));console.log(Object.keys(en).filter(k=>!te[k]).join('\n'));
