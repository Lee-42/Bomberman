import { DEMO_INPUT } from '../content/original/Flow';
import { StageCommand } from './Stage1';
/** Original GET_INPUT run-length stream; elapsed frame returns the previous pad state. */
export class DemoPlayback {
 private index=0;private remaining=DEMO_INPUT[0];
 next():StageCommand|null {if(this.index>=DEMO_INPUT.length)return null;const bits=DEMO_INPUT[this.index+1];if(--this.remaining===0){this.index+=2;this.remaining=DEMO_INPUT[this.index]||1;}return {directions:([['right',1],['left',2],['down',4],['up',8]] as const).filter(([,bit])=>bits&bit).map(([direction])=>direction),bomb:!!(bits&128),detonate:!!(bits&64)};}
}
