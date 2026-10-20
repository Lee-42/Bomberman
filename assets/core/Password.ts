/** Original USA 20-letter save code. No seed or lives are encoded. */
export interface ResumeData {stage:number;score:number;range:number;capacity:number;speed:boolean;wallPass:boolean;remote:boolean;fireSuit:boolean;debug:boolean}
const ALPHABET='AOFKCPGELBHMJDNI';
export function encodePassword(s:ResumeData):string {
 const d=String(Math.floor(s.score/100)).padStart(7,'0').slice(-7).split('').map(Number);
 const n=[d[6],+s.remote,s.stage&15,d[0],0,d[5],s.range,d[3],+s.fireSuit,0,s.capacity-1,d[2],+s.speed,d[1],0,d[4],+s.debug,s.stage>>>4,+s.wallPass,0];
 for(const start of [0,5,10])n[start+4]=n.slice(start,start+4).reduce((a,b)=>a+b,0)&15;
 n[19]=(2*(n[4]+n[9]+n[14])+n[15]+n[16]+n[17]+n[18])&15;
 let previous=0;return n.map(value=>{const encoded=(value-previous-7)&15;previous=encoded;return ALPHABET[encoded];}).join('');
}
export function decodePassword(code:string):ResumeData|null {
 code=code.toUpperCase().replace(/\s/g,'');if(!/^[A-P]{20}$/.test(code))return null;
 let previous=0;const n=code.split('').map(c=>{const raw=ALPHABET.indexOf(c),value=(raw+7+previous)&15;previous=raw;return value;});
 for(const i of [0,5,10])if((n.slice(i,i+4).reduce((a,b)=>a+b,0)&15)!==n[i+4])return null;
 if(((2*(n[4]+n[9]+n[14])+n[15]+n[16]+n[17]+n[18])&15)!==n[19])return null;
 const digits=[n[3],n[13],n[11],n[7],n[15],n[5],n[0]],stage=n[2]|(n[17]<<4);
 // Reject malformed codes whose otherwise valid checksums address data outside the original campaign.
 if(stage<1||stage>50||n[6]<1||n[6]>5||n[10]>9||digits.some(d=>d>9)||[1,8,12,16,18].some(i=>n[i]>1))return null;
 return {stage,score:Number(digits.join(''))*100,range:n[6],capacity:n[10]+1,remote:!!n[1],fireSuit:!!n[8],speed:!!n[12],debug:!!n[16],wallPass:!!n[18]};
}
