import { test } from 'node:test';
import assert from 'node:assert/strict';
import RBushDefault, { RBush, Node, Envelope, RBushExtensions, knn, distanceTo } from '../src/index.js';
import { rng, intersects, assertEnvelope } from './helpers.js';

const bbox = (id, x = id, y = id) => ({ id, minX:x, minY:y, maxX:x+1, maxY:y+1 });
const ids = items => items.map(p => p.id).sort((a,b) => a-b);
const clone = value => structuredClone(value);

test('Web extras: Collides matches brute force and Search for empty, touching, missing, and random regions', () => {
  const random = rng(501), tree = new RBush(4);
  assert.equal(tree.Collides(new Envelope(0,0,10,10)),false);
  const data = Array.from({ length:600 }, (_,id) => bbox(id,Math.floor(random()*1000),Math.floor(random()*1000)));
  tree.BulkLoad(data);
  const queries = [Envelope.EmptyBounds,Envelope.InfiniteBounds,new Envelope(-10,-10,-5,-5),new Envelope(data[0].maxX,data[0].maxY,data[0].maxX,data[0].maxY)];
  for (let i = 0; i < 400; i++) {
    const x = random()*1200-100, y = random()*1200-100;
    queries.push(new Envelope(x,y,x+50,y+50));
  }
  for (const query of queries) {
    const expected = data.some(p => intersects({ MinX:p.minX,MinY:p.minY,MaxX:p.maxX,MaxY:p.maxY },query));
    assert.equal(tree.Collides(query),expected);
    assert.equal(tree.collides(query),tree.Search(query).length > 0);
  }
});

test('Web extras: Node children are live read-only views and all mutation escape routes reject', () => {
  const tree = new RBush(), root = tree.Root, children = root.Children;
  assert.ok(root instanceof Node); assert.equal(RBush.Node,Node);
  assert.throws(() => new Node(),TypeError);
  assert.equal(children.length,0);
  const first = bbox(1); tree.Insert(first);
  assert.equal(tree.Root,root); assert.equal(root.Children,children); assert.equal(children.length,1); assert.equal(children[0],first);
  const second = bbox(2); tree.Insert(second); assert.equal(children.length,2);
  const mutations = [
    () => { children[0] = second; }, () => { children.length = 0; }, () => { delete children[0]; },
    () => children.push(first), () => children.pop(), () => children.shift(), () => children.unshift(first),
    () => children.splice(0,1), () => children.reverse(), () => children.sort(() => -1),
    () => children.fill(first), () => children.copyWithin(0,1),
    () => Object.defineProperty(children,'0',{ value:second }), () => Object.setPrototypeOf(children,{}),
    () => Object.preventExtensions(children), () => { root.Height = 100; },
    () => { root.Children = []; }, () => { root.Envelope = Envelope.EmptyBounds; },
    () => { tree.Root = null; }, () => { tree.Count = 100; },
  ];
  for (const mutate of mutations) { assert.throws(mutate,TypeError); assert.deepEqual([...children],[first,second]); assert.equal(tree.Validate(),true); }
  assert.equal(tree.Delete(first),true); assert.deepEqual([...children],[second]);
  assert.equal(root.children,children); assert.equal(root.height,root.Height);
  assert.equal(root.isLeaf,true); assert.equal(root.leaf,true); assert.equal(root.envelope,root.Envelope);
});

test('Web extras: all public aliases preserve behavior, fluent returns, exports, and snapshot iterator semantics', () => {
  assert.equal(RBushDefault,RBush);
  const tree = new RBush(4), a=bbox(1), b=bbox(2), c=bbox(3), d=bbox(4);
  assert.equal(tree.insert(a),tree); assert.equal(tree.bulkLoad([b]),tree); assert.equal(tree.load([c]),tree);
  assert.equal(tree.root,tree.Root); assert.equal(tree.envelope,tree.Envelope);
  assert.equal(tree.count,3); assert.equal(tree.size,3); assert.equal(tree.maxEntries,4);
  assert.deepEqual(tree.all(),tree.Search()); assert.deepEqual(tree.search(a),tree.Search(a));
  assert.deepEqual(tree.knn(2,0,0),tree.Knn(2,0,0)); assert.deepEqual(knn(tree,2,0,0),tree.Knn(2,0,0));
  assert.deepEqual(RBushExtensions.knn(tree,2,0,0),tree.Knn(2,0,0));
  assert.equal(distanceTo(a,0,0),RBushExtensions.distanceTo(a,0,0));
  assert.deepEqual([...tree],tree.Search());
  const iterator = tree[Symbol.iterator](), before = tree.Search(); tree.Insert(d);
  assert.deepEqual([...iterator],before,'iterator captures an independent Search result');
  assert.equal(tree.delete(a),true); assert.equal(tree.remove(a),false); assert.equal(tree.remove(b),true);
  assert.deepEqual(tree.getStats(),tree.GetStats()); assert.equal(tree.validate(),true);
  const snapshot = tree.toJSON(); assert.deepEqual(snapshot,tree.ToJSON());
  const fromStatic = RBush.fromJSON(snapshot); assert.deepEqual(ids(fromStatic.all()),ids(tree.all()));
  const destination = new RBush(); assert.equal(destination.fromJSON(snapshot),destination);
  assert.equal(tree.clear(),tree); assert.equal(tree.count,0); assert.deepEqual(tree.all(),[]);
});

