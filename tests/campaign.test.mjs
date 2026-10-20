import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {fileURLToPath} from 'node:url';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:n=>load(path.resolve(path.dirname(file),n+'.ts'))});cache.set(file,module.exports);return module.exports;}
const {Campaign,concreteMap}=load(path.join(root,'assets/core/Stage1.ts')),{STAGES}=load(path.join(root,'assets/content/original/Stages.ts'));
const golden=JSON.parse(fs.readFileSync(path.join(root,'verification/campaign/original-vectors.json'))),plain=x=>JSON.parse(JSON.stringify(x));
const enemyState=s=>s.state.enemies.map(e=>e.type?[e.type,e.x,e.u,e.y,e.v,e.frame,e.wait,e.flip?64:0,e.moveTimer,e.face,e.chain,e.turnTimer]:null);
function compareEnemies(s,expected,message){const actual=enemyState(s);for(let i=0;i<10;i++){if(!expected[i][0])assert.equal(actual[i],null,message);else assert.deepEqual(plain(actual[i]),expected[i],message+' slot '+i);}}
const flags=s=>[s.state.range*16,s.state.capacity-1,+s.state.speed,+s.state.wallPass,+s.state.remote,+s.state.bombPass,+s.state.fireSuit,s.state.invulnerableTimer];
const advance=(s,n,cmd={})=>{for(let i=0;i<n;i++){s.step(cmd);s.drainEvents();}};
test('all 50 generated maps, enemy configurations and spawn RNG match the original program',()=>{
 for(const v of golden.stages){const s=new Campaign(v.seed,true,v.stage);assert.deepEqual(plain(s.state.map),v.map,'stage '+v.stage);assert.deepEqual(plain(s.rng.seed),v.seedAfter,'seed '+v.stage);assert.equal(STAGES[v.stage-1].powerup,v.powerup);for(let slot=0;slot<10;slot++){const e=s.state.enemies[slot],raw=v.enemies[slot];assert.equal(e.type,raw[0]);if(e.type)assert.deepEqual([e.x,e.u,e.y,e.v,e.frame,e.face],[raw[1],raw[2],raw[3],raw[4],raw[5],raw[9]]);}}
});
test('all 8 enemy AIs match 8192 original frames including PRNG state',()=>{
 for(const v of golden.ai){const s=new Campaign(v.seed,true);for(const e of s.state.enemies)if(e.type){e.type=v.type;e.frame=(v.type-1)*4;}
 for(const [i,f] of v.frames.entries()){s.state.frame=(i+1)&255;s.think();compareEnemies(s,f.enemies,'type '+v.type+' frame '+(i+1));assert.deepEqual(plain(s.rng.seed),f.seed);assert.equal(s.state.phase==='dying'?1:0,f.dying);}}
});
test('8 original powerups match flags, 1000-point pickup score, melody and sound IDs',()=>{
 for(const v of golden.powers){const s=new Campaign([13,37,19,53],true,v.stage);s.drainEvents();s.state.frame=1;s.state.map[33]=6;s.processPlayer({});assert.deepEqual(flags(s),v.flags,'type '+v.type);assert.equal(s.state.score,v.score);const events=s.drainEvents();assert.ok(events.some(e=>e.kind==='music'&&e.id===v.music));assert.ok(events.some(e=>e.kind==='effect'&&e.id===v.effect));}
});
test('remote fuses freeze, B detonates only the highest active slot, and release rearms B',()=>{
 const s=new Campaign([13,37,19,53],true,3);s.state.map=concreteMap();s.state.remote=true;s.state.capacity=3;
 for(const [slot,x] of [[0,3],[1,7]]){Object.assign(s.state.bombs[slot],{active:true,x,y:3,fuse:160,elapsed:0});s.state.map[96+x]=3;}
 for(let i=0;i<180;i++)s.tickBombs();
 function compare(v){assert.deepEqual(plain(s.state.bombs.map(b=>+b.active)),v.active);assert.deepEqual(plain(s.state.bombs.map(b=>b.fuse)),v.fuse);assert.deepEqual(plain(s.state.bombs.map(b=>b.elapsed)),v.elapsed);assert.deepEqual(plain(s.state.map),v.map);assert.deepEqual(plain(s.state.fires.map(f=>f.active)),v.fireActive);}
 compare(golden.remote.stages[0]);let i=1;for(const [frame,detonate] of [[181,true],[182,true],[183,false],[185,true]]){s.state.frame=frame&255;s.processPlayer({detonate});compare(golden.remote.stages[i++]);}
});
test('all 9 bonus rounds use original spawn state, and early/late rounds match 1024 update frames',()=>{
 for(const v of golden.bonus){const s=new Campaign(v.seed,true,v.stage,50,'bonus');assert.deepEqual(plain(s.rng.seed),v.initial.seed);assert.deepEqual(plain(s.state.map),v.initial.map);
 for(const [i,f] of v.frames.entries()){s.step({direction:f.direction,bomb:f.bomb});s.drainEvents();assert.equal(s.state.phase,'playing');assert.equal(s.state.mode,'bonus');compareEnemies(s,f.enemies,'bonus next '+v.stage+' frame '+(i+1));assert.deepEqual(plain(s.rng.seed),f.seed);assert.deepEqual(plain(s.state.map),f.map);const p=s.state.player;assert.deepEqual([p.x,p.u,p.y,p.v,p.frame,p.flip?64:0],f.player);assert.equal(s.state.time,f.time);assert.equal(s.state.score,f.score);assert.equal(s.state.invulnerableTimer,f.invulnerable);}}
});
test('normal progression visits stages 1–50, inserts 9 bonus rounds and never grants an extra bonus-round life',()=>{
 const s=new Campaign([13,37,19,53],true),normal=[],bonus=[];
 for(let stage=1;stage<=50;stage++){
  assert.equal(s.state.stage,stage);assert.equal(s.state.mode,'normal');normal.push(stage);s.state.phase='playing';s.state.enemies.forEach(e=>e.type=0);const p=s.state.player;s.state.map[p.y*32+p.x]=8;s.step();assert.equal(s.state.phase,'clear');advance(s,193);
  if(stage===50){assert.equal(s.state.phase,'complete');break;}
  if(stage%5===0){bonus.push(stage);assert.equal(s.state.mode,'bonus');assert.equal(s.state.stage,stage+1);advance(s,161);assert.equal(s.state.time,30);const lives=s.state.lives;s.state.time=1;s.state.frame=63;s.step();assert.equal(s.state.time,0);s.step();assert.equal(s.state.phase,'bonusClear');advance(s,193);assert.equal(s.state.mode,'normal');assert.equal(s.state.stage,stage+1);assert.equal(s.state.lives,lives);assert.equal(s.state.invulnerableTimer,0);}
  advance(s,161);
 }
 assert.equal(normal.length,50);assert.equal(bonus.length,9);assert.equal(s.state.lives,52);
});
test('death retains bomb capacity, range and speed while clearing temporary or special powers',()=>{
 const s=new Campaign([13,37,19,53],true,30);Object.assign(s.state,{capacity:7,range:4,speed:true,wallPass:true,remote:true,bombPass:true,fireSuit:true,invulnerableTimer:200});s.state.enemies.forEach(e=>e.type=0);s.die();advance(s,300);assert.equal(s.state.stage,30);assert.equal(s.state.lives,1);assert.equal(s.state.phase,'intro');assert.deepEqual(flags(s),[64,6,1,0,0,0,0,0]);
});
test('powerups remain across ordinary clears; bonus entry and exit clear timed invulnerability only',()=>{
 const s=new Campaign([13,37,19,53],true,5);Object.assign(s.state,{capacity:7,range:4,speed:true,wallPass:true,remote:true,bombPass:true,fireSuit:true,invulnerableTimer:200});s.state.enemies.forEach(e=>e.type=0);s.state.map[33]=8;s.step();advance(s,193);assert.equal(s.state.mode,'bonus');assert.deepEqual(flags(s),[64,6,1,1,1,1,1,1]);advance(s,161);s.state.time=0;s.step();advance(s,193);assert.equal(s.state.stage,6);assert.equal(s.state.mode,'normal');assert.deepEqual(flags(s),[64,6,1,1,1,1,1,0]);
});
test('wall pass and bomb pass apply only to their original terrain types',()=>{
 const s=new Campaign([13,37,19,53],true);s.state.map=concreteMap();s.state.map[34]=2;assert.equal(s.move(s.state.player,1,0),2);s.state.wallPass=true;assert.equal(s.move(s.state.player,1,0),0);s.state.player.u=8;s.state.map[34]=3;assert.equal(s.move(s.state.player,1,0),3);s.state.bombPass=true;assert.equal(s.move(s.state.player,1,0),0);s.state.player.u=8;s.state.map[34]=1;assert.equal(s.move(s.state.player,1,0),1);
});
test('firesuit blocks fire but not enemies; timed invulnerability expires on the original 8-update cadence',()=>{
 const s=new Campaign([13,37,19,53],true),p=s.state.player;Object.assign(s.state.fires[79],{active:1,x:p.x,y:p.y,visual:8,travel:0});s.state.fireSuit=true;s.fireDamage();assert.equal(s.state.phase,'playing');s.state.fireSuit=false;s.state.invulnerableTimer=1;s.fireDamage();assert.equal(s.state.phase,'playing');s.state.invulnerableTimer=0;s.fireDamage();assert.equal(s.state.phase,'dying');
 const t=new Campaign([13,37,19,53],true);t.state.enemies.forEach(e=>e.type=0);t.state.invulnerableTimer=1;advance(t,7);assert.equal(t.state.invulnerableTimer,1);t.step();assert.equal(t.state.invulnerableTimer,0);assert.ok(t.drainEvents().some(e=>e.kind==='music'&&e.id===3));
});
test('range and capacity caps still award pickup points at their limits',()=>{for(const [stage,key,value] of [[1,'range',5],[2,'capacity',10]]){const s=new Campaign([13,37,19,53],true,stage);s.state[key]=value;s.state.map[33]=6;s.processPlayer({});assert.equal(s.state[key],value);assert.equal(s.state.score,1000);}});
test('six secret reward types and their original point awards are available',()=>{for(let type=0;type<6;type++){const stage=type===0?8:type,s=new Campaign([13,37,19,53],true,stage||8);assert.equal(s.state.bonus.type,type);s.state.bonus.status=1;s.state.bonus.x=1;s.state.bonus.y=1;s.checkBonus();assert.equal(s.state.bonus.status,2);assert.equal(s.state.score,[10000,20000,10000000,500000,30000,20000000][type]);}});
test('six secret reward triggers, spawn coordinates, RNG and collection scores match original routines',()=>{for(const v of golden.secrets){const s=new Campaign(v.seed,true,v.stage),i=v.initial;Object.assign(s.state.player,{x:i.x,y:i.y});if(i.noEnemies)s.state.enemies.forEach(e=>e.type=0);Object.assign(s.state,{exitDwell:i.exitDwell,destroyed:i.destroyed,chainReactions:i.chain,keyTimer:i.keyTimer,exitBombed:i.exitBombed});s.state.bonus.visits=[...i.visits];s.checkBonus();const b=s.state.bonus;assert.deepEqual(plain({status:b.status,timer:b.timer,x:b.x,y:b.y,seed:s.rng.seed,visits:b.visits}),v.trigger,'type '+v.type);s.state.frame=1;Object.assign(s.state.player,{x:b.x,y:b.y});s.checkBonus();assert.equal(s.state.score,v.collectedScore);assert.equal(b.status,v.collectedStatus);}});
