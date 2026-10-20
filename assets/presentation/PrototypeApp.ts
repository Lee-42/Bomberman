import { _decorator, Component, Node, Canvas, Camera, UITransform, Graphics, Color, Label, Vec3, Vec4,
  view, ResolutionPolicy, Layers, input, Input, EventKeyboard, KeyCode, EventTouch,
  MeshRenderer, Material, primitives, utils, DirectionalLight, game, Game, profiler } from 'cc';
import { Simulation, createLabLevel, LAB_RULES, Direction } from '../core/Simulation';
import { InputState } from '../platform/InputState';

const { ccclass } = _decorator;
const UI = Layers.Enum.UI_2D, WORLD = Layers.Enum.DEFAULT;
const HEX = (s:string) => new Color().fromHEX(s);
const BG='#101921', INK='#E8EFE7', MUTED='#8A9C9D', ACCENT='#C8F16B';
type RenderMode = 'pixel' | 'three';

/** Both renderers read one simulation. Presentation never advances gameplay. */
@ccclass('PrototypeApp')
export class PrototypeApp extends Component {
  private sim = new Simulation(createLabLevel());
  private controls = new InputState();
  private mode:RenderMode = 'pixel';
  private paused=false;
  private accumulator=0;
  private canvasNode!:Node;
  private pixelNode!:Node;
  private graphics!:Graphics;
  private worldNode!:Node;
  private worldCamera!:Camera;
  private status!:Label;
  private modeLabel!:Label;
  private message!:Label;
  private pauseLabel!:Label;
  private meshes = new Map<string,Node>();
  private materials = new Map<string,Material>();

