/** Engine-independent, deterministic technical prototype. Not verified NES rules. */
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Cell = 0 | 1 | 2;
export type InputCommand = { direction: Direction | null; bomb?: boolean };
export interface Rules { stepHz: number; speed: number; fuseTicks: number; fireTicks: number; range: number; capacity: number }
export interface Level { id: string; width: number; height: number; cells: Cell[]; spawn: { x: number; y: number } }
export interface Bomb { id: number; x: number; y: number; fuse: number; range: number; canLeave: boolean }
export interface Flame { x: number; y: number; ttl: number }
export interface GameState { tick: number; cells: Cell[]; player: { x: number; y: number; alive: boolean }; bombs: Bomb[]; flames: Flame[]; destroyed: number }

export const LAB_RULES: Rules = { stepHz: 60, speed: 3, fuseTicks: 160, fireTicks: 30, range: 3, capacity: 3 };
const directions: Record<Direction, [number, number]> = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };

export function createLabLevel(): Level {
  const rows = [
    '###############',
    '#...++..+...+.#',
    '#.#.#.#.#.#.#.#',
    '#.+...+...+...#',
    '#.#.#.#.#.#.#.#',
    '#..+...+...+..#',
    '#.#.#.#.#.#.#.#',
    '#.+..+..+..+..#',
    '#.#.#.#.#.#.#.#',
    '#...+...+...+.#',
    '###############',
  ];
  return { id: 'lab-01', width: 15, height: 11, spawn: { x:1,y:1 }, cells: rows.join('').split('').map(c => c==='#' ? 1 : c==='+' ? 2 : 0) };
}

export class Simulation {
  readonly state: GameState;
  private nextId = 1;
  constructor(readonly level: Level, readonly rules: Rules = LAB_RULES) {
    this.state = { tick:0, cells:[...level.cells], player:{...level.spawn,alive:true}, bombs:[], flames:[], destroyed:0 };
  }
  cell(x:number,y:number): Cell {
    if(x<0 || y<0 || x>=this.level.width || y>=this.level.height)return 1;
    return this.state.cells[y*this.level.width+x];
  }
  private blocked(x:number,y:number): boolean {
    return this.cell(x,y)!==0 || this.state.bombs.some(b=>b.x===x && b.y===y && !b.canLeave);
  }
  step(input:InputCommand): void {
    const s=this.state;s.tick++;
    s.flames.forEach(f=>f.ttl--);s.flames=s.flames.filter(f=>f.ttl>0);
    if(s.player.alive && input.direction) this.move(input.direction);
    for(const b of s.bombs)if(Math.abs(s.player.x-b.x)>=0.8 || Math.abs(s.player.y-b.y)>=0.8)b.canLeave=false;
    if(s.player.alive && input.bomb)this.placeBomb();
    const due = s.bombs.filter(b=>--b.fuse<=0);
    for(const b of due)this.explode(b.id);
    // Fire remains hazardous when the player walks into it after the first frame.
    if(s.flames.some(f=>Math.abs(f.x-s.player.x)<0.65 && Math.abs(f.y-s.player.y)<0.65))s.player.alive=false;
  }
  private move(direction:Direction):void {
    const p=this.state.player,[dx,dy]=directions[direction];
    const amount=this.rules.speed/this.rules.stepHz;
    // Turn only close to corridor centre; snap across the centre, never through walls.
    const cross=dx ? p.y:p.x, aligned=Math.round(cross);
    if(Math.abs(cross-aligned)>0.18)return;
    let nx=dx ? p.x+dx*amount:aligned, ny=dy ? p.y+dy*amount:aligned;
    const leadX=Math.round(nx+dx*0.27),leadY=Math.round(ny+dy*0.27);
    if(this.blocked(leadX,leadY)) {
      if(dx)nx=dx>0?Math.min(nx,leadX-0.77):Math.max(nx,leadX+0.77);
      if(dy)ny=dy>0?Math.min(ny,leadY-0.77):Math.max(ny,leadY+0.77);
    }
    p.x=Math.round(nx*10000)/10000;p.y=Math.round(ny*10000)/10000;
  }
  placeBomb():boolean {
    const s=this.state,x=Math.round(s.player.x),y=Math.round(s.player.y);
    if(this.cell(x,y)!==0 || s.bombs.length>=this.rules.capacity || s.bombs.some(b=>b.x===x&&b.y===y))return false;
    s.bombs.push({id:this.nextId++,x,y,fuse:this.rules.fuseTicks,range:this.rules.range,canLeave:true});return true;
  }
  private explode(id:number):void {
    const s=this.state,b=s.bombs.find(item=>item.id===id);if(!b)return;
    s.bombs=s.bombs.filter(item=>item.id!==id);
    const chain:number[]=[];
    const flame=(x:number,y:number)=>{
      s.flames.push({x,y,ttl:this.rules.fireTicks});
      const other=s.bombs.find(item=>item.x===x&&item.y===y);if(other)chain.push(other.id);
    };
    flame(b.x,b.y);
    for(const [dx,dy] of Object.values(directions))for(let i=1;i<=b.range;i++) {
      const x=b.x+dx*i,y=b.y+dy*i,tile=this.cell(x,y);if(tile===1)break;
      flame(x,y);
      if(tile===2){s.cells[y*this.level.width+x]=0;s.destroyed++;break;}
      if(s.bombs.some(item=>item.x===x&&item.y===y))break;
    }
    for(const next of chain)this.explode(next);
  }
  /** Plain data snapshot, usable by any renderer or future storage adapter. */
  snapshot():GameState { return JSON.parse(JSON.stringify(this.state)) as GameState; }
}