test('Web extras: Envelope convenience API remains immutable and consistent with PascalCase', () => {
  const e = new Envelope({minX:1,minY:2,maxX:5,maxY:8}), other = new Envelope(3,4,9,10);
  assert.deepEqual(e.Deconstruct(),[1,2,5,8]);
  assert.deepEqual([e.minX,e.minY,e.maxX,e.maxY],[1,2,5,8]);
  assert.equal(e.area,e.Area); assert.equal(e.margin,e.Margin);
  assertEnvelope(e.extend(other),e.Extend(other)); assertEnvelope(e.intersection(other),e.Intersection(other));
  assert.equal(e.contains(other),e.Contains(other)); assert.equal(e.intersects(other),e.Intersects(other));
  assert.equal(e.distanceTo(20,30),e.DistanceTo(20,30)); assert.equal(e.equals(new Envelope(e)),true);
  assert.equal(e.toString(),e.ToString()); assert.ok(e.ToString().includes('MinX = 1'));
  assert.ok(Object.isFrozen(e)); assert.throws(() => { e.MinX=100; },TypeError);
  assert.throws(() => { Envelope.EmptyBounds=null; },TypeError);
  assert.equal(new Envelope(0,-0,1,1).GetHashCode(),new Envelope(-0,0,1,1).GetHashCode());
  assert.equal(new Envelope(NaN,0,1,1).Equals(new Envelope(NaN,0,1,1)),true);
});

test('Web extras: native plain boxes, wrapped boxes, and custom accessors support complete indexing operations', () => {
  const shapes = [
    { make:id => bbox(id), extract:p => p },
    { make:id => ({id,MinX:id,MinY:id,MaxX:id+1,MaxY:id+1}), extract:p => p },
    { make:id => ({id,envelope:bbox(id)}), extract:p => p.envelope },
    { make:id => ({id,Envelope:new Envelope(id,id,id+1,id+1)}), extract:p => p.Envelope },
    { make:id => ({id,geometry:{bounds:[id,id,id+1,id+1]}}), extract:p => new Envelope(...p.geometry.bounds), custom:true },
  ];
  for (const {make,extract,custom} of shapes) {
    const tree = new RBush({maxEntries:4,...(custom ? {getEnvelope:extract} : {})});
    const items=Array.from({length:100},(_,id) => make(id)); tree.BulkLoad(items.slice(0,70));
    items.slice(70).forEach(p => tree.Insert(p));
    assert.equal(tree.Count,100); assert.equal(tree.Validate(),true);
    assert.deepEqual(ids(tree.Search(new Envelope(20,20,25,25))),[19,20,21,22,23,24,25]);
    assert.equal(tree.Collides(new Envelope(20,20,20,20)),true);
    assert.deepEqual(ids(tree.Knn(3,0,0)),[0,1,2]);
    assert.equal(tree.Delete(items[50]),true); assert.equal(tree.Count,99);
  }
});

