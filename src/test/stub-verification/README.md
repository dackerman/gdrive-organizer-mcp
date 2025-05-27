# Google Drive API Stub Verification

This directory contains tests to verify that our `GoogleDriveApiStub` behaves consistently with the real Google Drive API.

## Why This Matters

All our unit tests rely on the stub to accurately represent Google Drive API behavior. If the stub behaves differently than the real API, our unit tests might pass but the code could fail in production.

## Verification Approaches

### 1. Parallel Testing (`test-harness.ts`)
Runs the same operations against both the real API and the stub, comparing results:
- Creates a test folder in the real API
- Mirrors the state in the stub
- Runs operations on both and compares outcomes
- Focuses on behavioral equivalence, not exact response matching

### 2. Behavioral Tests (`behavioral-tests.ts`)
Defines expected behaviors that both implementations should exhibit:
- Creating a folder makes it findable
- Moving files updates their parents correctly
- Query operators filter as expected
- Trashed files don't appear in normal listings

### 3. Snapshot Testing (`snapshot-generator.ts`)
Captures real API responses for comparison:
- Generates normalized snapshots of real API responses
- Can be used to verify stub returns similar response structures
- Helps catch missing fields or incorrect response formats

## Running the Tests

```bash
# Run stub verification tests
npm run test:stub-verification

# Generate new snapshots (requires real API access)
npx tsx src/test/stub-verification/snapshot-generator.ts
```

## Key Principles

1. **Behavioral Equivalence > Exact Matching**
   - We care that the stub behaves the same way, not that responses are identical
   - IDs, timestamps, and other metadata can differ

2. **State Management**
   - Real API has persistent state
   - Stub has in-memory state
   - Tests must handle this difference

3. **Normalization**
   - Remove variable data (IDs, timestamps) when comparing
   - Focus on structural and behavioral consistency

## Adding New Tests

When adding new functionality to the stub:

1. Add a behavioral test that defines the expected behavior
2. Run it against both real and stub to verify consistency
3. If it fails, fix the stub to match real behavior
4. Consider adding a snapshot if response structure is important

## Limitations

- Can't test all edge cases (rate limits, quotas, etc.)
- Some behaviors might be too complex to replicate exactly
- Real API behavior can change over time

The goal is not perfect replication but sufficient accuracy for reliable unit testing.