type Name = 'home' | 'play' | 'pause' | 'plus' | 'minus' | 'plant' | 'lamp' | 'art' | 'cube' | 'link' | 'close' | 'fullscreen' | 'window' | 'left' | 'right' | 'up' | 'down' | 'rotate-left' | 'rotate-right' | 'move' | 'help' | 'weather' | 'desktop';
const paths: Record<Name, string> = {
  home: 'M3 10 12 3l9 7M5 9v12h14V9M9 21v-8h6v8', play: 'm8 4 12 8-12 8Z', pause: 'M8 4v16M16 4v16', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', plant: 'M12 22V12M12 15C4 15 3 9 4 5c6 0 8 3 8 7M12 13c0-7 4-10 9-10 0 6-3 10-9 10', lamp: 'm8 3-4 11h16L16 3ZM12 14v7M8 21h8', art: 'M3 3h18v18H3ZM4 17l5-6 4 4 3-4 5 6M15 7h.01', cube: 'm12 2 10 5v10l-10 5-10-5V7ZM2 7l10 5 10-5M12 12v10', link: 'M10 14l4-4M9 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M15 8l2-2a4 4 0 1 1 6 6l-5 5a4 4 0 0 1-6 0', close: 'm6 6 12 12M6 18 18 6',
  fullscreen: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5',
  window: 'M3 3h18v18H3ZM3 10h18M12 3v18',
  left: 'm15 5-7 7 7 7', right: 'm9 5 7 7-7 7', up: 'm5 15 7-7 7 7', down: 'm5 9 7 7 7-7',
  'rotate-left': 'M3 10a9 9 0 1 1 2 8M3 4v6h6', 'rotate-right': 'M21 10a9 9 0 1 0-2 8M21 4v6h-6',
  move: 'M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4',
  help: 'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 18h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  weather: 'M5 16a4 4 0 1 1 1-8 6 6 0 0 1 11-1 4 4 0 1 1 1 9M8 19l-1 3M13 19l-1 3M18 19l-1 3',
  desktop: 'M3 3h18v14H3ZM12 17v4M7 21h10',
};
export function Icon({ name }: { name: Name }) { return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>; }