test('Web extras: structural snapshots round trip classes, custom accessor, comparer, and subsequent mutations', () => {
  class Shape { constructor(id,bounds) { this.id=id; this.bounds=bounds; } }
  const options={maxEntries:4,getEnvelope:p => new Envelope(...p.bounds),comparer:(a,b) => a.id===b.id};
  const tree=new RBush(options), data=Array.from({length:100},(_,id) => new Shape(id,[id,id,id+1,id+1]));
  tree.BulkLoad(data);
  const serialize=p => [p.id,...p.bounds], deserialize=parts => new Shape(parts[0],parts.slice(1));
  const snapshot=tree.ToJSON(serialize), wire=JSON.stringify(snapshot);
  const restored=RBush.FromJSON(wire,deserialize,options);
  assert.deepEqual(restored.ToJSON(serialize),snapshot); assert.equal(restored.Validate(),true);
  assert.ok(restored.Search().every(p => p instanceof Shape));
  const inPlace=new RBush({...options,maxEntries:16}); inPlace.Insert(new Shape(-1,[-1,-1,0,0]));
  assert.equal(inPlace.FromJSON(wire,deserialize),inPlace); assert.equal(inPlace.MaxEntries,4);
  assert.deepEqual(inPlace.ToJSON(serialize),snapshot);
  for (let round=0;round<5;round++) {
    assert.equal(restored.Delete(new Shape(round,[round,round,round+1,round+1])),true,'custom comparer survives restore');
    const added=new Shape(100+round,[100+round,100+round,101+round,101+round]); restored.Insert(added);
    restored.BulkLoad([new Shape(200+round,[200+round,200+round,201+round,201+round])]);
    restored.FromJSON(JSON.stringify(restored.ToJSON(serialize)),deserialize);
    assert.equal(restored.Validate(),true); assert.equal(restored.Count,101+round);
  }
});

test('Web extras: JSON.stringify uses standard toJSON hook at root and nested positions', () => {
  const tree=new RBush(4); tree.BulkLoad([bbox(1),bbox(2)]);
  const direct=JSON.parse(JSON.stringify(tree)); assert.deepEqual(direct,tree.ToJSON());
  const nested=JSON.parse(JSON.stringify({spatial:tree})); assert.deepEqual(nested.spatial,tree.ToJSON());
  const restored=RBush.FromJSON(JSON.stringify(tree)); assert.deepEqual(ids(restored.Search()),[1,2]);
  assert.equal(restored.Validate(),true);
});

test('Web extras: malformed snapshots and deserializer failures reject atomically', () => {
  const tree=new RBush(9); tree.BulkLoad([bbox(90),bbox(91)]);
  const source=new RBush(4); source.BulkLoad(Array.from({length:40},(_,id) => bbox(id)));
  const good=source.ToJSON();
  const cases=[
    null, {}, '{', {...clone(good),format:'wrong'}, {...clone(good),version:2},
    {...clone(good),count:-1}, {...clone(good),count:2.5}, {...clone(good),count:999},
    {...clone(good),maxEntries:3}, {...clone(good),maxEntries:4.5},
    {...clone(good),root:null}, {...clone(good),root:{height:0,children:[]}},
    {...clone(good),root:{height:65,children:[]}}, {...clone(good),root:{height:1,children:{}}},
    {...clone(good),root:{height:1,children:Array(5).fill(bbox(1))}},
    {...clone(good),count:1,root:{height:1,children:[{minX:null,minY:0,maxX:1,maxY:1}]}},
    {...clone(good),count:1,root:{height:1,children:[{minX:NaN,minY:0,maxX:1,maxY:1}]}},
    {...clone(good),count:1,root:{height:3,children:[{height:1,children:[bbox(1)]}]}},
    {...clone(good),count:0,root:{height:2,children:[]}},
    {...clone(good),count:0,root:{height:3,children:[{height:2,children:[]}]}},
  ];
  const cyclic={height:2,children:[]}; cyclic.children.push(cyclic); cases.push({...clone(good),root:cyclic});
  const shared={height:1,children:[bbox(1)]}; cases.push({...clone(good),count:2,root:{height:2,children:[shared,shared]}});
  const before=tree.Root, items=tree.Search(), stats=tree.GetStats();
  for (const [index,bad] of cases.entries()) {
    assert.throws(() => tree.FromJSON(bad),undefined,`invalid snapshot case ${index}`);
    assert.equal(tree.Root,before); assert.deepEqual(tree.Search(),items); assert.deepEqual(tree.GetStats(),stats); assert.equal(tree.Validate(),true);
  }
  assert.throws(() => tree.FromJSON(good,() => {throw new Error('deserialize failure');}),/deserialize failure/);
  assert.equal(tree.Root,before); assert.deepEqual(tree.GetStats(),stats);
  assert.throws(() => tree.FromJSON(good,{}),TypeError); assert.throws(() => tree.ToJSON({}),TypeError);
  assert.throws(() => tree.FromJSON({...good,count:1,root:{height:1,children:[tree.Root]}}),TypeError);
});

