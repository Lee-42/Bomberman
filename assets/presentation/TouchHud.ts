import {Node,UITransform,Graphics,Color,Label,EventTouch,Layers,Font} from 'cc';
import {FourWayPad,LandscapeLayout,PadDirection,Point} from '../platform/Landscape';
const UI=Layers.Enum.UI_2D;
const ink=(alpha=255)=>new Color(240,236,213,alpha);
const shade=(alpha=58)=>new Color(16,29,23,alpha);
const controlInk=(alpha=255)=>new Color(255,255,255,alpha);
const controlFill=(pressed=false)=>new Color(255,255,255,pressed?140:102);
export interface HudActions {
 direction:(direction:PadDirection|null)=>void;bomb:(id:number,held:boolean)=>void;remote:(id:number,held:boolean)=>void;
 pause:()=>void;sound:()=>void;restart:()=>void;home:()=>void;backspace:()=>void;
}
export interface HudState {
 title:boolean;menuOption:number;password:boolean;paused:boolean;muted:boolean;ready:boolean;demo:boolean;
 phase:string;bonus:boolean;powers:string;remote:boolean;stage:number;time:number;score:number;lives:number;range:number;capacity:number;message:string;
}
interface Control {node:Node;graphics:Graphics;label:Label;radius:number;kind:string;touches:Set<number>;hold?:(id:number,held:boolean)=>void}
/** A screen-space pixel HUD. Touch targets intentionally extend beyond the small, translucent visible glyphs. */
export class TouchHud {
 readonly root:Node;
 private padNode:Node;private padGraphics:Graphics;private pad=new FourWayPad();
 private bomb:Control;private remote:Control;private pause:Control;private back:Control;
 private header:Label;private stats:Label;private message:Label;private labels:Label[]=[];
 private modal:Node;private modalGraphics:Graphics;private modalTitle:Label;private modalNote:Label;
 private resume:Control;private sound:Control;private restart:Control;private home:Control;private accept:Control;private cancel:Control;
 private rotate:Node;private layout!:LandscapeLayout;private state!:HudState;private confirming=false;private signature='';
 constructor(parent:Node,private actions:HudActions){
  this.root=this.node(parent,'Landscape touch HUD',1,1);
  this.header=this.label(this.root,'',24,400);this.stats=this.label(this.root,'',24,700);this.message=this.label(this.root,'',24,1100);
  this.header.horizontalAlign=Label.HorizontalAlign.LEFT;this.header.node.getComponent(UITransform)!.setAnchorPoint(0,.5);
  this.stats.horizontalAlign=Label.HorizontalAlign.RIGHT;this.stats.node.getComponent(UITransform)!.setAnchorPoint(1,.5);
  for(const label of [this.header,this.stats]){label.enableWrapText=false;label.overflow=Label.Overflow.SHRINK;}
  this.pause=this.control(this.root,'pause','',25,47,()=>{if(this.state.password)this.actions.home();else this.actions.pause();});
  this.back=this.control(this.root,'back','删除',29,47,()=>this.actions.backspace());
  this.padNode=this.node(this.root,'Continuous four-way pad',280,280);this.padGraphics=this.padNode.addComponent(Graphics);
  this.padNode.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{e.propagationStopped=true;const p=this.relative(e,this.layout.pad);if(this.pad.begin((e.getID()??0),p.x,p.y)){this.actions.direction(this.pad.direction);this.paintPad();}});
  this.padNode.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{e.propagationStopped=true;const p=this.relative(e,this.layout.pad);this.pad.move((e.getID()??0),p.x,p.y);if(this.pad.pointer===(e.getID()??0)){this.actions.direction(this.pad.direction);this.paintPad();}});
  const end=(e:EventTouch)=>{e.propagationStopped=true;if(this.pad.end((e.getID()??0))){this.actions.direction(null);this.paintPad();}};
  this.padNode.on(Node.EventType.TOUCH_END,end);this.padNode.on(Node.EventType.TOUCH_CANCEL,end);
  this.bomb=this.control(this.root,'bomb','放弹',60,79,()=>{},(id,held)=>this.actions.bomb(id,held));
  this.remote=this.control(this.root,'remote','引爆',42,59,()=>{},(id,held)=>this.actions.remote(id,held));
  this.modal=this.node(this.root,'Pause modal',1,1);this.modalGraphics=this.modal.addComponent(Graphics);
  this.modal.on(Node.EventType.TOUCH_START,(e:EventTouch)=>e.propagationStopped=true);
  this.modal.on(Node.EventType.TOUCH_END,(e:EventTouch)=>e.propagationStopped=true);
  this.modalTitle=this.label(this.modal,'已暂停',36,600);this.modalTitle.node.setPosition(0,232);
  this.modalNote=this.label(this.modal,'',22,600);this.modalNote.node.setPosition(0,170);
  this.resume=this.control(this.modal,'menu','继续游戏',0,0,()=>this.actions.pause(),undefined,480,76);
  this.sound=this.control(this.modal,'menu','声音：开',0,0,()=>this.actions.sound(),undefined,480,76);
  this.restart=this.control(this.modal,'menu','重新开始',0,0,()=>this.requestRestart(),undefined,480,76);
  this.home=this.control(this.modal,'menu','返回标题',0,0,()=>{this.confirming=false;this.actions.home();},undefined,480,76);
  this.accept=this.control(this.modal,'menu','确认重开',0,0,()=>{this.confirming=false;this.actions.restart();},undefined,480,76);
  this.cancel=this.control(this.modal,'menu','取消',0,0,()=>{this.confirming=false;this.refresh();},undefined,480,76);
  [this.resume,this.sound,this.restart,this.home].forEach((b,i)=>b.node.setPosition(0,88-i*92));
  this.accept.node.setPosition(0,12);this.cancel.node.setPosition(0,-92);
  this.rotate=this.node(this.root,'Rotate device notice',1,1);const rg=this.rotate.addComponent(Graphics);rg.fillColor=shade(245);rg.rect(-2500,-2500,5000,5000);rg.fill();
  this.label(this.rotate,'请将手机横过来',34,400).node.setPosition(0,30);
  this.label(this.rotate,'横屏后可继续游戏',23,400).node.setPosition(0,-35);
  this.rotate.on(Node.EventType.TOUCH_START,(e:EventTouch)=>e.propagationStopped=true);
 }
 private node(parent:Node,name:string,w:number,h:number):Node {const n=new Node(name);n.layer=UI;parent.addChild(n);n.addComponent(UITransform).setContentSize(w,h);return n;}
 private label(parent:Node,text:string,size:number,width:number):Label {
  size=Math.round(size/12)*12;
  const n=this.node(parent,'HUD text',width,size*1.65),l=n.addComponent(Label);l.string=text;l.fontSize=size;l.lineHeight=size*1.4;l.color=controlInk();l.enableOutline=true;l.outlineColor=shade(230);l.outlineWidth=1;l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;this.labels.push(l);return l;
 }
 setFont(font:Font):void {for(const label of this.labels){label.font=font;label.useSystemFont=false;}}
 private relative(e:EventTouch,center:Point):Point {const p=e.getUILocation();return {x:p.x-this.layout.width/2-center.x,y:p.y-this.layout.height/2-center.y};}
 private control(parent:Node,kind:string,text:string,radius:number,hitRadius:number,action:()=>void,hold?:(id:number,held:boolean)=>void,w=hitRadius*2,h=hitRadius*2):Control {
  const node=this.node(parent,`${kind} touch control`,w,h),graphics=node.addComponent(Graphics),label=this.label(node,text,kind==='menu'?27:22,Math.max(82,w));
  if(kind!=='menu')label.color=controlInk();
  label.node.setPosition(0,kind==='bomb'?-34:kind==='remote'?-24:0);
  const c={node,graphics,label,radius,kind,touches:new Set<number>(),hold};
  node.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{e.propagationStopped=true;c.touches.add((e.getID()??0));this.paintControl(c);if(hold)hold((e.getID()??0),true);else action();});
  const release=(e:EventTouch)=>{e.propagationStopped=true;if(c.touches.delete((e.getID()??0)))hold?.((e.getID()??0),false);this.paintControl(c);};
  node.on(Node.EventType.TOUCH_END,release);node.on(Node.EventType.TOUCH_CANCEL,release);this.paintControl(c);return c;
 }
 private outline(g:Graphics,r:number,pressed=false):void {
  // A finer square grid keeps the original pixel silhouette without a heavy rim.
  const steps=Math.max(8,Math.round(r/6)),unit=r/steps,right:Point[]=[];
  for(let row=0;row<steps*2;row++){const top=r-row*unit,mid=top-unit/2,x=Math.round(Math.sqrt(Math.max(0,r*r-mid*mid))/unit)*unit;right.push({x,y:top},{x,y:top-unit});}
  const points=[...right,...right.slice().reverse().map(p=>({x:-p.x,y:p.y}))];
  g.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)g.lineTo(points[i].x,points[i].y);g.close();g.fillColor=controlFill(pressed);g.fill();g.strokeColor=controlInk(pressed?255:225);g.lineWidth=1.6;g.stroke();
 }
 private pixels(g:Graphics,rows:string[],unit:number,cx:number,cy:number):void {g.fillColor=controlInk();const w=rows[0].length*unit,h=rows.length*unit;rows.forEach((row,y)=>Array.from(row).forEach((c,x)=>{if(c!==' '){g.rect(cx-w/2+x*unit,cy+h/2-(y+1)*unit,unit,unit);}}));g.fill();}
 private paintControl(c:Control):void {
  const g=c.graphics;g.clear();const pressed=c.touches.size>0;
  if(c.kind==='menu'){
   const size=c.node.getComponent(UITransform)!.contentSize;g.fillColor=shade(pressed?245:230);g.rect(-size.width/2,-size.height/2,size.width,size.height);g.fill();g.strokeColor=ink(pressed?255:105);g.lineWidth=3;g.rect(-size.width/2,-size.height/2,size.width,size.height);g.stroke();return;
  }
  this.outline(g,c.radius,pressed);
  if(c.kind==='bomb')this.pixels(g,['             #    ','           #   #  ','            ###   ','           #   #  ','          #       ','      ######      ','    ##      ##    ','   #          #   ','  #            #  ','  #            #  ','  #            #  ','  #            #  ','   #          #   ','    ##      ##    ','      ######      '],2.6,0,13);
  if(c.kind==='remote')this.pixels(g,['#     #     #','# #   #   # #','#  #  #  #  #','#     #     #','      #      ','     ###     '],2.6,0,11);
  if(c.kind==='pause')this.pixels(g,['#   #','#   #','#   #','#   #','#   #','#   #','#   #'],3,0,0);
 }
 private paintPad():void {
  const g=this.padGraphics;g.clear();this.outline(g,108,this.pad.pointer!==null);
  const offsets:Record<PadDirection,Point>={up:{x:0,y:69},down:{x:0,y:-69},left:{x:-69,y:0},right:{x:69,y:0}};
  for(const direction of ['up','down','left','right'] as PadDirection[]){const p=offsets[direction];g.fillColor=controlInk(this.pad.direction===direction?255:225);const horizontal=direction==='left'||direction==='right',sign=direction==='up'||direction==='right'?1:-1;
   for(let step=-4;step<=4;step++){const a=step*3,b=(6-Math.abs(step)*3)*sign;g.rect(p.x+(horizontal?b:a)-1.5,p.y+(horizontal?a:b)-1.5,3,3);}g.fill();
  }
  const p=this.pad.direction?offsets[this.pad.direction]:{x:0,y:0};g.strokeColor=controlInk(225);g.lineWidth=1.6;g.rect(p.x*.17-16,p.y*.17-16,32,32);g.stroke();
 }
 clearTouches():void {this.pad.clear();this.paintPad();for(const c of [this.bomb,this.remote,this.pause,this.back,this.resume,this.sound,this.restart,this.home,this.accept,this.cancel]){c.touches.clear();this.paintControl(c);}}
 setLayout(layout:LandscapeLayout):void {
  this.layout=layout;this.root.getComponent(UITransform)!.setContentSize(layout.width,layout.height);
  for(const [node,p] of [[this.padNode,layout.pad],[this.bomb.node,layout.bomb],[this.remote.node,layout.remote],[this.pause.node,layout.pause]] as [Node,Point][])node.setPosition(p.x,p.y);
  this.back.node.setPosition(layout.safe.left+170,layout.safe.top-55);
  const top=layout.safe.top-55,left=layout.safe.left+118,right=layout.safe.right-185,available=Math.max(240,right-left),leftWidth=Math.min(345,available*.36);
  this.header.node.setPosition(left,top);this.header.node.getComponent(UITransform)!.setContentSize(leftWidth,44);
  this.stats.node.setPosition(right,top);this.stats.node.getComponent(UITransform)!.setContentSize(Math.max(120,available-leftWidth-30),44);
  this.message.node.setPosition(0,layout.safe.bottom+28);this.message.node.getComponent(UITransform)!.setContentSize(Math.max(300,layout.width-620),38);
  this.modal.getComponent(UITransform)!.setContentSize(layout.width,layout.height);this.modalGraphics.clear();this.modalGraphics.fillColor=shade(235);this.modalGraphics.rect(-layout.width/2,-layout.height/2,layout.width,layout.height);this.modalGraphics.fill();
  this.rotate.getComponent(UITransform)!.setContentSize(layout.width,layout.height);this.paintPad();this.signature='';if(this.state)this.refresh();
 }
 update(state:HudState):void {this.state=state;const signature=JSON.stringify(state);if(signature===this.signature)return;this.signature=signature;this.refresh();}
 private available(c:Control,active:boolean):void {if(!active&&c.touches.size){for(const id of c.touches)c.hold?.(id,false);c.touches.clear();this.paintControl(c);}c.node.active=active;}
 private refresh():void {
  const s=this.state;if(!s||!this.layout)return;if(!s.paused)this.confirming=false;
  this.header.string=s.title?'BOMBERMAN':s.password?'CONTINUE':`${s.demo?'DEMO ':''}${s.phase==='complete'?'CLEAR':s.bonus?'奖励关':`第 ${String(s.stage).padStart(2,'0')} 关`}   TIME ${s.time===255?0:s.time}`;
  this.stats.string=s.title||s.password?'':`${String(s.score).padStart(6,'0')}   LEFT ${Math.max(0,s.lives)}   火力 ${s.range} · 炸弹 ${s.capacity}${s.remote?' · 遥控':''}${s.powers?' · '+s.powers:''}`;
  this.message.string=s.message;this.message.node.active=s.title||s.password||!['playing','clear','dying','death'].includes(s.phase)||s.demo||!s.ready;
  this.bomb.label.string=s.title?(s.menuOption?'续关':'开始'):s.password?'确认':s.phase==='complete'?'继续':s.phase==='gameover'?'菜单':'放弹';
  this.pause.node.active=!s.title;this.back.node.active=s.password;
  const available=s.ready&&!s.paused&&!this.layout.portrait;
  if(!available&&this.pad.pointer!==null){this.pad.clear();this.actions.direction(null);this.paintPad();}
  this.padNode.active=available;this.available(this.bomb,available);this.available(this.remote,available&&s.remote&&!s.title&&!s.password&&!s.demo&&['playing','clear'].includes(s.phase));
  this.modal.active=s.paused&&!this.layout.portrait;this.rotate.active=this.layout.portrait;
  this.modalTitle.string=this.confirming?'重新开始？':'已暂停';this.modalNote.string=this.confirming?'将清除当前进度，从第 1 关开始':'继续后从当前位置恢复';
  this.sound.label.string=s.muted?'声音：关':'声音：开';
  for(const c of [this.resume,this.sound,this.restart,this.home])c.node.active=!this.confirming;
  this.accept.node.active=this.confirming;this.cancel.node.active=this.confirming;
 }
 requestRestart():void {this.confirming=true;this.signature='';}
 diagnostics():object {return {layout:this.layout,padPointer:this.pad.pointer,padDirection:this.pad.direction,bombHeld:this.bomb.touches.size,remoteHeld:this.remote.touches.size,confirmingRestart:this.confirming};}
}
