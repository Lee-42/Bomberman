import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(relative){
  const source=fs.readFileSync(new URL(relative,import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
  const module={exports:{}};vm.runInNewContext(js,{module,exports:module.exports});return module.exports;
}
const {Simulation,createLabLevel,LAB_RULES}=load('../assets/core/Simulation.ts');
const {InputState}=load('../assets/platform/InputState.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
function openLevel(){return {id:'test',width:7,height:7,spawn:{x:1,y:1},cells:Array.from({length:49},(_,i)=>i%7===0||i%7===6||i<7||i>41?1:0)};}
function advance(s,n,input={direction:null}){for(let i=0;i<n;i++)s.step(input);}

test('identical command replay produces identical state',()=>{
  const a=new Simulation(createLabLevel()),b=new Simulation(createLabLevel());
  for(let i=0;i<240;i++){
    const input={direction:i<20?'right':i<50?'down':null,bomb:i===10};a.step(input);b.step(input);
  }
  assert.deepEqual(plain(a.snapshot()),plain(b.snapshot()));
});
test('wall blocks movement without penetrating the wall',()=>{
  const s=new Simulation(openLevel());advance(s,120,{direction:'left'});assert.equal(s.state.player.x,0.77);
});
test('player can leave a new bomb and cannot walk back through it',()=>{
  const s=new Simulation(openLevel());s.placeBomb();advance(s,20,{direction:'right'});
  assert.equal(s.state.player.x,2);assert.equal(s.state.bombs[0].canLeave,false);
  let previous=s.state.player.x;
  for(let i=0;i<20;i++){s.step({direction:'left'});assert.ok(Math.abs(s.state.player.x-previous)<=0.051);previous=s.state.player.x;}
  assert.equal(s.state.player.x,1.77);
});
test('explosion destroys first brick and stops before brick behind it',()=>{
  const l=openLevel();l.cells[1*7+2]=2;l.cells[1*7+3]=2;
  const s=new Simulation(l,{...LAB_RULES,fuseTicks:2});s.step({direction:null,bomb:true});s.step({direction:null});
  assert.equal(s.cell(2,1),0);assert.equal(s.cell(3,1),2);assert.equal(s.state.destroyed,1);
});
test('concrete blocks explosion propagation',()=>{
  const l=openLevel();l.cells[9]=1;const s=new Simulation(l,{...LAB_RULES,fuseTicks:1});
  s.step({direction:null,bomb:true});assert.ok(!s.state.flames.some(f=>f.y===1&&f.x>=2));
});
test('bombs chain immediately and cannot explode twice',()=>{
  const s=new Simulation(openLevel());s.placeBomb();s.state.player.x=3;s.placeBomb();
  s.state.bombs[0].fuse=1;s.step({direction:null});assert.equal(s.state.bombs.length,0);
  const n=s.state.flames.length;s.step({direction:null});assert.equal(s.state.flames.length,n);
});
test('bomb cap and duplicate-cell placement are enforced',()=>{
  const s=new Simulation(openLevel(),{...LAB_RULES,capacity:1});assert.equal(s.placeBomb(),true);
  assert.equal(s.placeBomb(),false);s.state.player.x=2;assert.equal(s.placeBomb(),false);
});
test('fire is still hazardous after initial detonation',()=>{
  const s=new Simulation(openLevel());s.state.flames.push({x:2,y:1,ttl:20});
  s.state.player.x=2;s.step({direction:null});assert.equal(s.state.player.alive,false);
});
test('renderer snapshots cannot mutate simulation data',()=>{
  const s=new Simulation(createLabLevel());const snapshot=s.snapshot();snapshot.cells[0]=0;snapshot.player.x=99;
  assert.equal(s.state.cells[0],1);assert.equal(s.state.player.x,1);
});
test('releasing newest input restores previous held input; bomb is consumed once',()=>{
  const i=new InputState();i.hold('keyboard','right');i.hold('touch','up');assert.equal(i.consume().direction,'up');
  i.release('touch');assert.equal(i.consume().direction,'right');i.bomb();assert.equal(i.consume().bomb,true);
  assert.equal(i.consume().bomb,false);i.clear();assert.equal(i.consume().direction,null);
});
