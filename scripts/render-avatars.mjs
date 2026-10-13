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
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,40),kit=new SceneKit();
 const studio=new StudioEnvironment(renderer,scene);
 scene.add(new THREE.HemisphereLight('#fff8ee','#a7ac9d',1.1));
 const key=new THREE.DirectionalLight('#fff2dd',2.0);key.position.set(-3,6,7);key.castShadow=true;
 key.shadow.mapSize.set(1024,1024);key.shadow.radius=4;key.shadow.blurSamples=8;key.shadow.bias=-.0003;
 Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:1,far:20});scene.add(key);
 const fill=new THREE.DirectionalLight('#dde8e1',.45);fill.position.set(4,2,3);scene.add(fill);
 const owned=new THREE.Group(),images={};
 // Real soft studio shadows are baked into the team portrait. They add no
 // lights, contact sprites or rendering passes to the running office.
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:'#e6dcc8',roughness:.94}));
 ground.rotation.x=-Math.PI/2;ground.position.y=-.006;ground.receiveShadow=true;scene.add(ground);
 function render(name, members, team=false) {
  const group=new THREE.Group();
  members.forEach((member,index)=>{
   const model=makeProxy(member,kit);
   model.traverse(object=>{if(object.isMesh)object.castShadow=true;});
   if(team) { const count=members.length; model.position.x=(index-(count-1)/2)*.86; model.position.z=index===0?-.16:index%2?.10:0; model.rotation.y=(index-(count-1)/2)*-.14; }
   group.add(model);
  });scene.add(group);group.updateMatrixWorld(true);
  ground.visible=team;scene.background=team?new THREE.Color('#eee9dd'):null;
  const size=team?[512,480]:[256,256];renderer.setSize(...size,false);camera.aspect=size[0]/size[1];
  if(team){
   const box=new THREE.Box3().setFromObject(group),center=box.getCenter(new THREE.Vector3()),span=box.getSize(new THREE.Vector3());
   const target=center.clone();target.y-=.02;
   const dist=Math.max(span.y,span.x/camera.aspect)*.5/Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*1.10;
   camera.position.copy(target).add(new THREE.Vector3(.10,.16,1).normalize().multiplyScalar(dist));camera.lookAt(target);
  } else {
   const model=group.children[0],head=model.userData.personality.head;
   const silhouette=members[0].id==='bridge-keeper'||members[0].kind==='lantern'||members[0].kind==='swift';
   const box=new THREE.Box3().setFromObject(silhouette?model:head),center=box.getCenter(new THREE.Vector3()),span=box.getSize(new THREE.Vector3());
   center.y-=span.y*.15;
   const dist=Math.max(span.y*1.35,span.x*1.32)*.5/Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));
   camera.position.copy(center).add(new THREE.Vector3(.15,.065,1).normalize().multiplyScalar(dist));camera.lookAt(center);
  }
  camera.updateProjectionMatrix();renderer.render(scene,camera);images[name]=renderer.domElement.toDataURL('image/png');
  scene.remove(group);owned.add(group);
 }
 for(const team of teams){for(const member of team.members)render(member.id,[member]);render('team-'+team.id,team.members,true);}
 scene.remove(ground);owned.add(ground);key.shadow.dispose();studio.dispose();disposeObject(owned);kit.dispose();renderer.dispose();return images;
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
