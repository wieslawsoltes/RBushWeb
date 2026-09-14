import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BlazorSpatialIndex} from '../src/entry.js';
const item = (id, x = 0) => ({id, envelope: {minX:x, minY:0, maxX:x+1, maxY:1}, value:{label:id}});
test('snapshot restores branching configuration, values and stable-id removal', () => {
  const source = new BlazorSpatialIndex(16); source.BulkLoad([item('a'), item('b',3)]);
  const target = new BlazorSpatialIndex(4); target.Import(source.Export());
  assert.equal(target.GetStats().maxEntries,16); assert.equal(target.Count,2);
  assert.deepEqual(target.Search({minX:0,minY:0,maxX:1,maxY:1})[0],item('a'));
  assert.equal(target.Delete('a'),true); assert.equal(target.Delete('a'),false); target.Validate();
});
test('invalid import and duplicate bulk load do not mutate the current index', () => {
  const index = new BlazorSpatialIndex(); index.Insert(item('existing')); const before = index.Export();
  for(const invalid of [{version:1,maxEntries:9,items:[item('x'),item('x')]},{version:1,maxEntries:NaN,items:[]},{version:1,maxEntries:9,items:[item('x',Infinity)]}]) {
    assert.throws(()=>index.Import(JSON.stringify(invalid))); assert.equal(index.Export(),before);
  }
  assert.throws(()=>index.BulkLoad([item('existing')])); assert.equal(index.Export(),before);
  index.Dispose(); assert.throws(()=>index.Search(),/disposed/);
});
