/**
 * Example demonstrating Memoru cache with GC monitoring to prevent rotations during garbage collection
 */
import { HeapSpace, Memoru } from '../src';

// Create a cache with memory stats monitoring and GC monitoring
const cache = new Memoru({
  max: 1000, // Maximum number of items in the cache
  respectGC: true, // Respect GC events and prevent rotations during GC
  memoryStats: {
    monitorGC: true, // Enable GC monitoring
    gcCooldown: 1000, // Wait 1 second after GC before allowing rotations
    interval: 100, // Check memory usage every 100ms
    monitored: [
      // Monitor old space and rotate when it exceeds 50MB
      { stat: HeapSpace.Old, threshold: 50 * 1024 * 1024 },
    ],
  },
});

// Fill the cache with some data
function fillCache() {
  console.log('Filling cache...');
  for (let i = 0; i < 10000; i++) {
    const key = `key-${i}`;
    // Create a large object to consume memory
    const value = {
      id: i,
      data: new Array(1000).fill(`data-${i}`),
    };
    cache.set(key, value);
  }
  console.log('Cache filled');
}

// Check cache access
function checkCache() {
  console.log('Checking cache...');
  for (let i = 0; i < 10000; i += 1000) {
    const key = `key-${i}`;
    const value = cache.get(key);
    console.log(`Key ${key}: ${value ? 'found' : 'not found'}`);
  }
}

// Run a memory-intensive operation
async function runTest() {
  // Fill the cache initially
  fillCache();

  // Check cache status
  checkCache();

  // Trigger a garbage collection if possible
  console.log('Triggering garbage collection...');
  if (global.gc) {
    global.gc();
    console.log('Garbage collection triggered');
  } else {
    console.log(
      'Garbage collection monitoring is automatic via PerformanceObserver',
    );
    console.log(
      'To manually trigger GC (optional), run with: node --expose-gc',
    );
  }

  // Wait a bit and check cache again
  await new Promise((resolve) => setTimeout(resolve, 1500));
  checkCache();

  console.log('Test complete');
}

// Run the test
runTest().catch(console.error);
