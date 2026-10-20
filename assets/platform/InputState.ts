import type { Direction, InputCommand } from '../core/Simulation';

/** Keyboard and touch submit actions here, never update gameplay objects directly. */
export class InputState {
  private held = new Map<string,Direction>();
  private pendingBomb = false;
  hold(source:string,direction:Direction):void { this.held.delete(source);this.held.set(source,direction); }
  release(source:string):void { this.held.delete(source); }
  bomb():void { this.pendingBomb=true; }
  clear():void { this.held.clear();this.pendingBomb=false; }
  activeDirections():Direction[] { return Array.from(new Set(this.held.values())); }
  consume():InputCommand {
    // Cocos' loose spread transform assumes arrays; convert the Map iterator explicitly.
    const values=Array.from(this.held.values());
    const result={ direction:values.length?values[values.length-1]:null,bomb:this.pendingBomb };
    this.pendingBomb=false;return result;
  }
}
