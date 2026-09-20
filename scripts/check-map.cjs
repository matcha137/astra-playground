// Run with: node scripts/check-map.cjs
// Check routes independently of WebGL and external CDN availability.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('jimbocho-rpg.html','utf8');
const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1];
new vm.Script(script);
const ctx=vm.createContext({});
const data=script.slice(script.indexOf('const MAP='),script.indexOf("const KEY="));
const walk=script.match(/function walkable\(x,z\)\{[^\n]+/)[0];
vm.runInContext('const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));'+data+'\n'+walk+'\nthis.mapData={MAP,ROADS,FOOTPRINTS,SHOP_SITES,places,walkable};',ctx);
const {MAP,ROADS,FOOTPRINTS,places,walkable}=ctx.mapData;
assert.equal(places.length,19);assert.ok(walkable(0,19),'Spawn must be clear');
const width=MAP.limitX*2+1,height=MAP.limitZ*2+1;
const key=(x,z)=>(z+MAP.limitZ)*width+x+MAP.limitX;
const seen=new Uint8Array(width*height),queue=[[0,19]];seen[key(0,19)]=1;
for(let head=0;head<queue.length;head++){
  const [x,z]=queue[head];
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nx=x+dx,nz=z+dz;if(!walkable(nx,nz))continue;
    const k=key(nx,nz);if(!seen[k]){seen[k]=1;queue.push([nx,nz]);}
  }
}
for(const p of places){assert.ok(walkable(p.x,p.z),`${p.name}: blocked NPC`);assert.ok(seen[key(p.x,p.z)],`${p.name}: no route from spawn`);}
for(const r of ROADS){
  const [ax,az,bx,bz,,name]=r;
  for(let i=0;i<=100;i++){
    const x=ax+(bx-ax)*i/100,z=az+(bz-az)*i/100;
    if(Math.abs(x)<MAP.limitX&&Math.abs(z)<MAP.limitZ)assert.ok(walkable(x,z),`${name}: blocked road at ${x},${z}`);
  }
}
// Save migration must retain collected items and quest state, even when the map changed.
const fresh=script.slice(script.indexOf('const fresh='),script.indexOf('\ngame=load()'));
vm.runInContext("const KEY='test';this.saved=null;const localStorage={getItem:()=>JSON.stringify(saved)};"+fresh+'\nthis.fresh=fresh;this.load=load;',ctx);
const old=JSON.parse(JSON.stringify(ctx.fresh()));delete old.mapRevision;
Object.assign(old,{x:25,z:25,known:[0,3,6],inventory:[0,3],quest:3,money:1700,fragments:[0,1]});ctx.saved=old;
const migrated=ctx.load();assert.ok(migrated);assert.equal(migrated.x,0);assert.equal(migrated.z,19);assert.equal(migrated.quest,3);assert.equal(migrated.money,1700);assert.equal(migrated.known.length,3);assert.equal(migrated.mapRevision,MAP.revision);
ctx.saved={...old,mapRevision:MAP.revision,x:0,z:-30};assert.equal(ctx.load().z,-30);
console.log(`PASS: script syntax; ${FOOTPRINTS.length} buildings; all ${places.length} destinations reachable; ${ROADS.length} clear roads; old/current save migration.`);
