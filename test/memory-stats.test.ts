import * as assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  HeapSpace,
  MemoryStatsMonitor,
  ProcessMemoryStat,
  type MemoryStat,
  type MonitoredStat,
} from '../src/memory-stats';

void describe('MemoryStatsMonitor', async () => {
  await test('should emit threshold event for heap space', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        monitor.stop();
        reject(new Error('Test timeout'));
      }, 1000);

      const monitor = new MemoryStatsMonitor({
        monitored: [
          { stat: HeapSpace.Old, threshold: 0 }, // 0 to always trigger
        ],
        interval: 10,
      });

      monitor.once('threshold', (info) => {
        clearTimeout(timeout);
        try {
          assert.strictEqual(info.type, 'v8');
          assert.strictEqual(info.stat, HeapSpace.Old);
          monitor.stop();
          resolve();
        } catch (error) {
          monitor.stop();
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    });
  });

  await test('should emit threshold event for process rss', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        monitor.stop();
        reject(new Error('Test timeout'));
      }, 1000);

      const monitor = new MemoryStatsMonitor({
        monitored: [
          { stat: ProcessMemoryStat.RSS, threshold: 0 }, // 0 to always trigger
        ],
        interval: 10,
      });

      monitor.once('threshold', (info) => {
        clearTimeout(timeout);
        try {
          assert.strictEqual(info.type, 'process');
          assert.strictEqual(info.stat, ProcessMemoryStat.RSS);
          monitor.stop();
          resolve();
        } catch (error) {
          monitor.stop();
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    });
  });

  await test('should stop monitoring', () => {
    const monitor = new MemoryStatsMonitor({
      monitored: [{ stat: HeapSpace.Old, threshold: 0 }],
      interval: 10,
    });
    monitor.stop();
    assert.strictEqual(monitor.isMonitoring(), false);
  });

  await test('should handle HeapUsed process memory stat', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        monitor.stop();
        reject(new Error('Test timeout'));
      }, 1000);

      const monitor = new MemoryStatsMonitor({
        monitored: [
          { stat: ProcessMemoryStat.HeapUsed, threshold: 0 }, // 0 to always trigger
        ],
        interval: 10,
      });

      monitor.once('threshold', (info) => {
        clearTimeout(timeout);
        try {
          assert.strictEqual(info.type, 'process');
          assert.strictEqual(info.stat, ProcessMemoryStat.HeapUsed);
          monitor.stop();
          resolve();
        } catch (error) {
          monitor.stop();
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    });
  });

  await test('should handle multiple monitored stats', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        monitor.stop();
        reject(new Error('Test timeout'));
      }, 1000);

      let eventCount = 0;
      const monitor = new MemoryStatsMonitor({
        monitored: [
          { stat: HeapSpace.Old, threshold: 0 },
          { stat: ProcessMemoryStat.RSS, threshold: 0 },
        ],
        interval: 10,
      });

      monitor.on('threshold', () => {
        eventCount++;
        if (eventCount >= 2) {
          clearTimeout(timeout);
          monitor.stop();
          resolve();
        }
      });
    });
  });

  await test('should handle ProcessMemoryStat enum values', () => {
    // Test ProcessMemoryStat enum coverage
    assert.strictEqual(ProcessMemoryStat.RSS, 'rss');
    assert.strictEqual(ProcessMemoryStat.HeapUsed, 'heapUsed');

    // Test type coverage with actual usage
    const testStat: MemoryStat = ProcessMemoryStat.RSS;
    assert.strictEqual(testStat, 'rss');

    // Test MonitoredStat interface usage
    const monitoredStat: MonitoredStat = {
      stat: ProcessMemoryStat.HeapUsed,
      threshold: 1000,
    };
    assert.strictEqual(monitoredStat.stat, 'heapUsed');
    assert.strictEqual(monitoredStat.threshold, 1000);
  });
});
