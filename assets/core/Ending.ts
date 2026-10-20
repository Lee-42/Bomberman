import { HUMAN_ANIM, MUSIC_FRAMES } from '../content/original/Flow';
import { ORIGINAL_TABLES as T } from '../content/original/Tables';
export interface EndingState {ticks:number;x:number;u:number;frame:number;flip:boolean;human:boolean;waiting:boolean;sprite:{x:number;y:number;id:number;flip:boolean;human:boolean}}
export function beginEnding(frame:number,flip:boolean):EndingState {return {ticks:0,x:0,u:8,frame,flip,human:false,waiting:false,sprite:{x:0,y:176,id:T.BOMBER_ANIM[frame],flip,human:false}};}
/** Mirrors draw-before-move ordering and 8-bit OAM coordinates of END_GAME. */
export function advanceEnding(s:EndingState,frame:number):void {
 if(s.waiting)return;s.ticks++;
 const scroll=!s.human&&s.x>=8?(s.x>=23?240:s.x*16+s.u-128):0;
 s.sprite={x:(s.x*16+s.u-8-scroll)&255,y:176,id:(s.human?HUMAN_ANIM:T.BOMBER_ANIM)[s.frame],flip:s.flip,human:s.human};
 if(!(frame&1)){
  if(s.u<8||s.x<29){if(++s.u===16){s.u=0;s.x++;}}
  s.flip=true;
  if((frame&3)===2){s.frame++;if(s.frame>3)s.frame=0;}
 }
 if(s.x===8)s.human=true;
 if(s.human&&s.ticks>=MUSIC_FRAMES[7])s.waiting=true;
}
