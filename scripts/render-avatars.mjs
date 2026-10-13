import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { portraitFingerprint } from './portrait-fingerprint.mjs';
import { compressPng } from './png-compression.mjs';
const { chromium } = await import(process.env.PLATOP_PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'public','avatars');
// Optional inspection views stay outside shipped portraits and their manifest.
const reviewDir=process.env.PLATOP_AVATAR_REVIEW_DIR ? path.resolve(process.env.PLATOP_AVATAR_REVIEW_DIR) : null;
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
if(reviewDir)await fs.mkdir(reviewDir,{recursive:true});
const page=await browser.newPage({viewport:{width:512,height:480}});
await page.route('**/__portrait_studio',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>PLaTOP character studio</title><body style="margin:0"></body>'}));
await page.goto(`${origin}/__portrait_studio`);
const portraits=await page.evaluate(async(includeReview)=>{
 const lettering=new FontFace('Kalam','url(/fonts/Kalam-Regular.ttf)');await lettering.load();document.fonts.add(lettering);
 const code=await(await fetch('/src/scene/proxies.ts')).text();
 const url=code.match(/from ["']([^"']*\/three\.js[^"']*)["']/)?.[1];
 if(!url) throw Error('Three module identity unavailable');
 const THREE=await import(url);
 const {makeProxy}=await import('/src/scene/proxies.ts');
 const {refineCharacterModel}=await import('/src/scene/characterDetail.ts');
 const {SceneKit,disposeObject}=await import('/src/scene/primitives.ts');
 const {StudioEnvironment}=await import('/src/scene/studioEnvironment.ts');
 const {plant,floorSurface}=await import('/src/scene/environmentProps.ts');
 const {EffectComposer}=await import('/node_modules/three/examples/jsm/postprocessing/EffectComposer.js');
 const {RenderPass}=await import('/node_modules/three/examples/jsm/postprocessing/RenderPass.js');
 const {GTAOPass}=await import('/node_modules/three/examples/jsm/postprocessing/GTAOPass.js');
 const {BokehPass}=await import('/node_modules/three/examples/jsm/postprocessing/BokehPass.js');
 const {OutputPass}=await import('/node_modules/three/examples/jsm/postprocessing/OutputPass.js');
 const {teams}=await import('/src/teams.ts');
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(2);renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,40),kit=new SceneKit();
 const studio=new StudioEnvironment(renderer,scene);
 const ambient=new THREE.HemisphereLight('#fff8ee','#8c725a',.42);scene.add(ambient);
 const key=new THREE.DirectionalLight('#fff2dd',2.5);key.position.set(-3,5,5);key.castShadow=true;
 key.shadow.mapSize.set(2048,2048);key.shadow.radius=12;key.shadow.blurSamples=12;key.shadow.bias=-.0003;key.shadow.normalBias=.012;
 Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:1,far:20});scene.add(key);
 const fill=new THREE.DirectionalLight('#dde8e1',.18);fill.position.set(4,2,3);scene.add(fill);
 const owned=new THREE.Group(),images={};
 // Real soft studio shadows are baked into the team portrait. They add no
 // lights, contact sprites or rendering passes to the running office.
 const ground=new THREE.Group();floorSurface(ground,'#76573e',[0,-.006,0],[10,10]);scene.add(ground);
 const backdrop=new THREE.Group();scene.add(backdrop);
 const wall=new THREE.Mesh(new THREE.PlaneGeometry(20,12),new THREE.MeshStandardMaterial({color:'#b3a18b',roughness:.95}));
 wall.position.set(0,3,-4.3);wall.receiveShadow=true;backdrop.add(wall);
 for(const [x,z,size] of [[-1.9,-3.5,1.55],[1.8,-3.8,1.95]]){
  const greenery=new THREE.Group();plant(greenery,kit,0,0,size,0,'#9e7854','leaf');
  greenery.position.set(x,0,z);greenery.scale.set(.90,1,.90);backdrop.add(greenery);
 }
 kit.mesh(backdrop,'cone','#eee0c3',[-.9,2.1,-2.5],[.32,.4,.32]);
 kit.mesh(backdrop,'detailCylinder','#746347',[-.9,2.55,-2.5],[.018,.55,.018]);
 const composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(512,480,{samples:4,type:THREE.HalfFloatType}));
 composer.setPixelRatio(2);
 const beauty=new RenderPass(scene,camera),bokeh=new BokehPass(scene,camera,{focus:5,aperture:.008,maxblur:.04}),output=new OutputPass();
 const contact=new GTAOPass(scene,camera,512,480,undefined,{radius:.16,thickness:1,distanceExponent:2});contact.blendIntensity=.65;
 composer.addPass(beauty);composer.addPass(contact);composer.addPass(bokeh);composer.addPass(output);
 function render(name, members, team=false,night=false,angle=0) {
  ambient.color.set(night?'#91a9c3':'#fff8ee');ambient.groundColor.set(night?'#292536':'#8c725a');ambient.intensity=night?.28:.42;
  key.color.set(night?'#ffc77e':'#fff2dd');key.intensity=night?1.65:2.5;
  key.position.set(...(night?[-2,3,3]:[-3,5,5]));
  fill.color.set(night?'#9eb8dd':'#dde8e1');fill.intensity=night?.58:.18;
  scene.environmentIntensity=night?.23:.32;wall.material.color.set(night?'#243441':'#b3a18b');
  const group=new THREE.Group(),releaseSurfaces=[];
  members.forEach((member,index)=>{
   const model=makeProxy(member,kit);
   releaseSurfaces.push(refineCharacterModel(model));
   model.traverse(object=>{if(object.isMesh)object.castShadow=true;});
   if(team) {
    const count=members.length;
    if(members[0].id==='bridge-jarvis'){
     model.position.set(index===0?0:index===1?-.73:.70,0,index===0?-.25:.18);
     model.rotation.y=index===0?0:index===1?.12:-.12;
    }else if(members[0].id==='hr-compass'||members[0].id==='reflection-lumen'){
     model.position.set(index===0?0:index===1?-.66:.66,0,index===0?-.10:.08);
     model.rotation.y=index===1?.15:index===2?-.15:0;
    }else if(members[0].id==='intake-jarvis'){
     model.position.x=[-.36,-1.11,.42,1.18][index];
     model.position.z=index===0?.20:-.06;
     model.rotation.y=[0,.13,-.06,-.16][index];
    }else if(members[0].id==='email-owl'){
     model.position.set(index===0?-.28:.49,0,index===0?-.04:.19);
     model.rotation.y=index===0?.07:-.95;
    }else{
     model.position.x=(index-(count-1)/2)*.82;
     model.position.z=index===Math.floor(count/2)?-.25:.12;
     model.rotation.y=(index-(count-1)/2)*-.12;
    }
   }
   group.add(model);
  });group.rotation.y=angle;scene.add(group);group.updateMatrixWorld(true);
  ground.visible=backdrop.visible=team;scene.background=team?new THREE.Color(night?'#1c2935':'#c9b79d'):null;
  const size=team?[512,480]:[256,256];renderer.setSize(...size,false);camera.aspect=size[0]/size[1];
  if(team){
   const box=new THREE.Box3().setFromObject(group),center=box.getCenter(new THREE.Vector3()),span=box.getSize(new THREE.Vector3());
   const target=center.clone();target.y-=.02;
   const dist=Math.max(span.y,span.x/camera.aspect)*.5/Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*1.18;
   camera.position.copy(target).add(new THREE.Vector3(.06,.055,1).normalize().multiplyScalar(dist));camera.lookAt(target);
  } else {
   const model=group.children[0],head=model.userData.personality.head;
   const silhouette=members[0].kind==='lantern'||members[0].kind==='swift'||members[0].id==='bridge-keeper'||members[0].id.startsWith('hr-');
   const box=new THREE.Box3().setFromObject(silhouette?model:head),center=box.getCenter(new THREE.Vector3()),span=box.getSize(new THREE.Vector3());
   center.y-=span.y*.06;
   const dist=Math.max(span.y*1.13,span.x*1.16)*.5/Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));
   camera.position.copy(center).add(new THREE.Vector3(.15,.065,1).normalize().multiplyScalar(dist));camera.lookAt(center);
  }
  camera.updateProjectionMatrix();
  if(team){composer.setSize(...size);bokeh.uniforms.focus.value=camera.position.distanceTo(group.position.clone().add(new THREE.Vector3(0,.9,.15)));composer.render();}
  else renderer.render(scene,camera);
  const portrait=document.createElement('canvas');portrait.width=size[0];portrait.height=size[1];
  const raster=portrait.getContext('2d');raster.imageSmoothingEnabled=true;raster.imageSmoothingQuality='high';
  raster.drawImage(renderer.domElement,0,0,...size);images[name]=portrait.toDataURL('image/png');
  // High-detail geometry is large; release each rendered view immediately.
  // Materials belong to SceneKit and remain shared by the following views.
  scene.remove(group);releaseSurfaces.forEach(release=>release());
  owned.add(group);
 }
 for(const team of teams){
  for(const member of team.members)render(member.id,[member]);render('team-'+team.id,team.members,true);render('team-'+team.id+'-night',team.members,true,true);
  if(includeReview){render('review-'+team.id+'-quarter',team.members,true,false,-.6);render('review-'+team.id+'-rear',team.members,true,false,2.55);}
 }
 scene.remove(ground,backdrop);owned.add(ground,backdrop);beauty.dispose();contact.dispose();bokeh.dispose();output.dispose();composer.dispose();key.shadow.dispose();studio.dispose();disposeObject(owned);kit.dispose();renderer.dispose();return images;
},Boolean(reviewDir));
const files={};
if(await portraitFingerprint(root)!==sourceFingerprint) throw Error('Portrait sources changed during rendering. Run the studio again.');
for(const [id,data] of Object.entries(portraits)){
 const bytes=compressPng(Buffer.from(data.split(',')[1],'base64'));
 if(id.startsWith('review-')){await fs.writeFile(path.join(reviewDir,`${id}.png`),bytes);continue;}
 await fs.writeFile(path.join(out,`${id}.png`),bytes);
 files[id]=createHash('sha256').update(bytes).digest('hex');
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({schemaVersion:1,generator:'scripts/render-avatars.mjs',sourceFingerprint,files},null,2)+'\n');
console.log(`Rendered ${Object.keys(portraits).length} model portraits.`);
await page.close();
}finally{try{await browser?.close();}finally{await server.close();}}
