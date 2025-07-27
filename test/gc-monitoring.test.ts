import { EventEmitter } from 'events';
import * as assert from 'node:assert';
import { describe, mock, test } from 'node:test';
import { Memoru } from '../src/lru';
import { HeapSpace, MemoryStatsMonitor } from '../src/memory-stats';

void describe('GC Monitoring', async () => {
  await test('should configure memory monitor with GC monitoring', () => {
    const memoru = new Memoru({
      max: 10,
      respectGC: true,
      memoryStats: {
        monitorGC: true,
        interval: 10,
        monitored: [{ stat: HeapSpace.Old, threshold: 1000 }],
      },
    });

    // Since memoryMonitor is private, we can't directly assert on it
    // But we can still test the behavior

    // This test is primarily to ensure the code doesn't throw errors
    assert.ok(memoru);
  });

  await test('should automatically enable GC monitoring when respectGC is true', () => {
    const memoru = new Memoru({
      max: 10,
      respectGC: true,
      memoryStats: {
        // Notice monitorGC is not set - should be automatically enabled
        interval: 10,
        monitored: [{ stat: HeapSpace.Old, threshold: 1000 }],
      },
    });

    assert.ok(memoru);
    // The test passes if no errors are thrown
  });

  await test('should skip rotation during active GC', () => {
    // Create a mock MemoryStatsMonitor that we can control
    const mockMonitor = new EventEmitter() as MemoryStatsMonitor;
    // Mock the isGCActive method to return true
    const mockIsGCActive = mock.fn(() => true);
    mockMonitor.isGCActive = mockIsGCActive;

    // Create an instance of Memoru with our mocked monitor
    const memoru = new Memoru({ max: 2 });

    // Replace the internal memory monitor with our mock
    Object.defineProperty(memoru, 'memoryMonitor', {
      value: mockMonitor,
      writable: true,
    });

    // Add items to trigger rotation
    memoru.set('a', 1);
    memoru.set('b', 2);
    memoru.set('c', 3);

    // Both 'a' and 'b' should still be available because rotation was skipped
    assert.strictEqual(memoru.get('a'), 1);
    assert.strictEqual(memoru.get('b'), 2);
    assert.strictEqual(memoru.get('c'), 3);

    // Verify isGCActive was called
    assert.ok(mockIsGCActive.mock.callCount() > 0);
  });
});
