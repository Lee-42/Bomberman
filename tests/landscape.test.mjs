import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../assets/platform/Landscape.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const module={exports:{}};vm.runInNewContext(js,{module,exports:module.exports});
const {FourWayPad,FollowCamera,landscapeLayout}=module.exports;
test('four-way pad slides without lifting, filters diagonal jitter, and stops on release',()=>{
 const p=new FourWayPad();assert.ok(p.begin(5,70,0));assert.equal(p.direction,'right');
 assert.equal(p.move(5,61,65),'right');assert.equal(p.move(5,25,70),'up');
 assert.equal(p.move(5,0,-70),'down');assert.equal(p.move(5,-70,0),'left');
 assert.equal(p.move(5,2,3),null);p.move(5,0,70);assert.ok(p.end(5));assert.equal(p.direction,null);
});
test('a second touch (bomb finger) cannot steal or release the direction pad',()=>{
 const p=new FourWayPad();p.begin(1,70,0);assert.equal(p.begin(2,0,-70),false);
 p.move(2,-70,0);assert.equal(p.direction,'right');assert.equal(p.end(2),false);assert.equal(p.pointer,1);
 p.clear();assert.equal(p.pointer,null);assert.equal(p.direction,null);assert.ok(p.begin(2,-70,0));
});
test('phone and tablet controls stay inside asymmetric notch and home-indicator safe areas',()=>{
 for(const [w,h,insets] of [[1558,720,{left:81,right:0,top:0,bottom:40}],[1280,720,{left:0,right:70,top:0,bottom:24}],[960,720,{left:0,right:0,top:0,bottom:0}],[1920,720,{left:64,right:64,top:0,bottom:32}]]){
  const l=landscapeLayout(w,h,insets),s=l.safe;
  for(const [p,r] of [[l.pad,140],[l.bomb,79],[l.remote,59],[l.pause,47]]){
   assert.ok(p.x-r>=s.left&&p.x+r<=s.right&&p.y-r>=s.bottom&&p.y+r<=s.top,JSON.stringify({w,p,r,s}));
  }
  assert.ok(l.remote.y-59>l.bomb.y+79);assert.ok(l.zone.top>l.zone.bottom);
 }
});
test('camera protects the full player at all four map corners by allowing edge background',()=>{
 for(const w of [960,1280,1558,1920]){
  const l=landscapeLayout(w,720,{left:64,right:32,top:0,bottom:40});
  for(const p of [{x:24,y:56},{x:472,y:56},{x:24,y:216},{x:472,y:216}]){
   const c=new FollowCamera();c.follow(p,l,1/60);
   const sx=(p.x-c.x)*l.scale,sy=(c.y-p.y)*l.scale;
   assert.ok(sx>=l.zone.left-1&&sx<=l.zone.right+1);assert.ok(sy>=l.zone.bottom-1&&sy<=l.zone.top+1);
  }
 }
});
test('camera stays still inside its free area and follows in both directions without a snap',()=>{
 const l=landscapeLayout(1558,720),c=new FollowCamera(),p={x:240,y:136};c.follow(p,l,1/60);
 const first={x:c.x,y:c.y};c.follow({x:244,y:138},l,1/60);assert.deepEqual({x:c.x,y:c.y},first);
 let previous=c.x;for(let x=244;x<470;x++){c.follow({x,y:138},l,1/60);assert.ok(c.x>=previous);assert.ok(c.x-previous<=1.1);previous=c.x;}
 for(let x=470;x>=24;x--){c.follow({x,y:138},l,1/60);assert.ok(c.x<=previous+1);previous=c.x;}
});
test('portrait is detected and resizing resets the camera without changing world coordinates',()=>{
 assert.equal(landscapeLayout(390,844).portrait,true);assert.equal(landscapeLayout(1558,720).portrait,false);
 const c=new FollowCamera(),l=landscapeLayout(1558,720),p={x:24,y:56};c.follow(p,l,.016);c.reset();c.follow(p,l,.016);
 assert.deepEqual(p,{x:24,y:56});assert.ok(Number.isFinite(c.x)&&Number.isFinite(c.y));
});
