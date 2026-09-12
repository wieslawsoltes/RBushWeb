import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { treeData, knnData, richData, missingEnvelopeData } from './fixtures.js';
const source = name => readFileSync(new URL(`./upstream/${name}`, import.meta.url), 'utf8');
function arrayFixture(text, name) {
  const body = text.split(`${name} = Point.CreatePoints(`)[1].split('});')[0];
  return [...body.matchAll(/\{\s*([-\d.,\s]+)\}/g)].map(match => match[1].split(',').map(Number));
}
test('Parity audit: every exact numeric fixture matches the pinned original C# source', () => {
  const tree = source('RBushTests.cs'), knn = source('KnnTests.cs');
  assert.deepEqual(treeData,arrayFixture(tree,'s_points'));
  assert.deepEqual(knnData,arrayFixture(knn,'s_points'));
  assert.deepEqual(richData,arrayFixture(knn,'s_richData'));
  const originalMissing = [...tree.matchAll(/new Point\(minX: ([^,]+), minY: ([^,]+), maxX: ([^,]+), maxY: ([^)]+)\)/g)]
    .map(match => match.slice(1).map(Number));
  assert.deepEqual(missingEnvelopeData,originalMissing);
  assert.equal(treeData.length,48); assert.equal(knnData.length,100);
  assert.equal(richData.length,6); assert.equal(missingEnvelopeData.length,94);
});
test('Parity audit: manifest covers all 28 original test methods without omissions', () => {
  const manifest = readFileSync(new URL('../docs/test-parity.md',import.meta.url),'utf8');
  let count = 0;
  for (const name of ['RBushTests','KnnTests']) {
    const original = source(`${name}.cs`);
    for (const match of original.matchAll(/\[Test\]\s+public void (\w+)\(/g)) {
      assert.ok(manifest.includes(`| \`${name}.${match[1]}\` |`),`missing ${name}.${match[1]}`); count++;
    }
    assert.equal((original.match(/\[Test\]/g) ?? []).length,[...original.matchAll(/\[Test\]\s+public void (\w+)\(/g)].length);
  }
  assert.equal(count,28);
  assert.ok(manifest.includes('101b6fb915215d9d30294a1178fe09ebd6929d73'));
});
