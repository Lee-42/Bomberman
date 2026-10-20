import { ORIGINAL_TABLES as T } from '../content/original/Tables';
import { beginEnding, advanceEnding, EndingState } from './Ending';
import { ResumeData } from './Password';
import { MUSIC_FRAMES } from '../content/original/Flow';
import { STAGES } from '../content/original/Stages';
export type Facing = 1 | 2 | 3 | 4; // right, up, left, down
export type StagePhase = 'intro' | 'playing' | 'dying' | 'death' | 'gameover' | 'clear' | 'bonusClear' | 'complete';
export interface StageCommand { direction?: 'left'|'right'|'up'|'down'|null; directions?:('left'|'right'|'up'|'down')[]; bomb?:boolean;detonate?:boolean }
export interface Actor { x:number;y:number;u:number;v:number;frame:number;flip:boolean }
export interface Enemy extends Actor { slot:number;type:number;face:Facing;wait:number;moveTimer:number;turnTimer:number;chain:number;score:number }
export interface Fire { active:number;x:number;y:number;travel:number;visual:number }
export interface StageBomb {active:boolean;x:number;y:number;elapsed:number;fuse:number;tile:number}
export interface StageEvent { kind:'music'|'effect'|'explosion';id:number }
export interface StageState {
 tick:number;frame:number;phase:StagePhase;phaseTicks:number;map:number[];tiles:number[];player:Actor;
 bombs:StageBomb[];fires:Fire[];enemies:Enemy[];time:number;lives:number;score:number;range:number;
 capacity:number;speed:boolean;scroll:number;destroyed:number;celebrated:boolean;seed:number[];
 ending:EndingState|null;debug:boolean;demo:boolean;stage:number;mode:'normal'|'bonus';wallPass:boolean;remote:boolean;bombPass:boolean;fireSuit:boolean;invulnerableTimer:number;
 defeated:number;exitDwell:number;exitBombed:number;chainReactions:number;keyTimer:number;lastAction:boolean;
 bonus:{type:number;status:number;timer:number;x:number;y:number;visits:number[];visible:boolean};
}
const DX=[0,1,0,-1,0],DY=[0,0,-1,0,1],OPPOSITE=[0,3,4,1,2];
/** NES PRNG with explicit carry. Seed advances are deterministic and independently checked. */
export class OriginalRandom {
 seed:number[];
 carry=0;
 constructor(seed:number[]){this.seed=seed.map(n=>n&255);}
 next(carry=this.carry):number {
  let a=this.seed[0],c=carry;
  const rol=()=>{const old=a;a=((a<<1)|c)&255;c=old>>>7;};
  const adc=(b:number)=>{const n=a+b+c;a=n&255;c=n>255?1:0;};
  rol();rol();a^=0x41;rol();rol();a^=0x93;adc(this.seed[1]);this.seed[0]=a;
  rol();rol();a^=0x12;rol();rol();adc(this.seed[2]);this.seed[1]=a;
  adc(this.seed[0]);this.seed[2]=(this.seed[2]+1)&255;
  if(this.seed[2]===0){this.seed[3]=(this.seed[3]+0x1d)&255;c=this.seed[3]<0x1d?1:0;}
  a^=this.seed[3];this.carry=c;return a;
 }
 coords(map:number[],carry=this.carry):{x:number;y:number} {
  this.carry=carry;
  for(let tries=0;tries<100000;tries++){
   const a=this.next(),x=(a>>>2)&31;this.carry=(a>>>1)&1;
   if(!x)continue;
   let y=0;
   do {const b=this.next();y=(b>>>3)&15;this.carry=(b>>>2)&1;if(y)this.carry=y>=12?1:0;}while(!y||y>=12);
   if(map[y*32+x]!==0){this.carry=0;continue;}
   this.carry=x>=3?1:0;if(x<3){this.carry=y>=3?1:0;if(y<3)continue;}
   return {x,y};
  }
  throw Error('No free map coordinates');
 }
}
export function concreteMap():number[]{return Array.from({length:416},(_,i)=>{
 const x=i%32,y=Math.floor(i/32);return y===0||y===12||x===0||x>=30||(y%2===0&&x%2===0)?1:0;
});}
export function stageMap(rng:OriginalRandom,stage:number,carry=1):number[]{
 if(stage<1||stage>50||!Number.isInteger(stage))throw Error('Stage must be 1..50');
 const map=concreteMap();let p=rng.coords(map,carry);map[p.y*32+p.x]=4;
 p=rng.coords(map);map[p.y*32+p.x]=5;
 for(let i=0;i<50+stage*2;i++){p=rng.coords(map,i===0?0:rng.carry);map[p.y*32+p.x]=2;}return map;
}
export function firstMap(rng:OriginalRandom,carry=1):number[]{return stageMap(rng,1,carry);}
/** Independent, data-driven original campaign. No emulator, platform or rendering dependency. */
export class Campaign {
 readonly state:StageState;
 readonly rng:OriginalRandom;
 private events:StageEvent[]=[];
 constructor(seed=[0,0,0,0],skipIntro=false,startStage=1,private stopAfterStage=50,startMode:'normal'|'bonus'='normal'){
  if(!STAGES[startStage-1])throw Error('Stage must be 1..50');
  this.rng=new OriginalRandom(seed);
  this.state={tick:0,frame:0,phase:'intro',phaseTicks:0,map:[],tiles:[],player:{x:1,y:1,u:8,v:8,frame:0,flip:false},bombs:[],fires:[],enemies:[],time:200,lives:2,score:0,range:1,capacity:1,speed:false,scroll:0,destroyed:0,celebrated:false,seed:this.rng.seed,ending:null,debug:false,demo:false,stage:startStage,mode:'normal',wallPass:false,remote:false,bombPass:false,fireSuit:false,invulnerableTimer:0,defeated:0,exitDwell:0,exitBombed:0,chainReactions:0,keyTimer:0,lastAction:false,bonus:{type:1,status:0,timer:0,x:0,y:0,visits:[0,0,0,0],visible:false}};
  this.state.mode=startMode;this.resetLevel(skipIntro);this.events.push({kind:'music',id:skipIntro?(startMode==='bonus'?6:3):2});
 }
 private resetLevel(skipIntro=false):void {
  const s=this.state;s.map=s.mode==='bonus'?concreteMap():stageMap(this.rng,s.stage);s.tiles=s.map.map(c=>c===4||c===5?(s.debug?(c===4?8:40+STAGES[s.stage-1].powerup):2):c);
  s.player={x:1,y:1,u:8,v:8,frame:0,flip:s.player.flip};s.bombs=Array.from({length:10},()=>({active:false,x:0,y:0,elapsed:0,fuse:0,tile:8}));
  s.fires=Array.from({length:80},()=>({active:0,x:0,y:0,travel:0,visual:0}));const previousEnemies=s.enemies;s.enemies=[];
  for(let slot=9;slot>=0;slot--){
   const type=STAGES[s.stage-1].enemies[9-slot],e:Enemy={slot,type,x:0,y:0,u:8,v:8,frame:(type?type-1:0)*4,flip:previousEnemies[slot]?.flip||false,face:1,wait:0,moveTimer:0,turnTimer:0,chain:0,score:0};
   if(type){e.face=((this.rng.next(0)&3)+1) as Facing;let p;do{p=this.rng.coords(s.map,0);}while(p.x<5);e.x=p.x;e.y=p.y;}
   s.enemies[slot]=e;
  }
  if(s.mode==='bonus'){s.enemies.forEach(e=>e.type=0);s.invulnerableTimer=1;}
  s.time=s.mode==='bonus'?30:200;s.scroll=0;s.phase=skipIntro?'playing':'intro';s.phaseTicks=0;s.celebrated=false;s.destroyed=0;
  s.defeated=0;s.exitDwell=0;s.exitBombed=0;s.chainReactions=0;s.keyTimer=0;s.lastAction=false;
  const type=(s.stage&7)<6?s.stage&7:s.stage&1;
  s.bonus={type,status:0,timer:0,x:0,y:0,visits:[0,0,0,0],visible:false};
 }
 cell(x:number,y:number):number {return x<0||x>=32||y<0||y>=13?1:this.state.map[y*32+x];}
 drainEvents():StageEvent[]{const events=this.events;this.events=[];return events;}
 resume(data:ResumeData):void {Object.assign(this.state,data,{lives:2,demo:false,mode:'normal',bombPass:false,invulnerableTimer:0,ending:null});this.resetLevel();this.events=[];this.music(2);}
 snapshot():StageState{return JSON.parse(JSON.stringify(this.state)) as StageState;}
 step(command:StageCommand={}):void {
  const s=this.state;s.tick++;s.frame=(s.frame+1)&255;s.phaseTicks++;
  if(s.phase==='intro'){if(s.phaseTicks>=MUSIC_FRAMES[2]){s.phase='playing';s.phaseTicks=0;this.music(s.mode==='bonus'?6:3);}return;}
  if(s.phase==='death'){if(s.phaseTicks>=MUSIC_FRAMES[8]){s.lives--;if(s.lives<0){s.phase='gameover';this.music(9);}else{this.resetLevel();this.music(2);}s.phaseTicks=0;}return;}
  if(s.phase==='clear'){if(s.phaseTicks>=MUSIC_FRAMES[10]){
   s.lives++;
   if(s.stage>=this.stopAfterStage){s.phase='complete';s.phaseTicks=0;s.ending=beginEnding(s.player.frame,s.player.flip);this.music(7);}
   else{s.stage++;s.mode=s.stage%5===1?'bonus':'normal';this.resetLevel();this.music(2);}
  }return;}
  if(s.phase==='bonusClear'){if(s.phaseTicks>=MUSIC_FRAMES[10]){s.mode='normal';s.invulnerableTimer=0;this.resetLevel();this.music(2);}return;}
  if(s.phase==='complete'){if(s.ending){const waiting=s.ending.waiting;advanceEnding(s.ending,s.frame);if(waiting&&(command.direction||command.directions?.length||command.bomb||command.detonate)){s.stage=1;s.mode='normal';s.ending=null;this.resetLevel();this.music(2);}}return;}
  if(s.phase==='gameover')return;
  if(s.mode==='bonus'){
   if(s.time===0){s.phase='bonusClear';s.phaseTicks=0;this.music(10);return;}
   this.respawn(Math.min(8,Math.floor(s.stage/5)));
  }
  if(s.mode==='normal'&&s.invulnerableTimer&&(s.frame&7)===0&&--s.invulnerableTimer===0)this.music(3);
  if(s.phase==='dying'){
   if((s.frame&15)===0&&++s.player.frame>=20){s.phase='death';s.phaseTicks=0;s.wallPass=false;s.remote=false;s.bombPass=false;s.fireSuit=false;s.invulnerableTimer=0;this.music(8);return;}
  }else this.processPlayer(command);
  this.tickBombs();
  if(s.player.frame<19){const p=s.player;s.scroll=p.x<8?0:p.x>=23?240:(p.x*16+p.u-128)&255;}
  this.think();
  for(const b of s.bombs)if(b.active&&(b.elapsed&15)===0){b.tile=T.BOMB_ANIM[(b.elapsed>>>4)&3];s.tiles[b.y*32+b.x]=b.tile;}
  if((s.frame&63)===0&&s.time!==255){s.time=(s.time-1)&255;if(s.mode==='normal'&&s.time===0)this.spawnTimeout();}
  if(s.mode==='normal'){
   if(!s.celebrated&&!s.enemies.some(e=>e.type>0&&e.type<9)){s.celebrated=true;this.effect(6);}
   this.checkBonus();
  }
  if((s.phase as StagePhase)==='clear')return;
  if((s.frame&(s.mode==='bonus'?1:3))===0){this.advanceFire();this.fireDamage();}
 }
 private music(id:number):void{this.events.push({kind:'music',id});}
 private effect(id:number):void{this.events.push({kind:'effect',id});}
 private processPlayer(command:StageCommand):void {
  const s=this.state,p=s.player,c=this.cell(p.x,p.y);
  if(p.u===8&&p.v===8){
   if(c===6){s.map[p.y*32+p.x]=0;s.tiles[p.y*32+p.x]=0;this.collectPowerup();}
   if(c===8){s.exitDwell=(s.exitDwell+1)&255;s.keyTimer=0;if(!s.enemies.some(e=>e.type>0&&e.type<9)){s.phase='clear';s.phaseTicks=0;this.music(10);return;}}
  }
  if(!s.speed&&(s.frame&3)===0)return;
  const held=command.directions||(command.direction?[command.direction]:[]);
  if(!held.length&&!command.bomb&&!command.detonate){s.keyTimer=0;s.lastAction=false;}
  for(const direction of ['right','left','up','down'] as const)if(held.includes(direction)){const face=({right:1,up:2,left:3,down:4} as const)[direction];this.move(p,face,0);
   if(face===1||face===3)p.flip=face===1;
   const start=face===1||face===3?0:face===4?4:8;
   if((s.frame&3)===2){s.keyTimer=(s.keyTimer+1)&255;p.frame++;if(p.frame<=start)p.frame=start;else if(p.frame>start+3){p.frame=start;this.effect(start===0?1:2);}}
  }
  if(command.bomb)this.placeBomb();
  else if(command.detonate&&s.remote&&!s.lastAction){s.lastAction=true;for(let i=9;i>=0;i--){const b=s.bombs[i];if(b.active){this.explode(b,0);b.active=false;s.map[b.y*32+b.x]=0;break;}}}
 }
 private collectPowerup():void {
  const s=this.state,type=STAGES[s.stage-1].powerup;this.addScore(1000);this.effect(4);
  if(type===1)s.capacity=Math.min(10,s.capacity+1);
  if(type===2)s.range=Math.min(5,s.range+1);
  if(type===3)s.speed=true;if(type===4)s.wallPass=true;if(type===5)s.remote=true;
  if(type===6)s.bombPass=true;if(type===7)s.fireSuit=true;if(type===8)s.invulnerableTimer=255;
  this.music(type>=7?5:4);
 }
 private addScore(amount:number):void {if(this.state.demo)return;const score=this.state.score+amount;this.state.score=score>=1000000000?900000000+score%100000000:score;}
 private align(a:Actor,field:'u'|'v'):void {if(a[field]<8)a[field]++;else if(a[field]>8)a[field]--;}
 private blocked(x:number,y:number,type:number):number {
  const c=this.cell(x,y);if(c===0||c===6||c===8)return 0;
  if(type===0){if((c===2||c===4||c===5)&&this.state.wallPass)return 0;if(c===3&&this.state.bombPass)return 0;}
  // The original brick check returns the enemy type in A, not the tile ID.
  if(c===2&&type>0)return type===5||type===6||type===8?0:type;return c;
 }
 /** Exact 16-pixel cell/offset movement, including the original corner correction. */
 private move(a:Actor,face:Facing,type:number):number {
  const horizontal=face===1||face===3,offset=horizontal?'u':'v',coord=horizontal?'x':'y',cross=horizontal?'v':'u',positive=face===1||face===4;
  if((positive&&a[offset]<8)||(!positive&&a[offset]>8)){a[offset]+=positive?1:-1;return 0;}
  const hit=this.blocked(a.x+DX[face],a.y+DY[face],type);if(hit)return hit;
  this.align(a,cross);a[offset]+=positive?1:-1;
  if(a[offset]===16){a[offset]=0;a[coord]++;}else if(a[offset]<0){a[offset]=15;a[coord]--;}
  return 0;
 }
 placeBomb():boolean {
  const s=this.state,p=s.player;if(s.phase!=='playing'||this.cell(p.x,p.y)!==0)return false;
  let slot=s.capacity-1;while(slot>=0&&s.bombs[slot].active)slot--;if(slot<0)return false;
  this.align(p,'u');this.align(p,'v');const b=s.bombs[slot];Object.assign(b,{active:true,x:p.x,y:p.y,elapsed:0,fuse:160,tile:0});
  s.map[p.y*32+p.x]=3;this.effect(3);return true;
 }
 private tickBombs():void {
  const s=this.state;for(let i=9;i>=0;i--){const b=s.bombs[i];if(!b.active)continue;
   const c=this.cell(b.x,b.y);if(c===3){b.elapsed=(b.elapsed+1)&255;if(s.remote||--b.fuse>0)continue;}
   this.explode(b,c===3?0:c&7);s.chainReactions=Math.min(255,s.chainReactions+1);b.active=false;s.map[b.y*32+b.x]=0;
  }
 }
 private fireSlot():Fire|undefined {for(let i=79;i>=0;i--)if(!this.state.fires[i].active)return this.state.fires[i];return undefined;}
 private explode(b:StageBomb,hitDirection:number):void {
  const omitted=[255,3,4,1,2][hitDirection];
  for(const direction of [1,2,3,4,0]){if(direction===omitted)continue;const f=this.fireSlot();if(f)Object.assign(f,{active:1,x:b.x+DX[direction],y:b.y+DY[direction],travel:direction,visual:direction});}
  this.events.push({kind:'explosion',id:1});
 }
 private advanceFire():void {
  const s=this.state;
  for(let i=79;i>=0;i--){const f=s.fires[i];if(!f.active)continue;const index=f.y*32+f.x,c=this.cell(f.x,f.y);
   if(f.active&128){f.active++;if(f.active===0x87){f.active=0;s.map[index]=0;}continue;}
   if(c!==0){
    if(c===2){s.destroyed=(s.destroyed+1)&255;f.active=0x80;continue;}
    if(c===3)s.map[index]=f.travel|16;
    else if(c===4){s.map[index]=8;s.tiles[index]=40;}
    else if(c===5){s.map[index]=6;s.tiles[index]=40+STAGES[s.stage-1].powerup;}
    else if(c===8||c===6){if(c===6){s.map[index]=0;s.tiles[index]=0;}else s.exitBombed=(s.exitBombed+1)&255;this.spawnExit(f.x,f.y);}
    f.active=0;continue;
   }
   f.visual=(f.visual+8)&255;if((f.visual&127)>=72){f.active=0;continue;}
   const travel=f.travel,direction=travel&7;if(!direction)continue;
   f.travel=0;const next=this.fireSlot();if(!next)continue;
   Object.assign(next,{active:1,x:f.x+DX[direction],y:f.y+DY[direction],visual:direction,travel:0});
   if(travel+16>=s.range*16){next.active=0;f.visual|=128;}else next.travel=travel+16;
  }
 }
 private fireDamage():void {
  const s=this.state;let chain=0;
  for(let i=79;i>=0;i--){const f=s.fires[i];if(!f.active)continue;
   let tile=0;
   if(f.active&128)tile=T.EXPLOSION_FRAMES[f.active&127];
   else {const v=f.visual;if(!(v&120))continue;
    if(v&128)tile=T.EXPLOSION_FRAMES[27+((v>>>1)&60)+(v&7)];
    else if(v&7)tile=T.EXPLOSION_FRAMES[14+((v>>>2)&30)+(((v&1)^1))];
    else tile=T.EXPLOSION_FRAMES[7+(v>>>3)];
   }
   s.tiles[f.y*32+f.x]=tile;
   if(tile){if(s.phase==='playing'&&s.mode==='normal'&&!s.fireSuit&&!s.invulnerableTimer&&s.player.x===f.x&&s.player.y===f.y)this.die();
    for(let n=9;n>=0;n--){const e=s.enemies[n];if(e.type>0&&e.type<9&&e.x===f.x&&e.y===f.y){s.defeated=(s.defeated+1)&255;s.bonus.visits.fill(0);e.face=e.type as Facing;e.chain=chain++;e.frame=32+((e.frame>>>2)&7);e.type=9;e.moveTimer=100;}}
   }
  }
 }
 private die():void {if(this.state.phase!=='playing')return;this.state.phase='dying';this.state.phaseTicks=0;this.state.player.frame=12;this.effect(5);}
 /** Original six secret-reward conditions selected by the stage's low three bits. */
 private checkBonus():void {
  const s=this.state,b=s.bonus,p=s.player;b.visible=false;
  if(b.status===2)return;
  if(b.status===1){
   if((s.frame&1)===0){b.timer=(b.timer-1)&255;if(b.timer===0)b.status=2;}
   b.visible=true;if(p.x===b.x&&p.y===b.y){this.addScore([10000,20000,10000000,500000,30000,20000000][b.type]);b.status=2;this.effect(4);}return;
  }
  const corner=p.x===1?(p.y===1?0:p.y===11?2:-1):p.x===29?(p.y===1?1:p.y===11?3:-1):-1;
  if(corner>=0)b.visits[corner]=(b.visits[corner]+1)&255;
  if(p.x!==1&&p.x!==29&&p.y!==1&&p.y!==11)b.visits.fill(0);
  const noEnemies=!s.enemies.some(e=>e.type>0&&e.type<9);
  const trigger=[s.defeated===0&&s.exitDwell!==0,noEnemies&&b.visits.every(n=>n!==0),noEnemies&&s.destroyed===0,s.chainReactions>=248,s.exitDwell!==0&&s.keyTimer>=248,s.defeated===0&&s.destroyed>=50+s.stage*2&&s.exitBombed===3][b.type];
  if(trigger){
   b.status=1;b.timer=0;const edge=p.x===1||p.x===29||p.y===1||p.y===11;
   const pos=this.rng.coords(s.map,b.type===0||b.type===2?(edge?1:0):1);b.x=pos.x;b.y=pos.y;
  }
 }
 private turnVertical(e:Enemy,carry:number):number {if(this.state.phase==='dying')return carry;const p=this.state.player;if(e.x!==p.x)return e.x>=p.x?1:0;e.face=e.y<p.y?4:2;return e.y>=p.y?1:0;}
 private turnHorizontal(e:Enemy,carry:number):number {if(this.state.phase==='dying')return carry;const p=this.state.player;if(e.y!==p.y)return e.y>=p.y?1:0;e.face=e.x<p.x?1:3;return e.x>=p.x?1:0;}
 private think():void {
  const s=this.state;
  for(let i=9;i>=0;i--){const e=s.enemies[i];if(!e.type)continue;if(e.wait&&--e.wait)continue;
   if(e.type>=9){
    if(e.type===9&&--e.moveTimer===0){e.type=10;e.frame=40;e.moveTimer=20;}
    else if(e.type===10&&--e.moveTimer===0){e.moveTimer=10;if(++e.frame===44){const scoreIndex=Math.min(16,e.chain+e.face);e.score=[100,100,200,400,800,1000,2000,4000,8000,10000,20000,40000,80000,100000,200000,400000,800000][scoreIndex];this.addScore(e.score);e.type=11;e.moveTimer=100;}}
    else if(e.type===11&&--e.moveTimer===0)e.type=0;continue;
   }
   const start=(e.type-1)*4;if((s.frame&7)===0){e.frame++;if(e.frame<=start||e.frame>start+3)e.frame=start;}
   e.flip=e.face>=3;
   if(e.type===7||e.type===8){this.thinkPontan(e);}
   else {
    const eligible=!((e.type===1||e.type===6)&&!(s.frame&1))&&!((e.type===2||e.type===3)&&(s.frame&3)===0)&&!(e.type===5&&(s.frame&3)!==0);
    if(eligible){
    e.turnTimer=(e.turnTimer-1)&255;const threshold=e.type===1||e.type===6?20:e.type===2||e.type===3?150:200;let carry=e.turnTimer>=threshold?1:0;
    if(!carry){if(e.type!==3)carry=this.turnVertical(e,carry);if(e.type!==2)carry=this.turnHorizontal(e,carry);}
    if(e.moveTimer){e.moveTimer--;const hit=this.move(e,e.face,e.type);if(hit){if(hit>=3){e.face=OPPOSITE[e.face] as Facing;e.turnTimer=0;e.moveTimer=96;}else e.moveTimer=0;}}
    else {const a=this.rng.next(carry);e.moveTimer=32+((a&24)<<2);e.face=((a>>>6)+1) as Facing;}
    }
   }
   // Original collision occurs only for sprites currently within the viewport.
   const left=e.x*16+e.u-8-s.scroll;
   if(left>=0&&left<248&&s.phase==='playing'&&s.mode==='normal'&&!s.invulnerableTimer&&e.x===s.player.x&&e.y===s.player.y)this.die();
  }
 }
 private thinkPontan(e:Enemy):void {
  if(e.type===8)e.flip=e.frame===29;
  if(e.turnTimer){if(--e.turnTimer===0)return;}else{this.turnVertical(e,0);this.turnHorizontal(e,0);}
  const alternative=[1,4,4,2,1,3,2,4,3,1][e.face*2+e.chain];
  if(e.u===8&&e.v===8&&!this.blocked(e.x+DX[alternative],e.y+DY[alternative],e.type)){e.face=alternative as Facing;e.chain^=1;e.moveTimer=0;}
  e.moveTimer=(e.moveTimer+1)&255;if(e.moveTimer>=31)e.chain^=1;
  const hit=this.move(e,e.face,e.type);if(hit){if(hit>=3){e.turnTimer=96;e.face=OPPOSITE[e.face] as Facing;}else e.face=(e.face%4+1) as Facing;}
 }
 private spawnExit(x:number,y:number):void {let carry=1;const type=STAGES[this.state.stage-1].exitEnemy;for(let i=9;i>=0;i--){const e=this.state.enemies[i];if(!e.type){Object.assign(e,{type,frame:type,x,y,u:8,v:8,face:(this.rng.next(carry)&3)+1,chain:0,moveTimer:0,turnTimer:0,wait:30});carry=0;}}}
 private respawn(type:number):void {for(let i=9;i>=0;i--){const e=this.state.enemies[i];if(e.type)continue;const face=(this.rng.next(0)&3)+1,p=this.rng.coords(this.state.map,0);Object.assign(e,{type,frame:(type-1)*4,x:p.x,y:p.y,u:8,v:8,face,chain:0,moveTimer:0,turnTimer:0,wait:30});}}
 private spawnTimeout():void {this.state.enemies.forEach(e=>e.type=0);this.respawn(8);}
}
/** Stable, single-stage harness retained for the original comparison fixtures. */
export class Stage1 extends Campaign {constructor(seed=[0,0,0,0],skipIntro=false){super(seed,skipIntro,1,1);}}
