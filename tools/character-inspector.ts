import * as THREE from 'three';
import { teams } from '../src/teams';
import { makeProxy } from '../src/scene/proxies';
import { refineCharacterModel } from '../src/scene/characterDetail';
import { SceneKit, disposeObject } from '../src/scene/primitives';
import { StudioEnvironment } from '../src/scene/studioEnvironment';

if(!import.meta.env.DEV)throw Error('Development fixture only');
const character=document.querySelector<HTMLSelectElement>('#character')!;
const angle=document.querySelector<HTMLSelectElement>('#angle')!;
const night=document.querySelector<HTMLInputElement>('#night')!;
const viewport=document.querySelector<HTMLDivElement>('#viewport')!;
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;
viewport.append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,40);
const studio=new StudioEnvironment(renderer,scene);
const ambient=new THREE.HemisphereLight('#fff8ee','#8c725a',.42);
const key=new THREE.DirectionalLight('#fff2dd',2.5),fill=new THREE.DirectionalLight('#dde8e1',.18);
key.position.set(-3,5,5);fill.position.set(4,2,3);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);key.shadow.radius=12;key.shadow.blurSamples=12;
key.shadow.bias=-.0003;key.shadow.normalBias=.012;
Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:1,far:20});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.MeshStandardMaterial({color:'#bbb19e',roughness:.95}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.015;floor.receiveShadow=true;
scene.add(ambient,key,fill,floor);
for(const team of teams)for(const member of team.members){
  const option=document.createElement('option');option.value=member.id;option.textContent=`${team.name} · ${member.name}`;character.append(option);
}
let kit:SceneKit|undefined,model:THREE.Group|undefined,release:(()=>void)|undefined;
function render(){
  if(!model)return;
  const width=viewport.clientWidth,height=viewport.clientHeight;
  renderer.setSize(width,height,false);camera.aspect=width/height;
  model.rotation.y=Number(angle.value);model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),span=box.getSize(new THREE.Vector3());
  const distance=Math.max(span.y,span.x/camera.aspect)*.5/Math.tan(THREE.MathUtils.degToRad(16))*1.25;
  camera.position.copy(center).add(new THREE.Vector3(.06,.055,1).normalize().multiplyScalar(distance));camera.lookAt(center);camera.updateProjectionMatrix();
  const dark=night.checked;
  ambient.color.set(dark?'#91a9c3':'#fff8ee');ambient.groundColor.set(dark?'#292536':'#8c725a');ambient.intensity=dark?.28:.42;
  key.color.set(dark?'#ffc77e':'#fff2dd');key.intensity=dark?1.65:2.5;key.position.set(...(dark?[-2,3,3]:[-3,5,5]) as [number,number,number]);
  fill.color.set(dark?'#9eb8dd':'#dde8e1');fill.intensity=dark?.58:.18;
  scene.environmentIntensity=dark?.23:.32;scene.background=new THREE.Color(dark?'#1c2935':'#e4dccd');
  renderer.render(scene,camera);
}
function select(){
  release?.();if(model){scene.remove(model);disposeObject(model);}kit?.dispose();
  const team=teams.find(team=>team.members.some(member=>member.id===character.value))!;
  const member=team.members.find(member=>member.id===character.value)!;
  kit=new SceneKit();model=makeProxy(member,kit);release=refineCharacterModel(model);
  model.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.isMesh&&!Array.isArray(mesh.material)&&!mesh.material.transparent)mesh.castShadow=true;});
  scene.add(model);document.querySelector<HTMLImageElement>('#reference')!.src=`/portraits/${team.id}.png`;
  document.querySelector('#caption')!.textContent=`${member.name} · actual isolated office model`;
  let triangles=0;model.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.isMesh)triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;});
  document.querySelector('#metrics')!.textContent=`${triangles.toLocaleString()} close-up triangles · static inspection, no animation loop`;
  render();
}
character.addEventListener('change',select);angle.addEventListener('change',render);night.addEventListener('change',render);
const resize=new ResizeObserver(render);resize.observe(viewport);select();
window.addEventListener('pagehide',()=>{resize.disconnect();release?.();if(model)disposeObject(model);kit?.dispose();key.shadow.dispose();studio.dispose();floor.geometry.dispose();floor.material.dispose();renderer.dispose();},{once:true});
