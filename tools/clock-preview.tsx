// Development-only visual test entry, never linked or included in the production build.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from '/src/App';
import '/src/styles.css';
if(!import.meta.env.DEV) throw Error('Development fixture only');
const params=new URLSearchParams(location.search),hour=Number(params.get('hour')??12);
const clock=()=>new Date(2026,9,13,Math.floor(hour),Math.round(hour%1*60));
await document.fonts.load('16px Kalam');
createRoot(document.getElementById('root')!).render(<App clock={clock}/>);
