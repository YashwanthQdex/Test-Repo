// Testing Nightmare - Poor testing practices
const assert = require('assert');

// Test without assertions
function testWithoutAssertions() {
  const result = calculateSum(2, 3);
  console.log('Result:', result);
  // No assertion to verify the result
}

// Test that always passes
function testThatAlwaysPasses() {
  assert(true);
  // Test doesn't actually test anything
}

// Test with hardcoded values
function testWithHardcodedValues() {
  const result = processData([1, 2, 3]);
  assert.deepEqual(result, [2, 4, 6]);
  // Hardcoded expected values without understanding the logic
}

// Test that depends on external state
function testWithExternalDependency() {
  const user = getUserById(1);
  assert.equal(user.name, 'John');
  // Test depends on database state
}

// Test without cleanup
function testWithoutCleanup() {
  createUser({ name: 'Test User', email: 'test@example.com' });
  const user = getUserByEmail('test@example.com');
  assert.equal(user.name, 'Test User');
  // User remains in database after test
}

// Test with side effects
function testWithSideEffects() {
  const originalData = getData();
  processData();
  const newData = getData();
  assert.notDeepEqual(originalData, newData);
  // Test modifies global state
}

// Test that's too broad
function testTooBroad() {
  const result = complexFunction();
  assert.ok(result);
  // Test only checks if result exists, not if it's correct
}

// Test with no error cases
function testOnlyHappyPath() {
  const result = divide(10, 2);
  assert.equal(result, 5);
  // No test for division by zero
}

// Test with timing dependencies
function testWithTimingDependency() {
  const start = Date.now();
  const result = slowOperation();
  const end = Date.now();
  assert.ok(end - start < 1000);
  // Test depends on system performance
}

// Test that doesn't isolate the unit
function testNotIsolated() {
  const result = processUserData();
  assert.ok(result);
  // Test doesn't isolate the function being tested
}

// Test with multiple assertions in one test
function testMultipleAssertions() {
  const user = createUser({ name: 'John', age: 25 });
  
  assert.equal(user.name, 'John');
  assert.equal(user.age, 25);
  assert.ok(user.id);
  assert.ok(user.createdAt);
  // Multiple unrelated assertions in one test
}

// Test without proper setup
function testWithoutSetup() {
  const result = processData();
  assert.ok(result);
  // No setup to ensure test environment is correct
}

// Test that tests implementation details
function testImplementationDetails() {
  const result = publicFunction();
  assert.equal(result._internalProperty, 'expected');
  // Testing internal implementation, not public interface
}

// Test with no description
function test() {
  assert.equal(1 + 1, 2);
  // No description of what is being tested
}

// Test that's not repeatable
function testNotRepeatable() {
  const result = functionWithRandomness();
  assert.ok(result);
  // Test depends on random values
}

// Test with no error handling
function testNoErrorHandling() {
  const result = riskyOperation();
  assert.ok(result);
  // No test for error conditions
}

// Test that's too slow
function testTooSlow() {
  const result = verySlowOperation();
  assert.ok(result);
  // Test takes too long to run
}

// Test with no isolation
function testNoIsolation() {
  global.testData = 'test';
  const result = functionThatUsesGlobalData();
  assert.equal(result, 'test');
  // Test modifies global state
}

// Test that doesn't verify the contract
function testDoesntVerifyContract() {
  const result = apiFunction();
  assert.ok(result);
  // Test doesn't verify the function's contract/interface
}

// Test with magic numbers
function testWithMagicNumbers() {
  const result = calculate(42);
  assert.equal(result, 84);
  // Magic numbers without explanation
}

// Test that's not maintainable
function testNotMaintainable() {
  const input = 'very long string that is hard to read and understand what the test is actually testing';
  const expected = 'very long expected output that is also hard to read and understand';
  const result = processString(input);
  assert.equal(result, expected);
  // Test is hard to read and maintain
}

module.exports = {
  testWithoutAssertions,
  testThatAlwaysPasses,
  testWithHardcodedValues,
  testWithExternalDependency,
  testWithoutCleanup,
  testWithSideEffects,
  testTooBroad,
  testOnlyHappyPath,
  testWithTimingDependency,
  testNotIsolated,
  testMultipleAssertions,
  testWithoutSetup,
  testImplementationDetails,
  test,
  testNotRepeatable,
  testNoErrorHandling,
  testTooSlow,
  testNoIsolation,
  testDoesntVerifyContract,
  testWithMagicNumbers,
  testNotMaintainable
};
