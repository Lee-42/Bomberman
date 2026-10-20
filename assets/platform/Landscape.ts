export type PadDirection='left'|'right'|'up'|'down';
export interface Insets {left:number;right:number;top:number;bottom:number}
export interface Point {x:number;y:number}
export interface Bounds {left:number;right:number;bottom:number;top:number}
export interface LandscapeLayout {
 width:number;height:number;portrait:boolean;safe:Bounds;pad:Point;bomb:Point;remote:Point;pause:Point;
 zone:Bounds;scale:number;
}
/** All layout units are Cocos design units; the scene is never stretched by aspect ratio. */
export function landscapeLayout(width:number,height:number,insets:Insets={left:0,right:0,top:0,bottom:0}):LandscapeLayout {
 const safe={left:-width/2+insets.left,right:width/2-insets.right,top:height/2-insets.top,bottom:-height/2+insets.bottom};
 const pad={x:safe.left+150,y:safe.bottom+150};
 const bomb={x:safe.right-112,y:safe.bottom+116};
 const remote={x:bomb.x+12,y:bomb.y+154};
 // Keep the entire player sprite away from either thumb's effective hit area.
 const zone={left:Math.min(-48,pad.x+172),right:Math.max(48,bomb.x-132),bottom:Math.max(-height*.035,pad.y+140),top:safe.top-144};
 return {width,height,portrait:width/height<1.18,safe,pad,bomb,remote,pause:{x:safe.left+62,y:safe.top-55},zone,scale:4};
}
/** A single pointer owns the pad. Axis hysteresis prevents diagonal finger jitter from changing direction. */
export class FourWayPad {
 pointer:number|null=null;
 direction:PadDirection|null=null;
 constructor(private deadZone=17,private axisBias=1.25){}
 begin(id:number,x:number,y:number):boolean {if(this.pointer!==null)return false;this.pointer=id;this.move(id,x,y);return true;}
 move(id:number,x:number,y:number):PadDirection|null {
  if(id!==this.pointer)return this.direction;
  const ax=Math.abs(x),ay=Math.abs(y);
  if(Math.hypot(x,y)<this.deadZone){this.direction=null;return null;}
  let horizontal=ax>=ay;
  if(this.direction==='left'||this.direction==='right')horizontal=ay<=ax*this.axisBias;
  else if(this.direction==='up'||this.direction==='down')horizontal=ax>ay*this.axisBias;
  this.direction=horizontal?(x<0?'left':'right'):(y<0?'down':'up');return this.direction;
 }
 end(id:number):boolean {if(id!==this.pointer)return false;this.clear();return true;}
 clear():void {this.pointer=null;this.direction=null;}
}
/** Presentation camera only. Never writes Campaign.scroll (which is part of the original game rules). */
export class FollowCamera {
 x=0;y=0;private initialized=false;
 reset():void {this.initialized=false;}
 follow(player:Point,layout:LandscapeLayout,dt:number):Point {
  const {width,height,scale,zone}=layout;
  if(!this.initialized){
   // Start with as much of the existing map in view as possible, then protect the player's thumb-free area.
   this.x=Math.min(248,width/scale/2);this.y=136;this.initialized=true;
   this.fit(player,zone,scale);return {x:this.x,y:this.y};
  }
  const sx=(player.x-this.x)*scale,sy=(this.y-player.y)*scale;
  const dx=sx<zone.left?(sx-zone.left)/scale:sx>zone.right?(sx-zone.right)/scale:0;
  const dy=sy<zone.bottom?(zone.bottom-sy)/scale:sy>zone.top?(zone.top-sy)/scale:0;
  const blend=1-Math.exp(-14*Math.min(.1,Math.max(0,dt)));
  this.x+=dx*blend;this.y+=dy*blend;
  // Small easing margin; never let easing carry a sprite into either thumb region.
  this.fit(player,{left:zone.left-16,right:zone.right+16,bottom:zone.bottom-16,top:Math.min(height/2-80,zone.top+16)},scale);
  return {x:this.x,y:this.y};
 }
 private fit(p:Point,z:Bounds,scale:number):void {
  this.x=Math.max(p.x-z.right/scale,Math.min(p.x-z.left/scale,this.x));
  this.y=Math.max(p.y+z.bottom/scale,Math.min(p.y+z.top/scale,this.y));
 }
}
