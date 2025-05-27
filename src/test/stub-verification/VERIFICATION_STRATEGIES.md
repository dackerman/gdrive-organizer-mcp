# Google Drive API Stub Verification Strategies

This document outlines different strategies for verifying that our `GoogleDriveApiStub` accurately represents the real Google Drive API behavior.

## 1. Parallel Testing (Recommended)

**Implementation**: `test-harness.ts`, `stub-verification.test.ts`

Run the same operations against both real and stub APIs in parallel:

```typescript
const result = await harness.runComparison(
  async (client) => client.filesList({ q: "name = 'test'" }),
  { normalize: (response) => response.files.length }
)
expect(result.matches).toBe(true)
```

**Pros**:
- Direct comparison of behavior
- Catches discrepancies immediately
- Can handle state management

**Cons**:
- Requires real API access
- Slower due to network calls
- Rate limit concerns

## 2. Behavioral Contract Testing

**Implementation**: `behavioral-tests.ts`, `behavioral-verification.test.ts`

Define behavioral contracts that both implementations must satisfy:

```typescript
// Test: Creating a file makes it findable
const file = await client.filesCreate({ name: 'test.txt' })
const found = await client.filesList({ q: `name = 'test.txt'` })
expect(found.files).toContainEqual(expect.objectContaining({ id: file.id }))
```

**Pros**:
- Focuses on behavior, not implementation
- Tests are more maintainable
- Can run independently

**Cons**:
- May miss subtle differences
- Requires careful contract design

## 3. Snapshot Testing

**Implementation**: `snapshot-generator.ts`

Capture real API responses and compare stub responses:

```bash
# Generate snapshots
npx tsx src/test/stub-verification/snapshot-generator.ts
```

**Pros**:
- Captures exact response structure
- Good for finding missing fields
- Can run offline after snapshot generation

**Cons**:
- Snapshots can become outdated
- Variable data (IDs, timestamps) needs normalization
- Brittle to API changes

## 4. Record and Replay

**Implementation**: `api-recorder.ts`

Record real API interactions and replay against stub:

```typescript
// Recording
const recorder = new ApiRecorder('session-1')
const client = recorder.createRecordingProxy(realClient)
// ... perform operations ...
recorder.save()

// Replay
const results = await ApiRecorder.replay('session-1', stubClient)
```

**Pros**:
- Can test complex interaction sequences
- Reproducible test scenarios
- Good for debugging specific issues

**Cons**:
- Recordings can become stale
- Storage overhead
- May not cover all edge cases

## 5. Integration Test Comparison

**Implementation**: `integration-test-runner.ts`

Run existing integration tests against both implementations:

```typescript
const result = await runAgainstBoth(async (adapter) => {
  const tool = createCreateFoldersTool(adapter)
  return tool.handler({ paths: ['/test'] })
})
expect(result.matched).toBe(true)
```

**Pros**:
- Tests real usage patterns
- Leverages existing test suite
- End-to-end validation

**Cons**:
- Higher level of abstraction
- May not catch all API-level differences
- Depends on adapter implementation

## Choosing a Strategy

1. **For new stub features**: Use Parallel Testing to ensure correctness
2. **For regression testing**: Use Behavioral Contracts 
3. **For response format verification**: Use Snapshot Testing
4. **For debugging specific issues**: Use Record and Replay
5. **For end-to-end validation**: Use Integration Test Comparison

## Best Practices

1. **Normalize variable data**: Remove IDs, timestamps, etc. when comparing
2. **Focus on behavior**: What matters is that the stub behaves the same, not that responses are identical
3. **Handle async behavior**: Real API may have eventual consistency
4. **Clean up test data**: Always clean up after real API tests
5. **Version your tests**: As the real API evolves, tests may need updates

## Running Verification Tests

```bash
# Run all verification tests
npm run test:stub-verification

# Run specific strategy
npm test src/test/stub-verification/behavioral-verification.test.ts

# Generate new snapshots
npx tsx src/test/stub-verification/snapshot-generator.ts
```

## When to Run

- Before releasing changes to the stub
- When adding new stub functionality
- Periodically to catch API drift
- When debugging unit test failures