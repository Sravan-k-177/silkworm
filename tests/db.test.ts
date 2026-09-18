import 'fake-indexeddb/auto';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { db,saveEvent,synchronize } from '../src/db';
const batch={id:'batch-1',name:'Test batch',farm:'F-1',shed:'S-1',tray:'T-1',started:'2026-09-08',initialLarvae:100,species:'Bombyx mori' as const};
afterEach(async()=>{await db.events.clear();await db.settings.clear();vi.unstubAllGlobals();});
describe('offline record synchronization',()=>{
 it('stops a stalled server response without claiming completion',async()=>{
  await saveEvent('batch',batch);const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({accepted:[],events:[],cursor:0,hasMore:false})});vi.stubGlobal('fetch',fetcher);
  await expect(synchronize()).rejects.toThrow('stalled');expect(fetcher).toHaveBeenCalledTimes(1);expect(await db.settings.get('lastSync')).toBeUndefined();expect(await db.events.where('synced').equals(0).count()).toBe(1);
 });
 it('rejects acknowledgement of IDs that were not sent',async()=>{
  await saveEvent('batch',batch);vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({accepted:['foreign-id'],events:[],cursor:1,hasMore:false})}));
  await expect(synchronize()).rejects.toThrow('Invalid acknowledgement');expect(await db.settings.get('cursor')).toBeUndefined();
 });
 it('rejects pagination without cursor progress',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({accepted:[],events:[],cursor:0,hasMore:true})}));await expect(synchronize()).rejects.toThrow('cursor did not advance');
 });
 it('retains unsent records after a network failure',async()=>{await saveEvent('batch',batch);vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));await expect(synchronize()).rejects.toThrow('offline');expect(await db.events.where('synced').equals(0).count()).toBe(1);});
 it('merges acknowledgements and persists cursor',async()=>{const event=await saveEvent('batch',batch);vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({accepted:[event.id],events:[event],cursor:1,hasMore:false})}));await synchronize();expect((await db.events.get(event.id))?.synced).toBe(1);expect((await db.settings.get('cursor'))?.value).toBe('1');});
 it('rejects conflicts without discarding local events',async()=>{const event=await saveEvent('batch',batch);vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({accepted:[event.id],events:[{...event,payload:{...batch,name:'Conflicting name'}}],cursor:1,hasMore:false})}));await expect(synchronize()).rejects.toThrow('Conflicting');expect((await db.events.get(event.id))?.synced).toBe(0);expect(await db.settings.get('cursor')).toBeUndefined();});
});
