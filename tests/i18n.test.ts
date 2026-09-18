import {describe,it,expect} from 'vitest';
import en from '../src/locales/en.json';
import te from '../src/locales/te.json';
import i18n,{t} from '../src/i18n';
describe('Telugu catalogue',()=>{
 it('covers all catalogued copy and retains interpolation values',()=>{for(const [key,text]of Object.entries(en)){expect(Object.hasOwn(te,key),key).toBe(true);const translated=(te as Record<string,string>)[key];expect(translated.trim(),key).not.toBe('');expect([...translated.matchAll(/{{(.*?)}}/g)].map(x=>x[1]).sort(),key).toEqual([...text.matchAll(/{{(.*?)}}/g)].map(x=>x[1]).sort());}});
 it('translates stored care evidence without changing measurements',async()=>{await i18n.changeLanguage('te');expect(t('Temperature 29°C is outside 23–24°C')).toContain('ఉష్ణోగ్రత 29°C');expect(t('Temperature 29°C is outside 23–24°C')).toContain('23–24°C');expect(t('Shell weight cannot exceed whole cocoon weight.')).toContain('పట్టు పొర');expect(t('Private farm name')).toBe('Private farm name');await i18n.changeLanguage('en');});
});
