import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const module={exports:{}};
vm.runInNewContext(compile(await readFile(new URL('../src/localDaylight.ts',import.meta.url),'utf8')),{module,exports:module.exports,Date});
const {daylightAtHour,localDaylight}=module.exports;
test('local atmosphere uses device hours and needs neither coordinates nor a weather response',()=>{
  const date=new Date(2026,9,13,18,45);
  assert.equal(localDaylight(date).hour,18.75);
  assert.equal(localDaylight(date).dark,true);
  assert.equal(daylightAtHour(6).phase,'dawn');
  assert.equal(daylightAtHour(12).phase,'day');
  assert.equal(daylightAtHour(17.75).phase,'sunset');
  assert.equal(daylightAtHour(23).phase,'night');
  assert.deepEqual(daylightAtHour(-1),daylightAtHour(23));
  assert.deepEqual(daylightAtHour(24),daylightAtHour(0));
  assert.deepEqual(daylightAtHour(NaN),daylightAtHour(12));
});
test('the complete day is finite, continuous, periodic, and darker at night',()=>{
  for(let minute=0;minute<1440;minute++){
    const a=daylightAtHour(minute/60),b=daylightAtHour((minute+1)/60);
    assert.ok(a.night>=0&&a.night<=1);
    for(const field of ['sunIntensity','ambient','reflection']){
      assert.ok(Number.isFinite(a[field])&&a[field]>0);
      assert.ok(Math.abs(a[field]-b[field])<.1);
    }
    for(const color of [a.sky,a.ground,a.sun,...a.backdrop])assert.match(color,/^#[0-9a-f]{6}$/);
    assert.ok(a.sunPosition.every(Number.isFinite));
  }
  assert.ok(daylightAtHour(23).sunIntensity<daylightAtHour(12).sunIntensity*.2);
  assert.ok(daylightAtHour(23).ambient<daylightAtHour(12).ambient*.5);
  assert.ok(daylightAtHour(6).sunPosition[0]<0 && daylightAtHour(17.75).sunPosition[0]>0);
});
const hook=compile(await readFile(new URL('../src/useLocalDaylight.ts',import.meta.url),'utf8'));
function client(){
  const listeners=new Map(),timers=new Map();let id=0,value,cleanup,now=new Date(2026,9,13,12,0,15,250);
  const target={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
  const document={...target,visibilityState:'visible'},window={...target,__PLATOP_DESKTOP_VISIBLE__:true};
  const mod={exports:{}};
  vm.runInNewContext(hook,{module:mod,exports:mod.exports,Date,document,window,
    setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id},clearTimeout:key=>timers.delete(key),
    require:name=>name==='react'?{useState:initial=>{value=initial();return[value,next=>{value=typeof next==='function'?next(value):next}]},useEffect:fn=>{cleanup=fn()}}:module.exports});
  mod.exports.useLocalDaylight(()=>now);
  return{document,window,listeners,timers,get value(){return value},setTime:date=>{now=date},event:type=>listeners.get(type)?.(),cleanup:()=>cleanup()};
}
test('clock schedules only the next visible minute and sleeps while hidden',()=>{
  const c=client();assert.equal(c.timers.size,1);assert.equal([...c.timers.values()][0].delay,44750);
  c.document.visibilityState='hidden';c.event('visibilitychange');assert.equal(c.timers.size,0);
  c.setTime(new Date(2026,9,13,23,1));c.document.visibilityState='visible';c.event('visibilitychange');
  assert.equal(c.value.dark,true);assert.equal(c.timers.size,1);
  c.window.__PLATOP_DESKTOP_VISIBLE__=false;c.event('platop:visibility');assert.equal(c.timers.size,0);
  c.window.__PLATOP_DESKTOP_VISIBLE__=true;c.event('platop:visibility');assert.equal(c.timers.size,1);
  c.cleanup();assert.equal(c.timers.size,0);assert.equal(c.listeners.size,0);
});
test('focus reconciles a changed system clock without allocating another timer',()=>{
  const c=client(),initial=c.value;c.event('focus');assert.equal(c.value,initial);assert.equal(c.timers.size,1);
  c.setTime(new Date(2026,9,14,6,30));c.event('focus');assert.equal(c.value.phase,'dawn');assert.equal(c.timers.size,1);c.cleanup();
});
