// Memory Leak Generator
const EventEmitter = require('events');

// Global array that keeps growing
const globalData = [];

// Memory leak: adding to array without bounds
function addData(data) {
  globalData.push(data);
  // No limit checking - will eventually cause memory issues
}

// Memory leak: event listeners not removed
class LeakyClass extends EventEmitter {
  constructor() {
    super();
    this.setupListeners();
  }
  
  setupListeners() {
    this.on('data', this.handleData);
    this.on('error', this.handleError);
    // Listeners are never removed
  }
  
  handleData(data) {
    console.log('Processing data:', data);
  }
  
  handleError(error) {
    console.error('Error:', error);
  }
  
  destroy() {
    // Should remove listeners but doesn't
    console.log('Destroying...');
  }
}

// Memory leak: closures capturing large objects
function createClosure() {
  const largeObject = new Array(1000000).fill('data');
  
  return function() {
    console.log('Closure accessing large object');
    return largeObject.length;
  };
}

// Memory leak: timers not cleared
function startTimers() {
  const timer1 = setInterval(() => {
    console.log('Timer 1 running');
  }, 1000);
  
  const timer2 = setTimeout(() => {
    console.log('Timer 2 completed');
  }, 5000);
  
  // Timers are never cleared
}

// Memory leak: DOM references not cleaned up
class DOMLeak {
  constructor() {
    this.elements = [];
  }
  
  addElement(element) {
    this.elements.push(element);
    // Elements are never removed from array
  }
  
  removeElement(element) {
    const index = this.elements.indexOf(element);
    if (index > -1) {
      this.elements.splice(index, 1);
      // But element reference is still held
    }
  }
}

// Memory leak: circular references
class CircularReference {
  constructor() {
    this.self = this; // Circular reference
    this.data = new Array(10000).fill('circular data');
  }
}

// Memory leak: large objects in closures
function createLargeClosure() {
  const largeData = new Array(100000).fill('large data');
  
  return {
    getData: () => largeData,
    processData: () => {
      // Processing but keeping reference
      return largeData.map(item => item.toUpperCase());
    }
  };
}

// Memory leak: event listeners on global objects
window.addEventListener('scroll', function() {
  console.log('Scrolling...');
  // This listener is never removed
});

// Memory leak: intervals in loops
function createManyIntervals() {
  for (let i = 0; i < 100; i++) {
    setInterval(() => {
      console.log(`Interval ${i} running`);
    }, 1000);
    // 100 intervals created, never cleared
  }
}

// Memory leak: promises that never resolve
function createHangingPromise() {
  return new Promise((resolve) => {
    // Promise never resolves, keeps memory allocated
    console.log('Promise created but never resolved');
  });
}

// Memory leak: large objects in module scope
const moduleData = new Array(1000000).fill('module data');

module.exports = {
  addData,
  LeakyClass,
  createClosure,
  startTimers,
  DOMLeak,
  CircularReference,
  createLargeClosure,
  createManyIntervals,
  createHangingPromise
};
