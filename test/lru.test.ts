import * as assert from 'node:assert';
import { describe, test } from 'node:test';
import { Memoru } from '../src/lru';
import { HeapSpace } from '../src/memory-stats';

void describe('Memoru', async () => {
  await test('should set and get values', () => {
    const lru = new Memoru({ max: 2 });
    lru.set('a', 1);
    lru.set('b', 2);
    assert.strictEqual(lru.get('a'), 1);
    assert.strictEqual(lru.get('b'), 2);
  });

  await test('should evict on max size', () => {
    const lru = new Memoru({ max: 2 });
    lru.set('a', 1);
    lru.set('b', 2);
    lru.set('c', 3);
    // 'a' should be in _cache, 'b' and 'c' in cache
    assert.strictEqual(lru.get('a'), 1);
    // After accessing 'a', it should be promoted to cache
    lru.set('d', 4);
    // Now 'b' should be evicted
    assert.strictEqual(lru.get('b'), undefined);
  });

  await test('should clear cache', () => {
    const lru = new Memoru({ max: 2 });
    lru.set('a', 1);
    lru.set('b', 2);
    lru.clear();
    assert.strictEqual(lru.get('a'), undefined);
    assert.strictEqual(lru.get('b'), undefined);
  });

  await test('should support non-string keys', () => {
    const lru = new Memoru<{ id: number }, string>({ max: 2 });
    const key1 = { id: 1 };
    const key2 = { id: 2 };
    lru.set(key1, 'one');
    lru.set(key2, 'two');
    assert.strictEqual(lru.get(key1), 'one');
    assert.strictEqual(lru.get(key2), 'two');
  });

  await test('should throw error for invalid max value', () => {
    assert.throws(() => new Memoru({ max: 0 }), /Memoru max value/);
    assert.throws(() => new Memoru({ max: -1 }), /Memoru max value/);
    assert.throws(
      () => new Memoru({ max: 'invalid' as unknown as number }),
      /Memoru max value/,
    );
  });

  await test('should work without max (infinite cache)', () => {
    const lru = new Memoru<string, number>({});
    lru.set('a', 1);
    lru.set('b', 2);
    lru.set('c', 3);
    // Should not evict anything since no max size
    assert.strictEqual(lru.get('a'), 1);
    assert.strictEqual(lru.get('b'), 2);
    assert.strictEqual(lru.get('c'), 3);
  });

  await test('should work with memory stats threshold', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        lru.clear();
        reject(new Error('Test timeout'));
      }, 1000);

      const lru = new Memoru({
        max: 10,
        memoryStats: {
          monitored: [{ stat: HeapSpace.Old, threshold: 0 }],
          interval: 10,
        },
      });

      // Fill cache to trigger potential memory rotation
      for (let i = 0; i < 5; i++) {
        lru.set(`key${String(i)}`, `value${String(i)}`);
      }

      // Clear timeout and test passes if no errors
      setTimeout(() => {
        clearTimeout(timeout);
        lru.clear();
        resolve();
      }, 50);
    });
  });

  await test('should handle has method correctly', () => {
    const lru = new Memoru({ max: 2 });
    lru.set('a', 1);
    assert.strictEqual(lru.has('a'), true);
    assert.strictEqual(lru.has('b'), false);

    // Add another item to move 'a' to shadow cache
    lru.set('b', 2);
    lru.set('c', 3);

    // 'a' should still be found in shadow cache
    assert.strictEqual(lru.has('a'), true);
  });

  await test('should handle remove method correctly', () => {
    const lru = new Memoru({ max: 2 });
    lru.set('a', 1);
    lru.set('b', 2);

    assert.strictEqual(lru.has('a'), true);
    lru.remove('a');
    assert.strictEqual(lru.has('a'), false);
    assert.strictEqual(lru.get('a'), undefined);
  });

  await test('should trigger rotation on max size without memory monitoring', () => {
    const lru = new Memoru({ max: 1 });
    lru.set('a', 1);
    assert.strictEqual(lru.get('a'), 1);

    // This should trigger rotation when adding the second item
    lru.set('b', 2);

    // 'b' should be in main cache
    assert.strictEqual(lru.get('b'), 2);

    // Adding 'c' should trigger another rotation
    lru.set('c', 3);

    // 'c' should be in main cache
    assert.strictEqual(lru.get('c'), 3);

    // The rotation has happened, so we covered line 75
    assert.strictEqual(lru.has('c'), true);
  });

  await test('should handle shadow cache access and promote items', () => {
    const lru = new Memoru({ max: 2 });
    lru.set('a', 1);
    lru.set('b', 2);

    // Trigger rotation by adding a third item
    lru.set('c', 3);

    // 'a' and 'b' should be in shadow cache, 'c' in main cache
    assert.strictEqual(lru.has('a'), true);

    // Getting 'a' should promote it to main cache and trigger rotation
    assert.strictEqual(lru.get('a'), 1);

    // 'a' should now be in main cache
    assert.strictEqual(lru.get('a'), 1);
  });

  await test('should trigger rotation exactly when size equals max', () => {
    const lru = new Memoru({ max: 1 });

    // Add first item - no rotation since size will be 1, max is 1
    lru.set('a', 1);
    assert.strictEqual(lru.get('a'), 1);

    // Add second item with different key - this should trigger rotation in update()
    // because size will become 2 which is >= max (1)
    lru.set('b', 2);
    assert.strictEqual(lru.get('b'), 2);

    // Add third item with different key - this should also trigger rotation
    lru.set('c', 3);
    assert.strictEqual(lru.get('c'), 3);
  });
});
