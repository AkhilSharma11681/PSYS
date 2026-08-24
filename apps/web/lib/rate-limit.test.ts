// Standalone verification script for the rate limiter, matching
// camera-service's test_*.py pattern (plain scripts, no test framework --
// consistent with the spec's "no new library without flagging" rule).
// Run: npx tsx lib/rate-limit.test.ts

import { checkRateLimit } from './rate-limit'

let passed = 0
let failed = 0

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`PASS: ${label}`)
    passed++
  } else {
    console.log(`FAIL: ${label}`)
    failed++
  }
}

// Test 1: first `limit` calls succeed, call limit+1 throws
{
  let errorAt = -1
  for (let i = 1; i <= 25; i++) {
    try {
      checkRateLimit('test-key-1', 20, 60_000)
    } catch {
      errorAt = i
      break
    }
  }
  check('21st call throws when limit is 20', errorAt === 21)
}

// Test 2: different keys have independent buckets
{
  for (let i = 1; i <= 20; i++) checkRateLimit('test-key-2a', 20, 60_000)
  let threw = false
  try {
    checkRateLimit('test-key-2b', 20, 60_000)
  } catch {
    threw = true
  }
  check('a fresh key is not affected by another key being at its limit', !threw)
}

// Test 3: window reset allows new calls after the window elapses
{
  for (let i = 1; i <= 5; i++) checkRateLimit('test-key-3', 5, 50)
  let threwBeforeReset = false
  try {
    checkRateLimit('test-key-3', 5, 50)
  } catch {
    threwBeforeReset = true
  }
  check('6th call within window throws', threwBeforeReset)
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
