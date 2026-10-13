import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { portraitFingerprint } from './portrait-fingerprint.mjs';
const { chromium } = await import(process.env.PLATOP_PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'public','avatars');
if(process.argv.length!==2) throw Error('Usage: node scripts/render-avatars.mjs');
const sourceFingerprint=await portraitFingerprint(root);
// Own the server and its root: an unrelated or stale development tab must never
// produce portraits stamped with this checkout's source fingerprint.
const server=await createServer({root,logLevel:'error',server:{host:'127.0.0.1',port:0,strictPort:true,open:false}});
let browser;
try {
await server.listen();
const address=server.httpServer.address();
if(!address || typeof address==='string') throw Error('Portrait studio could not bind a loopback port.');
const origin=`http://127.0.0.1:${address.port}`;
browser=await chromium.launch({headless:true,args:['--enable-webgl',...(process.platform==='darwin'?['--use-angle=metal']:[])]});
await fs.mkdir(out,{recursive:true});
const page=await browser.newPage({viewport:{width:512,height:480}});
await page.route('**/__portrait_studio',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>PLaTOP character studio</title><body style="margin:0"></body>'}));
await page.goto(`${origin}/__portrait_studio`);
const portraits=await page.evaluate(async()=>{
 const code=await(await fetch('/src/scene/proxies.ts')).text();
 const url=code.match(/from ["']([^"']*\/three\.js[^"']*)["']/)?.[1];
 if(!url) throw Error('Three module identity unavailable');
 const THREE=await import(url);
 const {makeProxy}=await import('/src/scene/proxies.ts');
 const {SceneKit,disposeObject}=await import('/src/scene/primitives.ts');
 const {StudioEnvironment}=await import('/src/scene/studioEnvironment.ts');
 const {teams}=await import('/src/teams.ts');
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,40),kit=new SceneKit();
 const studio=new StudioEnvironment(renderer,scene);
 scene.add(new THREE.HemisphereLight('#fff8ee','#a7ac9d',1.1));
 const key=new THREE.DirectionalLight('#fff2dd',2.0);key.position.set(-3,6,7);scene.add(key);
 const fill=new THREE.DirectionalLight('#dde8e1',.45);fill.position.set(4,2,3);scene.add(fill);
 const owned=new THREE.Group(),images={};
 // Bake a restrained contact into team cards so the models share one ground
 // plane. These pixels add no meshes or lighting work to the running office.
 const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=64;
 const contactContext=contactCanvas.getContext('2d');
 const gradient=contactContext.createRadialGradient(32,32,2,32,32,31);
 gradient.addColorStop(0,'rgba(255,255,255,.85)');gradient.addColorStop(.45,'rgba(255,255,255,.35)');gradient.addColorStop(1,'rgba(255,255,255,0)');
 contactContext.fillStyle=gradient;contactContext.fillRect(0,0,64,64);
 const contactTexture=new THREE.CanvasTexture(contactCanvas);
 const contactMaterial=new THREE.MeshBasicMaterial({map:contactTexture,color:'#8a7960',opacity:.22,transparent:true,depthWrite:false});
 const contactGeometry=new THREE.PlaneGeometry(.92,.64);
 function render(name, members, team=false) {
  const group=new THREE.Group();
  members.forEach((member,index)=>{
   const model=makeProxy(member,kit);
   if(team) { const count=members.length; model.position.x=(index-(count-1)/2)*.86; model.position.z=index===0?-.12:.06; model.rotation.y=(index-(count-1)/2)*-.12; }
   group.add(model);
   if(team){const contact=new THREE.Mesh(contactGeometry,contactMaterial);contact.rotation.x=-Math.PI/2;contact.position.set(model.position.x,.003,model.position.z);group.add(contact);}
  });scene.add(group);group.updateMatrixWorld(true);
  const size=team?[512,480]:[256,256];renderer.setSize(...size,false);camera.aspect=size[0]/size[1];
  if(team){
   const box=new THREE.Box3().setFromObject(group),center=box.getCenter(new THREE.Vector3()),span=box.getSize(new THREE.Vector3());
   const target=center.clone();target.y-=.02;
   const dist=Math.max(span.y,span.x/camera.aspect)*.5/Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*1.24;
   camera.position.copy(target).add(new THREE.Vector3(.10,.16,1).normalize().multiplyScalar(dist));camera.lookAt(target);
  } else {
   const model=group.children[0],head=model.userData.personality.head,box=new THREE.Box3().setFromObject(head),center=box.getCenter(new THREE.Vector3()),span=box.getSize(new THREE.Vector3());
   center.y-=span.y*.15;
   const dist=Math.max(span.y*1.35,span.x*1.32)*.5/Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));
   camera.position.copy(center).add(new THREE.Vector3(.15,.065,1).normalize().multiplyScalar(dist));camera.lookAt(center);
  }
  camera.updateProjectionMatrix();renderer.render(scene,camera);images[name]=renderer.domElement.toDataURL('image/png');
  scene.remove(group);owned.add(group);
 }
 for(const team of teams){for(const member of team.members)render(member.id,[member]);render('team-'+team.id,team.members,true);}
 studio.dispose();disposeObject(owned);kit.dispose();renderer.dispose();return images;
});
const files={};
if(await portraitFingerprint(root)!==sourceFingerprint) throw Error('Portrait sources changed during rendering. Run the studio again.');
for(const [id,data] of Object.entries(portraits)){
 const bytes=Buffer.from(data.split(',')[1],'base64');await fs.writeFile(path.join(out,`${id}.png`),bytes);
 files[id]=createHash('sha256').update(bytes).digest('hex');
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({schemaVersion:1,generator:'scripts/render-avatars.mjs',sourceFingerprint,files},null,2)+'\n');
console.log(`Rendered ${Object.keys(portraits).length} model portraits.`);
await page.close();
}finally{try{await browser?.close();}finally{await server.close();}}
