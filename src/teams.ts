import type { Team } from './types';
export const teams: Team[] = [
  { id: 'merchant', name: 'Savor Bridge', role: 'Merchant development', color: '#c77a50', floor: '#ecd7c3', portrait: '/portraits/merchant.png', motto: 'Good connections start with a little curiosity.', members: [
    {id:'bridge-jarvis',name:'Jarvis',kind:'robot',color:'#cc744a',accent:'#eab56e',role:'Coordination',description:'A taller, warm orange ceramic robot with a calm, welcoming presence.'},
    {id:'bridge-scout',name:'Scout',kind:'robot',color:'#367a78',accent:'#f1c474',role:'Research',description:'A curious teal compass robot with a magnifying-glass eye.'},
    {id:'bridge-keeper',name:'Keeper',kind:'robot',color:'#e9dfc7',accent:'#688d83',role:'Continuity',description:'An ivory book-shaped helper with a folded-page silhouette.'}
  ]},
  { id: 'hr', name: 'Clear Path', role: 'HR document review', color: '#6b927d', floor: '#dce5d7', portrait: '/portraits/hr.png', motto: 'A clear next step, thoughtfully considered.', members: [
    {id:'hr-compass',name:'Compass',kind:'robot',color:'#e5d9b9',accent:'#e3b766',role:'Coordination',description:'A calm ivory teardrop ceramic guardian with a small compass emblem.'},
    {id:'hr-lens',name:'Lens',kind:'robot',color:'#91a78e',accent:'#e8dbbc',role:'Factual review',description:'A sage ceramic reviewer with a simple lens emblem and attentive eyes.'},
    {id:'hr-relay',name:'Relay',kind:'robot',color:'#276969',accent:'#d4ac58',role:'Follow-through',description:'A deep-teal helper with a connected-dot emblem.'}
  ]},
  { id: 'intake', name: 'Savor Wayfinders', role: 'Rider & backend intake', color: '#b77961', floor: '#eadbd0', portrait: '/portraits/intake.png', motto: 'Steady progress. Every handoff has a home.', members: [
    {id:'intake-jarvis',name:'Jarvis',kind:'robot',color:'#ece0c6',accent:'#2e465d',role:'Team lead',description:'An ivory ceramic navigation guardian with a navy visor, star-tipped hood, cape and compass emblem.'},
    {id:'intake-beacon',name:'Beacon',kind:'robot',color:'#ece0c6',accent:'#cb896a',role:'Guidance',description:'An ivory guardian with a navy visor and a little lighthouse on top.'},
    {id:'intake-relay',name:'Relay',kind:'robot',color:'#ece0c6',accent:'#426371',role:'Reliable records',description:'An ivory helper with a navy visor, receipt scroll and checklist emblem.'},
    {id:'intake-compass',name:'Compass',kind:'robot',color:'#ece0c6',accent:'#55777e',role:'Backend continuity',description:'An ivory navigation guardian with a navy visor, sprout antenna and circuit emblem.'}
  ]},
  { id: 'support', name: 'Beacon', role: 'WhatsApp support', color: '#497d65', floor: '#d6e2d4', portrait: '/portraits/support.png', motto: 'A warm light. A careful reply.', members: [
    {id:'support-beacon',name:'Beacon',kind:'lantern',color:'#285b47',accent:'#f1b954',role:'Support spirit',description:'One forest-green ceramic lantern, kind eyes and an amber conversation-bubble glow. Represents the accountable assistant Jarvis.'}
  ]},
  { id: 'reflection', name: 'The Lantern Desk', role: 'Nightly reflection', color: '#6b7293', floor: '#dbdce8', portrait: '/portraits/reflection.png', motto: 'A quiet desk for a better tomorrow.', members: [
    {id:'reflection-lumen',name:'Lumen',kind:'lantern',color:'#b77c38',accent:'#f3c971',role:'Quiet judgment',description:'A small warm amber lantern with a subtle expressive face.'},
    {id:'reflection-echo',name:'Echo',kind:'owl',color:'#efe3c5',accent:'#617c8c',role:'Careful evidence',description:'A cream origami owl holding a tiny magnifying lens.'},
    {id:'reflection-quill',name:'Quill',kind:'owl',color:'#d0c4ad',accent:'#d0a957',role:'Useful improvement',description:'A folded-paper owl holding a simple pencil.'}
  ]},
  { id: 'email', name: 'Savor Dispatch', role: 'Official email', color: '#68888d', floor: '#d5e1df', portrait: '/portraits/email.png', motto: 'A little care in every delivery.', members: [
    {id:'email-owl',name:'Courier',kind:'owl',color:'#283b51',accent:'#f1e3be',role:'Dispatch lead',description:'A calm navy ceramic owl with pale facial discs and a tiny envelope emblem. Display name is provisional; the source team named the species only.'},
    {id:'email-swift',name:'Swift',kind:'swift',color:'#d1a54a',accent:'#407e80',role:'Review helper',description:'A small ochre folded-paper swift with a teal edge. Display name describes its species.'}
  ]}
];
