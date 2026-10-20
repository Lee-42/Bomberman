import { _decorator, Component, Node, Canvas, Camera, UITransform, Graphics, Color, Rect, Size, Vec2,
 Sprite, SpriteFrame, Texture2D, ImageAsset, resources, Mask, Layers, view, ResolutionPolicy,
 input, Input, EventKeyboard, KeyCode, game, Game, profiler, AudioSource, AudioClip, sys, Font } from 'cc';
import { Campaign, StageCommand, Actor, Enemy } from '../core/Stage1';
import { ORIGINAL_TABLES as T } from '../content/original/Tables';
import { encodePassword, decodePassword } from '../core/Password';
import { DemoPlayback } from '../core/Demo';
import { MUSIC_FRAMES } from '../content/original/Flow';
import { InputState } from '../platform/InputState';
import {FollowCamera,landscapeLayout,LandscapeLayout,PadDirection} from '../platform/Landscape';
import {TouchHud,HudState} from './TouchHud';
const {ccclass}=_decorator;
const UI=Layers.Enum.UI_2D,BG='#101a16';
const color=(hex:string)=>new Color().fromHEX(hex);
interface DrawItem {sprite:Sprite;key:string}

/** Cocos-only presentation of the original campaign. */
@ccclass('BombermanApp')
export class BombermanApp extends Component {
 private root!:Node;
 private viewport!:Node;
 private items:DrawItem[]=[];
 private used=0;
 private textures=new Map<string,Texture2D>();
 private frames=new Map<string,SpriteFrame>();
 private clips=new Map<string,AudioClip>();
 private music!:AudioSource;
 private effects!:AudioSource;
 private currentMusic=0;
 private muted=false;
 private paused=false;
 private ready=false;
 private title=true;
 private menuOption=0;
 private highScore=0;
 private titleTicks=0;
 private uiTicks=0;
 private passwordMode=false;
 private passwordCode='';
 private passwordChar='';
 private passwordError=false;
 private demo:DemoPlayback|null=null;
 private accumulator=0;
 private sim=new Campaign(this.newSeed());
 private controls=new InputState();
 private held=new Set<number>();
 private bombTicks=0;
 private detonateTicks=0;
 private touchBombs=new Set<number>();
 private touchDetonators=new Set<number>();
 private screen!:Node;
 private camera!:Camera;
 private backdrop!:Graphics;
 private hud!:TouchHud;
 private layout!:LandscapeLayout;
 private follow=new FollowCamera();
 private frameWidth=0;
 private frameHeight=0;
 private imageOriginX=-128;
 private imageOriginY=120;
 private worldMode=false;
 private drawScroll=0;
 private padDirection:PadDirection|null=null;
 private cameraStage='';
 private loadError=false;
 private readonly keys:Record<number,NonNullable<StageCommand['direction']>>={
  [KeyCode.ARROW_RIGHT]:'right',[KeyCode.KEY_D]:'right',[KeyCode.ARROW_LEFT]:'left',[KeyCode.KEY_A]:'left',
  [KeyCode.ARROW_UP]:'up',[KeyCode.KEY_W]:'up',[KeyCode.ARROW_DOWN]:'down',[KeyCode.KEY_S]:'down',
 };
 start():void {
  view.resizeWithBrowserSize(true);profiler.hideStats();
  this.root=new Node('Landscape original campaign');this.node.addChild(this.root);this.root.layer=UI;
  this.root.addComponent(UITransform);const canvas=this.root.addComponent(Canvas);
  const cameraNode=new Node('Landscape UI camera');this.root.addChild(cameraNode);cameraNode.layer=UI;cameraNode.setPosition(0,0,1000);
  this.camera=cameraNode.addComponent(Camera);this.camera.projection=Camera.ProjectionType.ORTHO;this.camera.near=1;this.camera.far=2000;
  this.camera.visibility=UI;this.camera.clearFlags=Camera.ClearFlag.SOLID_COLOR;this.camera.clearColor=color(BG);canvas.cameraComponent=this.camera;
  const background=new Node('Map edge background');this.root.addChild(background);background.layer=UI;this.backdrop=background.addComponent(Graphics);
  this.screen=new Node('Pixel world / original cutscenes');this.root.addChild(this.screen);this.screen.layer=UI;this.screen.addComponent(UITransform);
  this.viewport=new Node('Scene viewport');this.screen.addChild(this.viewport);this.viewport.layer=UI;this.viewport.addComponent(UITransform);this.viewport.addComponent(Mask).type=Mask.Type.GRAPHICS_RECT;
  this.music=this.node.addComponent(AudioSource);this.music.playOnAwake=false;this.music.volume=0.55;
  this.effects=this.node.addComponent(AudioSource);this.effects.playOnAwake=false;this.effects.volume=0.65;
  this.hud=new TouchHud(this.root,{
   direction:direction=>this.touchDirection(direction),
   bomb:(id,held)=>{if(held){const playing=!this.title&&!this.passwordMode&&!this.demo&&!this.paused;this.resumeAudio();this.action();if(playing)this.touchBombs.add(id);}else this.touchBombs.delete(id);},
   remote:(id,held)=>{if(held){this.resumeAudio();this.touchDetonators.add(id);this.detonateTicks=4;}else this.touchDetonators.delete(id);},
   pause:()=>this.togglePause(),sound:()=>this.toggleSound(),restart:()=>this.restart(),home:()=>this.showMenu(),
   backspace:()=>{this.passwordCode=this.passwordCode.slice(0,-1);this.passwordChar='';},
  });
  this.refreshLayout(true);
  input.on(Input.EventType.KEY_DOWN,this.keyDown,this);input.on(Input.EventType.KEY_UP,this.keyUp,this);
  game.on(Game.EVENT_HIDE,this.onHide,this);
  this.load();
  // Serializable diagnostic surface; no test-only win button in the product UI.
  (globalThis as any).__bomberman={snapshot:()=>this.sim.snapshot(),status:()=>({ready:this.ready,title:this.title,paused:this.paused,muted:this.muted,currentMusic:this.currentMusic,audioClips:this.clips.size,musicPlaying:this.music.playing,menuOption:this.menuOption,passwordMode:this.passwordMode,passwordLength:this.passwordCode.length,demo:!!this.demo,highScore:this.highScore,presentation:this.hud.diagnostics()}),restart:()=>this.restart(),
   startStage:(stage:number,bonus=false)=>{this.sim=new Campaign(this.newSeed(),false,stage,50,bonus?'bonus':'normal');this.title=false;this.passwordMode=false;this.demo=null;this.paused=false;this.clearInput();this.sim.drainEvents();this.playMusic(2);}};
 }
 private async load():Promise<void> {
  try {
   const images=['metatiles','actors-palette0','actors-palette1','actors-palette2','actors-palette3','actors-ending','ending-ground','chr-bank1-palette0','chr-bank0-palette1','menu-font','title-us'];
   await Promise.all(images.map(name=>new Promise<void>((resolve,reject)=>resources.load(`original/${name}`,ImageAsset,(err,image)=>{
    if(err){reject(err);return;}const texture=new Texture2D();texture.image=image;texture.setFilters(Texture2D.Filter.NEAREST,Texture2D.Filter.NEAREST);texture.setMipFilter(Texture2D.Filter.NONE);this.textures.set(name,texture);resolve();
   }))));
   await new Promise<void>((resolve,reject)=>resources.load('ui/hud-pixel',Font,(err,font)=>{if(err){reject(err);return;}this.hud.setFont(font);resolve();}));
   this.ready=true;
   const names=['music-01','music-02','music-03','music-04','music-05','music-06','music-07','music-08','music-09','music-10','effect-1','effect-2','effect-3','effect-4','effect-5','effect-6','explosion-dpcm','password-low','password-high'];
   await Promise.all(names.map(name=>new Promise<void>(resolve=>resources.load(`original/audio/${name}`,AudioClip,(err,clip)=>{if(!err){this.clips.set(name,clip);if(this.title&&name==='music-01')this.playMusic(1);if(this.currentMusic&&name===`music-${String(this.currentMusic).padStart(2,'0')}`)this.playMusic(this.currentMusic);}resolve();}))));
  }catch(error){this.loadError=true;console.error('Original resources failed to load',error);}
 }
 private touchDirection(direction:PadDirection|null):void {
  if(this.padDirection===direction)return;this.padDirection=direction;this.controls.release('touch-pad');this.resumeAudio();
  if(!direction)return;
  if(this.demo){this.showMenu();return;}if(this.title){this.selectMenu();return;}
  if(this.passwordMode){this.cyclePassword(direction==='right'||direction==='down'?1:-1);return;}
  if(!this.paused)this.controls.hold('touch-pad',direction);
 }
 private refreshLayout(force=false):void {
  const frame=view.getFrameSize();if(!force&&frame.width===this.frameWidth&&frame.height===this.frameHeight)return;
  this.frameWidth=frame.width;this.frameHeight=frame.height;
  const height=720,width=height*Math.max(.4,frame.width/Math.max(1,frame.height));
  view.setDesignResolutionSize(width,height,ResolutionPolicy.SHOW_ALL);this.root.getComponent(UITransform)!.setContentSize(width,height);this.camera.orthoHeight=height/2;
  const safe=sys.getSafeAreaRect(false);
  this.layout=landscapeLayout(width,height,{left:Math.max(0,safe.x),right:Math.max(0,width-safe.x-safe.width),bottom:Math.max(0,safe.y),top:Math.max(0,height-safe.y-safe.height)});
  this.backdrop.clear();this.backdrop.fillColor=color(BG);this.backdrop.rect(-width/2,-height/2,width,height);this.backdrop.fill();
  this.backdrop.fillColor=new Color(49,72,56,70);for(let x=-width/2;x<width/2;x+=48)for(let y=-height/2;y<height/2;y+=48)this.backdrop.rect(x,y,3,3);this.backdrop.fill();
  this.hud.setLayout(this.layout);this.clearInput();this.follow.reset();
  if(this.layout.portrait&&!this.title&&!this.passwordMode){this.paused=true;this.music.pause();}
 }
 private setSceneView(dt:number):void {
  const s=this.sim.state,world=!this.title&&!this.passwordMode&&!['intro','gameover','complete'].includes(s.phase);
  this.worldMode=world;this.drawScroll=world?0:s.scroll;
  if(world){
   const stage=`${s.stage}/${s.mode}`;if(stage!==this.cameraStage){this.cameraStage=stage;this.follow.reset();}
   const p=s.player,c=this.follow.follow({x:p.x*16+p.u,y:p.y*16+p.v+32},this.layout,this.paused?0:dt);
   this.screen.setPosition(0,0);this.screen.setScale(this.layout.scale,this.layout.scale,1);
   this.viewport.getComponent(UITransform)!.setContentSize(this.layout.width/this.layout.scale,this.layout.height/this.layout.scale);
   this.imageOriginX=-c.x;this.imageOriginY=c.y;
  }else{
   this.follow.reset();const scale=Math.max(.25,Math.min((this.layout.height-118)/240,(this.layout.width-160)/256));
   this.screen.setPosition(0,-15);this.screen.setScale(scale,scale,1);this.viewport.getComponent(UITransform)!.setContentSize(256,240);
   this.imageOriginX=-128;this.imageOriginY=120;
  }
 }
 private hudState(message:string):HudState {const s=this.sim.state;return {title:this.title,menuOption:this.menuOption,password:this.passwordMode,paused:this.paused,muted:this.muted,ready:this.ready,demo:!!this.demo,phase:s.phase,bonus:s.mode==='bonus',powers:[s.speed?'加速':'',s.wallPass?'穿墙':'',s.bombPass?'穿弹':'',s.fireSuit?'防火':'',s.invulnerableTimer?'无敌':''].filter(Boolean).join(' · '),remote:s.remote,stage:s.stage,time:s.time,score:s.score,lives:s.lives,range:s.range,capacity:s.capacity,message};}
 private resumeAudio():void {if(this.currentMusic&&!this.demo&&!this.passwordMode&&!this.muted&&this.music.clip&&!this.music.playing&&!this.paused)this.music.play();}
 private showMenu():void {if(!this.demo)this.highScore=Math.max(this.highScore,this.sim.state.score);this.title=true;this.passwordMode=false;this.demo=null;this.titleTicks=0;this.paused=false;this.clearInput();this.playMusic(1);}
 private selectMenu():void {if(this.title){this.menuOption^=1;this.titleTicks=0;}else this.showMenu();}
 private begin():void {if(!this.ready)return;if(this.menuOption===1){this.title=false;this.passwordMode=true;this.passwordCode='';this.passwordChar='';this.passwordError=false;this.clearInput();this.music.stop();this.currentMusic=0;return;}this.restart();}
 private passwordBeep(high=false):void {if(this.muted)return;const clip=this.clips.get(high?'password-high':'password-low');if(clip)this.effects.playOneShot(clip,0.65);}
 private cyclePassword(delta:number):void {this.passwordBeep();const n=this.passwordChar?this.passwordChar.charCodeAt(0)-65:delta>0?-1:16;this.passwordChar=String.fromCharCode(65+((n+delta+16)%16));this.passwordError=false;}
 private enterPassword(c:string):void {this.passwordBeep(true);this.passwordError=false;this.passwordCode+=c;this.passwordChar='';if(this.passwordCode.length<20)return;const data=decodePassword(this.passwordCode);if(!data){this.passwordCode='';this.passwordError=true;return;}this.sim=new Campaign(this.newSeed());this.sim.resume(data);this.passwordMode=false;this.title=false;this.paused=false;this.clearInput();this.flushAudio();}
 private action():void {if(this.demo){this.showMenu();return;}if(this.passwordMode){if(this.passwordChar)this.enterPassword(this.passwordChar);return;}if(this.title){this.begin();return;}if(this.sim.state.phase==='gameover'){if(this.sim.state.phaseTicks>=MUSIC_FRAMES[9])this.showMenu();return;}this.bombTicks=4;}
 private keyDown(e:EventKeyboard):void {
  if(this.held.has(e.keyCode))return;this.held.add(e.keyCode);this.resumeAudio();
  if(this.demo){this.showMenu();return;}
  if(e.keyCode===KeyCode.TAB){this.selectMenu();return;}
  if(this.passwordMode){if(e.keyCode===KeyCode.ESCAPE){this.showMenu();return;}if(e.keyCode===KeyCode.BACKSPACE){this.passwordCode=this.passwordCode.slice(0,-1);this.passwordChar='';return;}if(e.keyCode>=KeyCode.KEY_A&&e.keyCode<=KeyCode.KEY_P){this.enterPassword(String.fromCharCode(e.keyCode));return;}const dir=this.keys[e.keyCode];if(dir){this.cyclePassword(dir==='right'?1:-1);return;}if(e.keyCode===KeyCode.SPACE||e.keyCode===KeyCode.ENTER)this.action();return;}
  const direction=this.keys[e.keyCode];
  if(this.title){if(direction){this.selectMenu();return;}if(e.keyCode===KeyCode.ENTER||e.keyCode===KeyCode.SPACE)this.action();return;}
  if(this.sim.state.phase==='gameover'){if(e.keyCode===KeyCode.ENTER||this.sim.state.phaseTicks>=MUSIC_FRAMES[9])this.showMenu();return;}
  if(direction)this.controls.hold(`key-${e.keyCode}`,direction);
  if(e.keyCode===KeyCode.SPACE||e.keyCode===KeyCode.ENTER)this.action();
  if(e.keyCode===KeyCode.KEY_P||e.keyCode===KeyCode.ESCAPE)this.togglePause();
  if(e.keyCode===KeyCode.KEY_R){if(!this.paused)this.togglePause();this.hud.requestRestart();}if(e.keyCode===KeyCode.KEY_M)this.toggleSound();
  if(e.keyCode===KeyCode.KEY_B)this.detonateTicks=4;
 }
 private keyUp(e:EventKeyboard):void {this.held.delete(e.keyCode);this.controls.release(`key-${e.keyCode}`);}
 private clearInput():void {this.controls.clear();this.held.clear();this.touchBombs.clear();this.touchDetonators.clear();this.bombTicks=0;this.detonateTicks=0;this.accumulator=0;this.padDirection=null;this.hud?.clearTouches();}
 private onHide():void {if(!this.title&&!this.passwordMode)this.paused=true;this.clearInput();this.music.pause();}
 private togglePause():void {if(this.title||this.passwordMode)return;this.paused=!this.paused;this.clearInput();if(this.paused)this.music.pause();else if(!this.muted)this.music.play();}
 private toggleSound():void {this.muted=!this.muted;this.music.volume=this.muted?0:0.55;this.effects.volume=this.muted?0:0.65;}
 private newSeed():number[] {const now=Date.now();return [now&255,(now>>>8)&255,(now>>>16)&255,(now>>>24)&255];}
 private restart():void {this.sim=new Campaign(this.newSeed());this.title=false;this.passwordMode=false;this.demo=null;this.paused=false;this.clearInput();this.sim.drainEvents();this.follow.reset();this.playMusic(2);}
 private playMusic(id:number):void {this.currentMusic=id;const clip=this.clips.get(`music-${String(id).padStart(2,'0')}`);if(!clip)return;this.music.stop();this.music.clip=clip;this.music.loop=id>=3&&id<=6;this.music.volume=this.muted?0:0.55;if(!this.paused)this.music.play();}
 private flushAudio():void {if(this.demo){this.sim.drainEvents();return;}for(const event of this.sim.drainEvents()){
  if(event.kind==='music')this.playMusic(event.id);
  else if(!this.muted){const clip=this.clips.get(event.kind==='explosion'?'explosion-dpcm':`effect-${event.id}`);if(clip)this.effects.playOneShot(clip,0.65);}
 }}
 update(dt:number):void {
  if(!this.hud)return;this.refreshLayout();
  if(!this.ready){this.hud.update(this.hudState(this.loadError?'素材读取失败，请重新打开页面':'正在读取原版素材…'));return;}
  this.uiTicks+=Math.min(dt,0.1)*60;
  if(this.title){this.titleTicks+=Math.min(dt,0.1)*60;if(this.titleTicks>=2048){this.demo=new DemoPlayback();this.sim=new Campaign([0,0,0,0]);Object.assign(this.sim.state,{range:4,capacity:10,remote:true,demo:true});this.title=false;this.music.stop();this.clearInput();}}
  if(!this.title&&!this.passwordMode&&!this.paused){this.accumulator+=Math.min(dt,0.1);while(this.accumulator>=1/60){
   const command:StageCommand={...this.controls.consume(),directions:this.controls.activeDirections()};command.bomb=this.bombTicks>0||this.held.has(KeyCode.SPACE)||this.touchBombs.size>0;if(this.bombTicks>0)this.bombTicks--;
   command.detonate=this.detonateTicks>0||this.held.has(KeyCode.KEY_B)||this.touchDetonators.size>0;if(this.detonateTicks>0)this.detonateTicks--;
   const demoWasPlaying=!!this.demo&&this.sim.state.phase==='playing';
   const demoCommand=demoWasPlaying?this.demo!.next():null;
   this.sim.step(this.demo?(demoCommand||{}):command);this.accumulator-=1/60;this.flushAudio();if(this.demo&&(['dying','death','clear','gameover','complete'].includes(this.sim.state.phase)||demoWasPlaying&&!demoCommand)){this.showMenu();break;}
  }}
  const s=this.sim.state;if(!this.demo)this.highScore=Math.max(this.highScore,s.score);
  const powers=[s.speed?'加速':'',s.wallPass?'穿墙':'',s.remote?'遥控':'',s.bombPass?'穿弹':'',s.fireSuit?'防火':'',s.invulnerableTimer?'无敌':''].filter(Boolean).join(' / ');
  const message=this.passwordMode?(this.passwordError?'密码无效，请重新输入':`方向盘选择 A–P · 点击确认 · 删除键回退`):this.demo?'原版待机演示 · 任意键返回菜单':this.title?'方向盘切换 START / CONTINUE · 点右侧开始':this.paused?'已暂停':s.phase==='complete'?(s.ending?.waiting?'50 关已完成 · 点击继续进入下一轮':'50 关已完成 · 正在播放结局'):s.phase==='gameover'?'GAME OVER · 记下密码，可在 CONTINUE 续关':s.phase==='dying'||s.phase==='death'?'失去一条生命，正在重新开始…':s.phase==='intro'?(s.mode==='bonus'?'BONUS STAGE':`STAGE ${s.stage}`):s.phase==='clear'?`STAGE ${s.stage} CLEAR`:s.phase==='bonusClear'?'奖励关结束，准备进入下一关':s.mode==='bonus'?'奖励关 · 无敌 · 敌人持续出现':`敌人 ${s.enemies.filter(e=>e.type>0&&e.type<9).length} · 火力 ${s.range} · 炸弹 ${s.capacity}${powers?' · '+powers:''}`;
  this.hud.update(this.hudState(message));this.setSceneView(dt);
  this.used=0;
  if(this.title){this.image('title-us',0,0,256,240,0,0);this.text(this.menuOption?' ':'@',64,152,true);this.text(this.menuOption?'@':' ',128,152,true);this.text((this.highScore?String(Math.floor(this.highScore/100)):'').padStart(7,' ')+'00',112,168,true);}
  else if(this.passwordMode){this.text('ENTER SECRET CODE',56,56,true);this.text(this.passwordCode,48,128,true);if((Math.floor(this.uiTicks/10)&1)===0)this.text(this.passwordChar||'_',48+this.passwordCode.length*8,128,true);}
  else if(s.phase==='intro'){if(s.mode==='bonus')this.text('BONUS STAGE',80,120,true);else{this.text('STAGE',80,120,true);this.text(String(s.stage).padStart(2,' '),128,120,true);}}
  else if(s.phase==='gameover'){this.text('GAME OVER',80,120,true);this.text(encodePassword(s),48,192,true);}
  else if(s.phase==='complete')this.drawCompleted();
  else this.drawStage();
  for(let i=this.used;i<this.items.length;i++)this.items[i].sprite.node.active=false;
 }
 private frame(name:string,x:number,y:number,w:number,h:number):SpriteFrame {
  const key=`${name}/${x}/${y}/${w}/${h}`;let frame=this.frames.get(key);if(!frame){frame=new SpriteFrame();frame.texture=this.textures.get(name)!;frame.rect=new Rect(x,y,w,h);frame.originalSize=new Size(w,h);frame.offset=new Vec2(0,0);frame.packable=false;this.frames.set(key,frame);}return frame;
 }
 /** All positions remain integer NES pixels until the root's integer enlargement. */
 private image(name:string,sx:number,sy:number,w:number,h:number,x:number,y:number,flip=false):void {
  let item=this.items[this.used];if(!item){const n=new Node('Pixel sprite');n.layer=UI;this.viewport.addChild(n);n.addComponent(UITransform);const sprite=n.addComponent(Sprite);sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.trim=true;item={sprite,key:''};this.items.push(item);}
  this.used++;const n=item.sprite.node;n.active=true;const key=`${name}/${sx}/${sy}/${w}/${h}`;if(key!==item.key){item.sprite.spriteFrame=this.frame(name,sx,sy,w,h);item.key=key;}
  n.getComponent(UITransform)!.setContentSize(w,h);n.setPosition(this.imageOriginX+x+w/2,this.imageOriginY-y-h/2);n.setScale(flip?-1:1,1,1);n.setSiblingIndex(this.used-1);
 }
 private tile(id:number,x:number,y:number):void {this.image('metatiles',(id%10)*16,Math.floor(id/10)*16,16,16,x,y);}
 private actor(a:Actor,id:number,palette:number):void {this.image(`actors-palette${palette}`,(id%8)*16,Math.floor(id/8)*16,16,16,a.x*16+a.u-8-this.drawScroll,a.y*16+a.v+24,a.flip);}
 private text(value:string,x:number,y:number,menu=false):void {for(let i=0;i<value.length;i++){const code=value.charCodeAt(i)===32?58:value.charCodeAt(i);this.image(menu?'menu-font':'chr-bank1-palette0',(code%16)*8,Math.floor(code/16)*8,8,8,x+i*8,y);}}
 private score(e:Enemy):void {const scoreIndex=Math.min(16,e.chain+e.face),ones=[0xec,0xed,0xee,0xef,0xfc,0xfd,0xfe,0xff],tiles=scoreIndex<9?[ones[Math.max(0,scoreIndex-1)],0x46]:[ones[Math.min(7,scoreIndex-9)],0x46,0x46];let x=e.x*16+e.u-8-this.drawScroll;for(const tile of tiles){this.image('chr-bank0-palette1',(tile%16)*8,Math.floor(tile/16)*8,8,8,x,e.y*16+e.v+24);x+=8;}}
 private drawCompleted():void {
  for(const [text,x,y] of [['CONGRATULATIONS',64,32],['YOU HAVE SUCCEEDED IN',32,56],['HELPING BOMBERMAN TO BECOME',16,72],['A HUMAN BEING',16,88],['MAYBE YOU CAN RECOGNIZE HIM',32,104],['IN ANOTHER HUDSON SOFT GAME',16,120],['GOOD BYE',88,144]] as [string,number,number][])this.text(text,x,y,true);
  this.image('ending-ground',0,0,256,16,0,192);
  const sprite=this.sim.state.ending?.sprite;if(sprite)this.image(sprite.human?'actors-ending':'actors-palette0',(sprite.id%8)*16,Math.floor(sprite.id/8)*16,16,16,sprite.x,sprite.y,sprite.flip);
 }
 private drawStage():void {
  const s=this.sim.state;if(!this.demo)this.highScore=Math.max(this.highScore,s.score);
  for(let y=0;y<13;y++)for(let x=0;x<31;x++)this.tile(s.tiles[y*32+x],x*16-this.drawScroll,32+y*16);
  if(!this.worldMode){
   for(let y=8;y<32;y+=8)this.text('                                ',0,y);
   this.text('TIME',8,16);this.text(s.time===255?'  0':String(s.time).padStart(3,' '),48,16);
   this.text(String(s.score?Math.floor(s.score/100):'').padStart(7,' ')+'00',88,16);this.text('LEFT'+String(Math.max(0,s.lives)).padStart(2,' '),192,16);
  }
  for(let i=0;i<10;i++){const e=s.enemies[i];if(!e.type||e.wait)continue;const left=e.x*16+e.u-8-s.scroll;if(!this.worldMode&&(left<0||left>=248))continue;
   if(e.type===11)this.score(e);else this.actor(e,T.MONSTER_TILE[e.frame],T.MONSTER_ATTR[e.frame]);
  }
  const p=s.player;if(p.frame<19&&s.phase!=='death')this.actor(p,T.BOMBER_ANIM[p.frame],0);
  if(s.bonus.visible){const index=44+s.bonus.type;this.actor({x:s.bonus.x,y:s.bonus.y,u:8,v:8,frame:0,flip:false},T.MONSTER_TILE[index],T.MONSTER_ATTR[index]);}
 }
 onDestroy():void {
  input.off(Input.EventType.KEY_DOWN,this.keyDown,this);input.off(Input.EventType.KEY_UP,this.keyUp,this);game.off(Game.EVENT_HIDE,this.onHide,this);
  this.music?.stop();for(const f of this.frames.values())f.destroy();for(const texture of this.textures.values())texture.destroy();delete (globalThis as any).__bomberman;
 }
}