test('Web extras: empty and infinite bounds snapshot rules preserve geometry without silently coercing JSON infinities', () => {
  const empty=new RBush(4), restoredEmpty=RBush.FromJSON(JSON.stringify(empty));
  assert.equal(restoredEmpty.Count,0); assert.equal(restoredEmpty.Root.Height,1); assert.equal(restoredEmpty.Validate(),true);
  assertEnvelope(restoredEmpty.Envelope,Envelope.EmptyBounds);
  const tree=new RBush(4); tree.Insert({id:1,Envelope:Envelope.InfiniteBounds});
  const direct=RBush.FromJSON(tree.ToJSON()); assertEnvelope(direct.Envelope,Envelope.InfiniteBounds);
  assert.deepEqual(ids(direct.Search(new Envelope(0,0,1,1))),[1]);
  assert.throws(() => RBush.FromJSON(JSON.stringify(tree)),TypeError,'JSON nulls produced from Infinity must not become coordinates');
  const encodeNumber=n => n===Infinity ? '+Infinity' : n===-Infinity ? '-Infinity' : n;
  const decodeNumber=n => n==='+Infinity' ? Infinity : n==='-Infinity' ? -Infinity : n;
  const encode=p => ({id:p.id,bounds:p.Envelope.Deconstruct().map(encodeNumber)});
  const decode=p => ({id:p.id,Envelope:new Envelope(...p.bounds.map(decodeNumber))});
  tree.Insert({id:2,Envelope:Envelope.EmptyBounds});
  const restored=RBush.FromJSON(JSON.stringify(tree.ToJSON(encode)),decode);
  assert.equal(restored.Count,2); assert.equal(restored.Validate(),true);
  assert.ok(restored.Search().some(p => p.id===2 && p.Envelope.Equals(Envelope.EmptyBounds)));
  assertEnvelope(restored.Envelope,Envelope.InfiniteBounds);
});

test('Web extras: indexed NaN and invalid API arguments fail without partial batch mutation', () => {
  const tree=new RBush(), valid=bbox(1); tree.Insert(valid);
  const invalid=[null,{}, {minX:0,minY:0,maxX:NaN,maxY:1}, {minX:'0',minY:0,maxX:1,maxY:1}, {Envelope:new Envelope(NaN,0,1,1)}];
  const before=tree.Root;
  for (const value of invalid) {
    assert.throws(() => tree.Insert(value),TypeError);
    assert.throws(() => tree.Delete(value),TypeError);
    assert.throws(() => tree.Search(value),TypeError);
    assert.throws(() => tree.Collides(value),TypeError);
    assert.throws(() => tree.BulkLoad([bbox(2),value,bbox(3)]),TypeError);
    assert.equal(tree.Count,1); assert.equal(tree.Root,before); assert.deepEqual(tree.Search(),[valid]); assert.equal(tree.Validate(),true);
  }
  for (const value of [null,{},42]) assert.throws(() => tree.BulkLoad(value),TypeError);
  for (const value of [NaN,Infinity,1.5,'9',Number.MAX_SAFE_INTEGER+1]) assert.throws(() => new RBush(value),RangeError);
  assert.throws(() => new RBush({getEnvelope:42}),TypeError);
  assert.throws(() => new RBush(4,{}),TypeError);
  assert.throws(() => new Envelope('0',0,1,1),TypeError);
  for (const k of [NaN,Infinity,1.5,'1']) assert.throws(() => tree.Knn(k,0,0),RangeError);
  for (const bad of [NaN,'0',null]) {
    assert.throws(() => tree.Knn(1,bad,0),TypeError); assert.throws(() => tree.Knn(1,0,bad),TypeError);
  }
  for (const bad of [NaN,'10',{}]) assert.throws(() => tree.Knn(1,0,0,bad),TypeError);
  assert.throws(() => tree.Knn(1,0,0,null,{}),TypeError);
  assert.throws(() => RBushExtensions.Knn(null,1,0,0),TypeError);
  assert.deepEqual(tree.Knn(1,0,0,-1),[]);
});

test('Web extras: Validate detects stale external bounds and explicit delete/move/reinsert restores validity', () => {
  const tree=new RBush(4), data=Array.from({length:50},(_,id) => bbox(id)); tree.BulkLoad(data);
  assert.equal(tree.Validate(),true);
  const p=data[0], original=p.minX; p.minX=-100;
  assert.throws(() => tree.Validate(),/stale/);
  p.minX=original; assert.equal(tree.Validate(),true);
  assert.equal(tree.Delete(p),true); p.minX=-100; p.minY=-100; p.maxX=-90; p.maxY=-90; tree.Insert(p);
  assert.equal(tree.Validate(),true); assert.deepEqual(tree.Search(new Envelope(-100,-100,-90,-90)),[p]);
});

