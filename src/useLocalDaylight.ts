import { useEffect, useState } from 'react';
import { localDaylight } from './localDaylight';
const deviceClock = () => new Date();

/** One clock tick per visible minute; no frame loop, network or location access. */
export function useLocalDaylight(clock: () => Date = deviceClock) {
  const [daylight,setDaylight]=useState(()=>localDaylight(clock()));
  useEffect(()=>{
    let timer: ReturnType<typeof setTimeout> | undefined;
    const visible=()=>document.visibilityState !== 'hidden' && (window as Window & {__PLATOP_DESKTOP_VISIBLE__?: boolean}).__PLATOP_DESKTOP_VISIBLE__ !== false;
    function refresh() {
      clearTimeout(timer);
      if (!visible()) return;
      const now=clock();
      setDaylight(previous=>{const next=localDaylight(now);return next.hour===previous.hour?previous:next});
      timer=setTimeout(refresh,60_000-now.getSeconds()*1000-now.getMilliseconds());
    }
    refresh();
    document.addEventListener('visibilitychange',refresh);
    window.addEventListener('platop:visibility',refresh);
    window.addEventListener('focus',refresh);
    return ()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('platop:visibility',refresh);window.removeEventListener('focus',refresh)};
  },[clock]);
  return daylight;
}
