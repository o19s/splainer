// Proof-of-life spec to verify the Vitest pipeline works.
// Delete this once a real module under src/ has its own tests.
import { describe, it, expect } from 'vitest';

describe('vitest pipeline', () => {
  it('runs ESM specs', () => {
    expect(1 + 1).toBe(2);
  });
});
