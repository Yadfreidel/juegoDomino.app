// Presentation only. Values in this module never determine whether a move is legal.
export const TILE={length:1.06,width:.53,height:.15,y:2.168};
export const BOARD={halfWidth:4.94,halfDepth:2.58};
export const pipPattern=[[],[[0,0]],[[-1,-1],[1,1]],[[-1,-1],[0,0],[1,1]],[[-1,-1],[1,-1],[-1,1],[1,1]],[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]];

function slots(total) {
  if(total<=7)return Array.from({length:total},(_,i)=>({x:(i-(total-1)/2)*1.17,z:0,heading:0}));
  const path=[];
  for(let row=0;row<4;row++) {
    const direction=row%2===0?1:-1;
    for(let i=0;i<7;i++)path.push({x:(i-3)*1.17*direction,z:row*1.24,heading:direction===1?0:Math.PI});
    if(row<3)path.push({x:direction*4.34,z:row*1.24+.62,heading:-Math.PI/2});
  }
  const used=path.slice(0,total),xs=used.map(p=>p.x),zs=used.map(p=>p.z);
  const cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2;
  return used.map(p=>({...p,x:p.x-cx,z:p.z-cz}));
}
export function tilePose(slot,tile) {
  return {...slot,y:TILE.y,angle:slot.heading+(tile.left===tile.right?Math.PI/2:0)};
}
export function layoutChain(chain) {
  if(chain.length>28)throw new RangeError('El tablero admite 28 fichas.');
  // Two empty cells reserve non-overlapping destinations even when both ends are playable.
  if(!chain.length)return {placements:[],destinations:{left:{x:0,z:0,heading:0},right:{x:0,z:0,heading:0}}};
  const path=slots(chain.length+2);
  return {placements:chain.map((t,i)=>tilePose(path[i+1],t)),destinations:{left:path[0],right:path[chain.length+1]}};
}
export function previewTile(chain,tile,end) {
  if(!chain.length)return {left:tile.a,right:tile.b};
  const tip=end==='left'?chain[0].left:chain.at(-1).right;
  const other=tile.a===tip?tile.b:tile.a;
  return end==='left'?{left:other,right:tip}:{left:tip,right:other};
}
export function footprint(pose) {
  const c=Math.abs(Math.cos(pose.angle)),s=Math.abs(Math.sin(pose.angle));
  return {x:pose.x,z:pose.z,halfX:(c*TILE.length+s*TILE.width)/2,halfZ:(s*TILE.length+c*TILE.width)/2};
}