  start():void {
    view.setDesignResolutionSize(1080,900,ResolutionPolicy.SHOW_ALL);
    view.resizeWithBrowserSize(true);profiler.hideStats();
    const cn=new Node('WorldCamera');this.node.addChild(cn);cn.layer=WORLD;
    this.worldCamera=cn.addComponent(Camera);
    this.worldCamera.projection=Camera.ProjectionType.ORTHO;
    this.worldCamera.orthoHeight=8.1;
    this.worldCamera.clearFlags=Camera.ClearFlag.SOLID_COLOR;
    this.worldCamera.clearColor=HEX(BG);this.worldCamera.visibility=WORLD;
    cn.setPosition(0,17,14);cn.lookAt(new Vec3(0,0,0));

    const light=new Node('Sun');this.node.addChild(light);light.layer=WORLD;
    light.setRotationFromEuler(-45,-35,0);light.addComponent(DirectionalLight).illuminance=52000;
    const ambient=this.node.scene.globals.ambient;
    ambient.skyColor= new Vec4(0.7,0.76,0.82,1);ambient.skyIllum=15000;

    this.worldNode=new Node('3D presentation');this.node.addChild(this.worldNode);
    this.canvasNode=new Node('Interface');this.node.addChild(this.canvasNode);this.canvasNode.layer=UI;
    this.canvasNode.addComponent(UITransform).setContentSize(1080,900);
    const canvas=this.canvasNode.addComponent(Canvas);
    const ucn=new Node('UICamera');this.node.addChild(ucn);ucn.layer=UI;ucn.setPosition(0,0,1000);
    const uiCamera=ucn.addComponent(Camera);uiCamera.projection=Camera.ProjectionType.ORTHO;
    uiCamera.orthoHeight=450;uiCamera.near=1;uiCamera.far=2000;
    uiCamera.clearFlags=Camera.ClearFlag.DEPTH_ONLY;uiCamera.visibility=UI;uiCamera.priority=10;
    canvas.cameraComponent=uiCamera;
    this.canvasNode.setPosition(0,0,0);

    this.label('MAZE LAB',-315,399,42,INK,310);
    this.label('01  /  技术验证',335,405,20,ACCENT,300);
    this.label('同一份游戏状态 · 像素与立体两种表现',-195,355,19,MUTED,600);
    this.modeLabel=this.button('切换到 3D  [V]',335,350,230,48,()=>this.toggleMode());
    this.pixelNode=new Node('Pixel presentation');this.canvasNode.addChild(this.pixelNode);this.pixelNode.layer=UI;
    this.pixelNode.addComponent(UITransform).setContentSize(720,528);
    this.graphics=this.pixelNode.addComponent(Graphics);
    this.status=this.label('',0,302,17,MUTED,1020);
    this.message=this.label('',0,-281,21,ACCENT,1000);
    this.button('←',-383,-352,70,62,undefined,'left');
    this.button('↑',-306,-319,70,55,undefined,'up');
    this.button('↓',-306,-381,70,55,undefined,'down');
    this.button('→',-229,-352,70,62,undefined,'right');
    this.button('放置炸弹  [SPACE]',-5,-352,220,62,()=>this.controls.bomb());
    this.pauseLabel=this.button('暂停  [P]',230,-352,145,62,()=>this.togglePause());
    this.button('重新开始  [R]',400,-352,165,62,()=>this.restart());
    this.label('方向键 / WASD 移动    ·    炸弹 2.67 秒后引爆    ·    小心十字火焰',0,-413,17,MUTED,1040);
    this.label('实验地图与占位图形；用于验证工程结构，非原版关卡。',0,-438,15,MUTED,1040);
    input.on(Input.EventType.KEY_DOWN,this.keyDown,this);
    input.on(Input.EventType.KEY_UP,this.keyUp,this);
    game.on(Game.EVENT_HIDE,this.background,this);
    this.worldNode.active=false;
    // Read-only tooling surface, absent from the simulation and portable between builds.
    (globalThis as any).__mazeLab={snapshot:()=>this.sim.snapshot(),mode:()=>this.mode,
      toggle:()=>this.toggleMode(),restart:()=>this.restart(),command:(d:Direction|null,b=false)=>this.sim.step({direction:d,bomb:b})};
  }
  onDestroy():void {
    input.off(Input.EventType.KEY_DOWN,this.keyDown,this);input.off(Input.EventType.KEY_UP,this.keyUp,this);
    game.off(Game.EVENT_HIDE,this.background,this);
    for(const material of this.materials.values())material.destroy();
    delete (globalThis as any).__mazeLab;
  }
  private background():void { this.paused=true;this.controls.clear();this.keys.clear();this.pauseLabel.string='继续  [P]'; }
  private label(text:string,x:number,y:number,size:number,color:string,width=500):Label {
    const n=new Node(text||'Label');this.canvasNode.addChild(n);n.layer=UI;n.setPosition(x,y,0);
    n.addComponent(UITransform).setContentSize(width,size*1.5);
    const label=n.addComponent(Label);label.string=text;label.fontSize=size;label.lineHeight=size*1.4;
    label.color=HEX(color);label.isBold=size>30;
    label.horizontalAlign=Label.HorizontalAlign.CENTER;label.verticalAlign=Label.VerticalAlign.CENTER;
    return label;
  }
  private button(text:string,x:number,y:number,w:number,h:number,action?:()=>void,direction?:Direction):Label {
    const n=new Node(text);this.canvasNode.addChild(n);n.layer=UI;n.setPosition(x,y,0);
    n.addComponent(UITransform).setContentSize(w,h);
    const g=n.addComponent(Graphics);g.fillColor=HEX('#24343D');g.roundRect(-w/2,-h/2,w,h,10);g.fill();
    const label=this.label(text,x,y,18,INK,w);
    // Label is a sibling, so touches consistently target the button hit area.
    label.node.getComponent(UITransform)!.priority=0;
    n.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{
      if(direction)this.controls.hold(`touch-${e.getID()}`,direction);else action?.();
    });
    const release=(e:EventTouch)=>this.controls.release(`touch-${e.getID()}`);
    n.on(Node.EventType.TOUCH_END,release);n.on(Node.EventType.TOUCH_CANCEL,release);
    return label;
  }
  private keyDirection(code:KeyCode):Direction|null {
    if(code===KeyCode.ARROW_UP||code===KeyCode.KEY_W)return 'up';
    if(code===KeyCode.ARROW_DOWN||code===KeyCode.KEY_S)return 'down';
    if(code===KeyCode.ARROW_LEFT||code===KeyCode.KEY_A)return 'left';
    if(code===KeyCode.ARROW_RIGHT||code===KeyCode.KEY_D)return 'right';return null;
  }
  private keys=new Set<number>();
  private keyDown(e:EventKeyboard):void {
    const d=this.keyDirection(e.keyCode);if(d)this.controls.hold(`key-${e.keyCode}`,d);
    if(this.keys.has(e.keyCode))return;this.keys.add(e.keyCode);
    if(e.keyCode===KeyCode.SPACE)this.controls.bomb();
    if(e.keyCode===KeyCode.KEY_V)this.toggleMode();
    if(e.keyCode===KeyCode.KEY_R)this.restart();
    if(e.keyCode===KeyCode.KEY_P||e.keyCode===KeyCode.ESCAPE)this.togglePause();
  }
  private keyUp(e:EventKeyboard):void {this.keys.delete(e.keyCode);this.controls.release(`key-${e.keyCode}`);}
  private toggleMode():void {
    this.mode=this.mode==='pixel'?'three':'pixel';
    this.pixelNode.active=this.mode==='pixel';this.worldNode.active=this.mode==='three';
    this.modeLabel.string=this.mode==='pixel'?'切换到 3D  [V]':'切换到像素  [V]';
    // No simulation reconstruction or reset occurs here.
  }
  private togglePause():void {this.paused=!this.paused;this.controls.clear();this.pauseLabel.string=this.paused?'继续  [P]':'暂停  [P]';}
  private restart():void {
    this.sim=new Simulation(createLabLevel());this.accumulator=0;this.paused=false;this.controls.clear();
    this.pauseLabel.string='暂停  [P]';
    for(const n of this.meshes.values())n.destroy();this.meshes.clear();
  }
  update(dt:number):void {
    if(!this.status)return;
    if(!this.paused){
      this.accumulator+=Math.min(dt,0.1);
      while(this.accumulator>=1/LAB_RULES.stepHz){this.sim.step(this.controls.consume());this.accumulator-=1/LAB_RULES.stepHz;}
    }
    const s=this.sim.state;
    this.status.string=`${this.mode==='pixel'?'PIXEL / 2D':'SPATIAL / 3D'}     TICK ${String(s.tick).padStart(6,'0')}     炸弹 ${s.bombs.length}/${LAB_RULES.capacity}     已破坏 ${s.destroyed} 块`;
    this.message.string=!s.player.alive?'被火焰击中了 · 按 R 或点击「重新开始」':this.paused?'已暂停 · 按 P 继续':'放下炸弹，沿走廊躲到火焰范围之外';
    if(this.mode==='pixel')this.drawPixel();else this.drawThree();
  }
  private rect(x:number,y:number,w:number,h:number,color:string):void {
    const g=this.graphics;g.fillColor=HEX(color);g.rect(x,y,w,h);g.fill();
  }
  private drawPixel():void {
    const s=this.sim.state,g=this.graphics;g.clear();const tile=48,left=-360,top=270;
    this.rect(left-8,top-528-8,736,544,'#050C10');
    for(let y=0;y<this.sim.level.height;y++)for(let x=0;x<this.sim.level.width;x++){
      const c=this.sim.cell(x,y),px=left+x*tile,py=top-(y+1)*tile;
      this.rect(px,py,tile,tile,'#12682D');
      if(c===1){
        this.rect(px,py,48,48,'#596861');this.rect(px+2,py+3,43,43,'#C2C9B4');
        this.rect(px+3,py+40,42,5,'#E0E3CD');this.rect(px+40,py+4,5,35,'#929F93');
      }else if(c===2){
        this.rect(px,py,48,48,'#47594E');
        for(let row=0;row<3;row++)for(let col=0;col<3;col++){
          const bx=px+col*24-(row%2)*12;const start=Math.max(px+2,bx+2),end=Math.min(px+47,bx+23);
          if(end>start)this.rect(start,py+row*16+2,end-start,12,'#B3BEAA');
        }
      }else {this.rect(px+5,py+8,2,2,'#197B37');this.rect(px+30,py+33,2,2,'#197B37');}
    }
    for(const f of s.flames){
      const x=left+f.x*tile,y=top-(f.y+1)*tile;
      this.rect(x+3,y+13,42,22,'#ED701E');this.rect(x+13,y+3,22,42,'#ED701E');
      this.rect(x+5,y+18,38,12,'#FFF0A2');this.rect(x+18,y+5,12,38,'#FFF0A2');
    }
    for(const b of s.bombs){
      const x=left+b.x*tile+24,y=top-b.y*tile-24;
      g.fillColor=HEX('#0A101A');g.circle(x,y,15+(Math.floor(s.tick/12)%2));g.fill();
      this.rect(x-7,y+5,7,6,'#7A8A8D');this.rect(x+3,y+15,4,8,'#F4D369');
    }
    const px=left+s.player.x*tile+6,py=top-s.player.y*tile-45;
    const white=s.player.alive?'#EDF0DB':'#939C95',walk=Math.floor(s.tick/8)%2*3;
    this.rect(px+4,py+15,28,26,white);this.rect(px+8,py+23,20,10,'#EDA776');
    this.rect(px+10,py+24,4,7,'#1C2332');this.rect(px+22,py+24,4,7,'#1C2332');
    this.rect(px+9,py+6,18,13,'#3969CF');this.rect(px,py+7,8,9,white);this.rect(px+28,py+7,8,9,white);
    this.rect(px+5,py+walk,11,7,white);this.rect(px+22,py+3-walk,11,7,white);
  }
  private material(color:string):Material {
    let m=this.materials.get(color);if(!m){m=new Material();m.initialize({effectName:'builtin-unlit',defines:{USE_VERTEX_COLOR:true}});
      m.setProperty('mainColor',HEX(color));this.materials.set(color,m);}return m;
  }
  private mesh(key:string,kind:'box'|'sphere',x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string):void {
    let n=this.meshes.get(key);if(!n){n=new Node(key);n.layer=WORLD;this.worldNode.addChild(n);
      const renderer=n.addComponent(MeshRenderer);
      const geometry=kind==='box'?primitives.box():primitives.sphere(0.5,{segments:12});
      // Lightweight per-face shading keeps this proof scene independent of PBR assets.
      const normals=geometry.normals||[],colors:number[]=[];
      for(let i=0;i<normals.length;i+=3){const shade=0.65+0.35*Math.max(0,normals[i]*0.25+normals[i+1]*0.8+normals[i+2]*0.35);colors.push(shade,shade,shade,1);}
      geometry.colors=colors;renderer.mesh=utils.createMesh(geometry);
      renderer.setMaterial(this.material(color),0);this.meshes.set(key,n);}
    n.setPosition(x,y,z);n.setScale(sx,sy,sz);n.active=true;
  }
  private drawThree():void {
    const frame=view.getFrameSize();
    this.worldCamera.orthoHeight=9.6*Math.max(1,1.2/(frame.width/frame.height));
    const live=new Set<string>();const draw=(key:string,kind:'box'|'sphere',x:number,y:number,z:number,sx:number,sy:number,sz:number,c:string)=>{
      live.add(key);this.mesh(key,kind,x,y,z,sx,sy,sz,c);
    };
    draw('floor','box',0,-0.23,0,15.2,0.4,11.2,'#285F4C');
    for(let y=0;y<11;y++)for(let x=0;x<15;x++){
      const c=this.sim.cell(x,y);if(c)draw(`cell-${x}-${y}`,'box',x-7,c===1?0.48:0.35,y-5,0.94,c===1?0.96:0.7,0.94,c===1?'#A9BBB4':'#D2A978');
    }
    const s=this.sim.state;
    for(const b of s.bombs){
      draw(`bomb-${b.id}`,'sphere',b.x-7,0.32,b.y-5,0.65,0.65,0.65,'#26313F');
      draw(`fuse-${b.id}`,'box',b.x-7,0.72,b.y-5,0.09,0.2,0.09,'#F4D369');
    }
    s.flames.forEach(f=>draw(`flame-${f.x}-${f.y}`,'box',f.x-7,0.32,f.y-5,0.82,0.64,0.82,'#FF942F'));
    const x=s.player.x-7,z=s.player.y-5;
    draw('body','box',x,0.4,z,0.48,0.5,0.42,'#426ECE');
    draw('head','box',x,0.87,z,0.66,0.58,0.57,s.player.alive?'#E6ECD9':'#838F88');
    draw('visor','box',x,0.88,z+0.29,0.44,0.25,0.035,'#EFAD83');
    draw('eye-l','box',x-0.12,0.9,z+0.32,0.06,0.16,0.03,'#15212C');
    draw('eye-r','box',x+0.12,0.9,z+0.32,0.06,0.16,0.03,'#15212C');
    draw('foot-l','box',x-0.16,0.08,z+0.07,0.23,0.16,0.38,'#E6ECD9');
    draw('foot-r','box',x+0.16,0.08,z+0.07,0.23,0.16,0.38,'#E6ECD9');
    for(const [key,n] of this.meshes)if(!live.has(key))n.active=false;
  }
}