test('Web extras: stats are immutable and reflect occupied and empty leaves after deletions', () => {
  const tree=new RBush(4), empty=tree.GetStats();
  assert.deepEqual(empty,{count:0,height:1,nodeCount:1,leafCount:1,emptyLeafCount:1,maxEntries:4,fillRatio:0});
  const data=Array.from({length:100},(_,id) => bbox(id)); tree.BulkLoad(data);
  const stats=tree.GetStats(); assert.ok(Object.isFrozen(stats)); assert.equal(stats.count,100);
  assert.ok(stats.nodeCount>stats.leafCount); assert.ok(stats.fillRatio>0 && stats.fillRatio<=1);
  assert.throws(() => {stats.count=999;},TypeError);
  data.forEach(p => tree.Delete(p)); const deleted=tree.GetStats();
  assert.equal(deleted.count,0); assert.equal(deleted.emptyLeafCount,deleted.leafCount); assert.equal(tree.Validate(),true);
});

test('Web extras: 100,000-item tree returns exact grid ranges and remains mutable after snapshot restoration', () => {
  const data=Array.from({length:100_000},(_,id) => ({id,minX:id%1000,minY:Math.floor(id/1000),maxX:id%1000,maxY:Math.floor(id/1000)}));
  const tree=new RBush(16); tree.BulkLoad(data);
  assert.equal(tree.Count,100_000); assert.equal(tree.Validate(),true);
  const found=tree.Search(new Envelope(100,10,199,19)); assert.equal(found.length,1000);
  assert.ok(found.every(p => p.minX>=100 && p.minX<=199 && p.minY>=10 && p.minY<=19));
  assert.equal(tree.Search(Envelope.InfiniteBounds).length,100_000);
  assert.equal(tree.Knn(5,0,0).length,5);
  const restored=RBush.FromJSON(tree.ToJSON()); assert.equal(restored.Count,100_000);
  assert.equal(restored.Delete(data[0]),true); assert.equal(restored.Count,99_999);
  restored.Insert(data[0]); assert.equal(restored.Count,100_000); assert.equal(restored.Validate(),true);
});

test('Web extras: KNN keeps upstream ordering for inverted, empty, and infinite envelopes through import and deletion', () => {
  const axisDistance=(p,min,max) => p<min ? min-p : p>max ? p-max : 0;
  const originalDistance=(e,x,y) => { const dx=axisDistance(x,e.MinX,e.MaxX),dy=axisDistance(y,e.MinY,e.MaxY); return Math.sqrt(dx*dx+dy*dy); };
  const random=rng(707), coordinates=[-Infinity,-2,-1,0,1,2,Infinity];
  const data=Array.from({length:80},(_,id) => ({id,Envelope:new Envelope(...Array.from({length:4},() => coordinates[Math.floor(random()*coordinates.length)]))}));
  data.push({id:80,Envelope:Envelope.EmptyBounds},{id:81,Envelope:Envelope.InfiniteBounds});
  const tree=new RBush(4); tree.BulkLoad(data.slice(0,41)); data.slice(41).forEach(p => tree.Insert(p));
  function verify(target) {
    for (const x of [-1,0,1]) for (const y of [-1,0,1]) for (const radius of [undefined,0,1,2,Infinity]) {
      const query=radius===undefined ? undefined : new Envelope(x-radius,y-radius,x+radius,y+radius);
      const candidates=target.Search(query).map(item => ({item,distance:originalDistance(item.Envelope,x,y)}));
      candidates.sort((a,b) => a.distance-b.distance);
      let expected=candidates.filter(p => radius===undefined || p.distance<=radius).map(p => p.item);
      for (const k of [0,1,7,1000]) {
        assert.deepEqual(target.Knn(k,x,y,radius),k>0 ? expected.slice(0,k) : expected);
        const filtered=expected.filter(p => p.id%3===0);
        assert.deepEqual(target.Knn(k,x,y,radius,p => p.id%3===0),k>0 ? filtered.slice(0,k) : filtered);
      }
    }
  }
  verify(tree);
  const restored=RBush.FromJSON(tree.ToJSON()); verify(restored);
  for (const p of restored.Search()) if (p.Envelope.MinX>p.Envelope.MaxX || p.Envelope.MinY>p.Envelope.MaxY) assert.equal(restored.Delete(p),true);
  verify(restored); assert.equal(restored.Validate(),true);
  restored.Clear(); restored.Insert({id:90,Envelope:new Envelope(0,0,1,1)}); verify(restored);
});
