/** Device-clock atmosphere, not geolocation or an astronomical sunrise forecast. */
export interface LocalDaylight {
  hour: number;
  phase: 'dawn' | 'day' | 'sunset' | 'night';
  dark: boolean;
  night: number;
  sky: string;
  ground: string;
  sun: string;
  sunIntensity: number;
  ambient: number;
  reflection: number;
  sunPosition: [number, number, number];
  backdrop: [string, string];
}
type Key = { hour: number; night: number; sky: string; ground: string; sun: string; intensity: number; ambient: number; reflection: number; x: number; y: number; backdrop: [string, string] };
const keys: Key[] = [
  {hour:0,night:1,sky:'#7797c5',ground:'#302f3c',sun:'#97b9f2',intensity:.32,ambient:.26,reflection:.17,x:-10,y:15,backdrop:['#1e2d38','#121d28']},
  {hour:5,night:1,sky:'#8295b9',ground:'#3b3442',sun:'#ada4d0',intensity:.38,ambient:.28,reflection:.17,x:-19,y:6,backdrop:['#28303d','#18222e']},
  {hour:6,night:.5,sky:'#a5c8df',ground:'#576a7b',sun:'#ffe0ad',intensity:2.75,ambient:.43,reflection:.18,x:-22,y:5,backdrop:['#edf0e9','#dbe1e3']},
  {hour:7.5,night:0,sky:'#fff4df',ground:'#9c8570',sun:'#ffddb0',intensity:2.7,ambient:.55,reflection:.30,x:-17,y:15,backdrop:['#fbf4e8','#f2ede5']},
  {hour:12,night:0,sky:'#fff9f0',ground:'#90755f',sun:'#fff4e5',intensity:2.5,ambient:.60,reflection:.32,x:-9,y:19,backdrop:['#fbf9f1','#f5f3ed']},
  {hour:16.5,night:0,sky:'#e3eaf0',ground:'#8a8984',sun:'#ffe5c3',intensity:2.6,ambient:.55,reflection:.28,x:15,y:13,backdrop:['#f9f2e7','#eee9e1']},
  {hour:17.75,night:.25,sky:'#b1c8e1',ground:'#737684',sun:'#ffd09b',intensity:2.6,ambient:.55,reflection:.19,x:22,y:7,backdrop:['#f6eddd','#e8e4dc']},
  {hour:18.75,night:.8,sky:'#8e9dbb',ground:'#463648',sun:'#e9a193',intensity:.65,ambient:.33,reflection:.20,x:22,y:5,backdrop:['#334152','#252c3c']},
  {hour:20,night:1,sky:'#7797c5',ground:'#302f3c',sun:'#97b9f2',intensity:.32,ambient:.26,reflection:.17,x:-10,y:15,backdrop:['#1e2d38','#121d28']},
  {hour:24,night:1,sky:'#7797c5',ground:'#302f3c',sun:'#97b9f2',intensity:.32,ambient:.26,reflection:.17,x:-10,y:15,backdrop:['#1e2d38','#121d28']},
];
function mixColor(a: string, b: string, t: number): string {
  return '#' + [1,3,5].map(i => Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
}
export function daylightAtHour(value: number): LocalDaylight {
  const hour = Number.isFinite(value) ? ((value % 24) + 24) % 24 : 12;
  const index = keys.findIndex((key,i) => i < keys.length-1 && hour >= key.hour && hour < keys[i+1].hour);
  const a=keys[Math.max(0,index)],b=keys[Math.max(0,index)+1];
  const linear=(hour-a.hour)/(b.hour-a.hour),t=linear*linear*(3-2*linear);
  const mix=(x:number,y:number)=>x+(y-x)*t,night=mix(a.night,b.night);
  return {hour,phase:hour<5||hour>=19.5?'night':hour<7.5?'dawn':hour<16.5?'day':'sunset',dark:night>=.65,night,
    sky:mixColor(a.sky,b.sky,t),ground:mixColor(a.ground,b.ground,t),sun:mixColor(a.sun,b.sun,t),
    sunIntensity:mix(a.intensity,b.intensity),ambient:mix(a.ambient,b.ambient),reflection:mix(a.reflection,b.reflection),
    sunPosition:[mix(a.x,b.x),mix(a.y,b.y),11],backdrop:[mixColor(a.backdrop[0],b.backdrop[0],t),mixColor(a.backdrop[1],b.backdrop[1],t)]};
}
export function localDaylight(date = new Date()): LocalDaylight {
  return daylightAtHour(date.getHours() + date.getMinutes()/60);
}
