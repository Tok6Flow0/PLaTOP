import type { Team } from './types';
export const teams: Team[] = [
  { id: 'merchant', name: 'Savor Bridge', role: 'Merchant development', color: '#c77a50', floor: '#ecd7c3', portrait: '/portraits/merchant.png', motto: 'Good connections start with a little curiosity.', members: [
    {id:'bridge-jarvis',name:'Jarvis',kind:'robot',color:'#c16e37',accent:'#eab56e',role:'Coordination',description:'A warm orange potbellied helper with a cream helmet, orange ears, dark smiling visor and small navy gloves and feet.'},
    {id:'bridge-scout',name:'Scout',kind:'robot',color:'#426e50',accent:'#e2dbc7',role:'Research',description:'A green ceramic helper with a broad cream smiling face, green crown and ears, cream belly panel and segmented cream-and-green arms.'},
    {id:'bridge-keeper',name:'Keeper',kind:'robot',color:'#e2dac6',accent:'#688d83',role:'Continuity',description:'A taller ivory ceramic helper with a smaller rounded dark visor helmet, orange ears and antenna ball, and a small sage chest badge.'}
  ]},
  { id: 'hr', name: 'Clear Path', role: 'HR document review', color: '#6b927d', floor: '#dce5d7', portrait: '/portraits/hr.png', motto: 'A clear next step, thoughtfully considered.', members: [
    {id:'hr-compass',name:'Compass',kind:'robot',color:'#9aa58a',accent:'#d9c994',role:'Coordination',description:'A compact sage ceramic helper with a warm ivory helmet and a small dark smiling visor.'},
    {id:'hr-lens',name:'Lens',kind:'robot',color:'#a6b497',accent:'#dce0c7',role:'Factual review',description:'A softly rounded sage reviewer with an ivory helmet and attentive tiny dot eyes.'},
    {id:'hr-relay',name:'Relay',kind:'robot',color:'#a6ad8e',accent:'#d3c293',role:'Follow-through',description:'A cream and muted-sage ceramic helper with rounded hands, feet and a calm visor smile.'}
  ]},
  { id: 'intake', name: 'Savor Wayfinders', role: 'Rider & backend intake', color: '#b77961', floor: '#eadbd0', portrait: '/portraits/intake.png', motto: 'Steady progress. Every handoff has a home.', members: [
    {id:'intake-jarvis',name:'Jarvis',kind:'robot',color:'#e5e0cf',accent:'#2e465d',role:'Team lead',description:'A squat ivory ceramic helper with a rounded navy visor, tiny dot eyes and a short antenna.'},
    {id:'intake-beacon',name:'Beacon',kind:'robot',color:'#e5e0cf',accent:'#344b5a',role:'Guidance',description:'A simple ivory ceramic helper with a softly inset navy visor and small rounded hands.'},
    {id:'intake-relay',name:'Relay',kind:'robot',color:'#e5e0cf',accent:'#426371',role:'Reliable records',description:'An ivory and navy ceramic helper with a compact belly, short limbs and a calm smile.'},
    {id:'intake-compass',name:'Compass',kind:'robot',color:'#e5e0cf',accent:'#55777e',role:'Backend continuity',description:'An ivory ceramic helper with a navy visor and a tiny sprout beside its antenna.'}
  ]},
  { id: 'support', name: 'Beacon', role: 'WhatsApp support', color: '#497d65', floor: '#d6e2d4', portrait: '/portraits/support.png', motto: 'A warm light. A careful reply.', members: [
    {id:'support-beacon',name:'Beacon',kind:'lantern',color:'#3b6948',accent:'#e3b860',role:'Support spirit',description:'A rounded forest-green lantern helper with tiny kind eyes, an amber face and soft ceramic hands. Represents the accountable assistant Jarvis.'}
  ]},
  { id: 'reflection', name: 'The Lantern Desk', role: 'Nightly reflection', color: '#6b7293', floor: '#dbdce8', portrait: '/portraits/reflection.png', motto: 'A quiet desk for a better tomorrow.', members: [
    {id:'reflection-lumen',name:'Lumen',kind:'lantern',color:'#b77c38',accent:'#f3c971',role:'Quiet judgment',description:'A small warm amber lantern with a subtle expressive face.'},
    {id:'reflection-echo',name:'Echo',kind:'owl',color:'#ebe1c9',accent:'#bba47a',role:'Careful evidence',description:'A soft cream owl with a plump ceramic body, round pale facial discs and tiny dark pupils.'},
    {id:'reflection-quill',name:'Quill',kind:'owl',color:'#e1d5bd',accent:'#bba47a',role:'Useful improvement',description:'A warm ivory owl with rounded ear tufts, short soft wings and a small golden beak.'}
  ]},
  { id: 'email', name: 'Savor Dispatch', role: 'Official email', color: '#68888d', floor: '#d5e1df', portrait: '/portraits/email.png', motto: 'A little care in every delivery.', members: [
    {id:'email-owl',name:'Courier',kind:'owl',color:'#283b51',accent:'#f1e3be',role:'Dispatch lead',description:'A calm navy ceramic owl with pale facial discs and a tiny envelope emblem. Display name is provisional; the source team named the species only.'},
    {id:'email-swift',name:'Swift',kind:'swift',color:'#cba05d',accent:'#b58b50',role:'Review helper',description:'A small ochre ceramic bird with softly swept wings, a rounded head and a short tail. Display name describes its species.'}
  ]}
];
