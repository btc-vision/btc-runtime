# SafeMath API Reference

The `SafeMath` class provides overflow-safe arithmetic operations for `u256` values.

## Import

```typescript
import { SafeMath } from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';
```

## Basic Operations

### add

Adds two u256 values with overflow checking.

```typescript
static add(a: u256, b: u256): u256
```

```typescript
const sum = SafeMath.add(u256.fromU64(100), u256.fromU64(50));  // 150
```

**Throws:** `Revert` if result overflows

### sub

Subtracts b from a with underflow checking.

```typescript
static sub(a: u256, b: u256): u256
```

```typescript
const diff = SafeMath.sub(u256.fromU64(100), u256.fromU64(30));  // 70
```

**Throws:** `Revert` if b > a (underflow)

### mul

Multiplies two u256 values with overflow checking.

```typescript
static mul(a: u256, b: u256): u256
```

```typescript
const product = SafeMath.mul(u256.fromU64(100), u256.fromU64(5));  // 500
```

**Throws:** `Revert` if result overflows

### div

Divides a by b.

```typescript
static div(a: u256, b: u256): u256
```

```typescript
const quotient = SafeMath.div(u256.fromU64(100), u256.fromU64(4));  // 25
```

**Throws:** `Revert` if b is zero

### mod

Returns remainder of a divided by b.

```typescript
static mod(a: u256, b: u256): u256
```

```typescript
const remainder = SafeMath.mod(u256.fromU64(100), u256.fromU64(30));  // 10
```

**Throws:** `Revert` if b is zero

## Advanced Operations

### pow

Raises base to power exponent using binary exponentiation.

```typescript
static pow(base: u256, exponent: u256): u256
```

```typescript
const power = SafeMath.pow(u256.fromU64(2), u256.fromU64(10));  // 1024
```

**Throws:** `Revert` on overflow

### pow10

Computes 10^exponent (optimized for base 10).

```typescript
static pow10(exponent: u8): u256
```

```typescript
const million = SafeMath.pow10(6);  // 1,000,000
```

**Throws:** `Revert` if exponent > 77 (would overflow)

### sqrt

Computes square root using Newton-Raphson method.

```typescript
static sqrt(a: u256): u256
```

```typescript
const root = SafeMath.sqrt(u256.fromU64(144));  // 12
```

### min

Returns smaller of two values.

```typescript
static min(a: u256, b: u256): u256
```

```typescript
const smaller = SafeMath.min(u256.fromU64(100), u256.fromU64(50));  // 50
```

### max

Returns larger of two values.

```typescript
static max(a: u256, b: u256): u256
```

```typescript
const larger = SafeMath.max(u256.fromU64(100), u256.fromU64(50));  // 100
```

### inc

Increments value by 1 with overflow protection.

```typescript
static inc(value: u256): u256
```

```typescript
const incremented = SafeMath.inc(u256.fromU64(100));  // 101
```

**Throws:** `Revert` if value equals u256.Max

### dec

Decrements value by 1 with underflow protection.

```typescript
static dec(value: u256): u256
```

```typescript
const decremented = SafeMath.dec(u256.fromU64(100));  // 99
```

**Throws:** `Revert` if value is zero

## Cryptographic Operations

### mulmod

Computes (a * b) % modulus without intermediate overflow.

```typescript
static mulmod(a: u256, b: u256, modulus: u256): u256
```

```typescript
// For cryptographic operations where intermediate product would overflow
const result = SafeMath.mulmod(largeA, largeB, prime);
```

**Use case:** Elliptic curve operations, modular arithmetic

### modInverse

Computes modular multiplicative inverse.

```typescript
static modInverse(a: u256, modulus: u256): u256
```

```typescript
// Find x such that (a * x) % modulus = 1
const inverse = SafeMath.modInverse(value, prime);
```

**Throws:** If inverse doesn't exist

## Logarithm Operations

### approximateLog2

Returns floor of base-2 logarithm (position of highest set bit).

```typescript
static approximateLog2(x: u256): u256
```

```typescript
const log = SafeMath.approximateLog2(u256.fromU64(1024));  // 10
const log2 = SafeMath.approximateLog2(u256.fromU64(1000)); // 9 (floor)
```

**Returns:** 0 for both input 0 and input 1

### preciseLog

Computes natural logarithm (ln) with high precision.

```typescript
static preciseLog(x: u256): u256
```

```typescript
// Returns ln(x) scaled by 10^6 for fixed-point precision
const lnScaled = SafeMath.preciseLog(u256.fromU64(10));  // ~2,302,585
```

**Returns:** ln(x) * 1,000,000

### approxLog

Computes approximate natural logarithm using bit length.

```typescript
static approxLog(x: u256): u256
```

```typescript
// Uses bitLength * ln(2) approximation, scaled by 10^6
const approxLn = SafeMath.approxLog(u256.fromU64(8));  // ~2,079,441 (3 * ln(2))
```

**Returns:** Approximate ln(x) * 1,000,000

### bitLength256

Returns number of bits needed to represent the value.

```typescript
static bitLength256(x: u256): u32
```

```typescript
const bits = SafeMath.bitLength256(u256.fromU64(255));  // 8
const bits2 = SafeMath.bitLength256(u256.fromU64(256)); // 9
```

## Bitwise Operations

### shl

Shifts left by specified bits.

```typescript
static shl(value: u256, shift: i32): u256
```

```typescript
const shifted = SafeMath.shl(u256.fromU64(1), 10);  // 1024
```

**Warning:** Unlike other SafeMath operations, bits shifted beyond type width are silently lost (no throw). Shifts >= 256 return 0.

### shl128

Shifts a u128 value left by specified bits.

```typescript
static shl128(value: u128, shift: i32): u128
```

**Warning:** Same behavior as shl - overflow bits are silently lost.

### shr

Shifts right by specified bits.

```typescript
static shr(value: u256, shift: i32): u256
```

```typescript
const shifted = SafeMath.shr(u256.fromU64(1024), 5);  // 32
```

### and

Performs bitwise AND.

```typescript
static and(a: u256, b: u256): u256
```

### or

Performs bitwise OR.

```typescript
static or(a: u256, b: u256): u256
```

### xor

Performs bitwise XOR.

```typescript
static xor(a: u256, b: u256): u256
```

### isEven

Checks if value is even.

```typescript
static isEven(a: u256): bool
```

```typescript
if (SafeMath.isEven(value)) {
    // Value is even
}
```

## Comparison Operations

SafeMath does not provide comparison methods. Use the built-in u256 methods instead:

```typescript
// Use u256 built-in comparison methods
u256.eq(a, b)   // Equal
u256.ne(a, b)   // Not equal
u256.lt(a, b)   // Less than
u256.le(a, b)   // Less than or equal
u256.gt(a, b)   // Greater than
u256.ge(a, b)   // Greater than or equal
```

### min

Returns the smaller of two u256 values.

```typescript
static min(a: u256, b: u256): u256
```

### max

Returns the larger of two u256 values.

```typescript
static max(a: u256, b: u256): u256
```

### 128-bit and 64-bit variants

```typescript
// u128 min/max
SafeMath.min128(a: u128, b: u128): u128
SafeMath.max128(a: u128, b: u128): u128

// u64 min/max
SafeMath.min64(a: u64, b: u64): u64
SafeMath.max64(a: u64, b: u64): u64
```

## u128 Operations

All u256 operations have u128 variants for better gas efficiency with smaller values:

```typescript
import { u128 } from '@btc-vision/as-bignum/assembly';

SafeMath.add128(a: u128, b: u128): u128    // Addition
SafeMath.sub128(a: u128, b: u128): u128    // Subtraction
SafeMath.mul128(a: u128, b: u128): u128    // Multiplication
SafeMath.div128(a: u128, b: u128): u128    // Division
SafeMath.min128(a: u128, b: u128): u128    // Minimum
SafeMath.max128(a: u128, b: u128): u128    // Maximum
SafeMath.shl128(value: u128, shift: i32): u128  // Left shift
```

## u64 Operations

Native u64 variants for optimal performance:

```typescript
SafeMath.add64(a: u64, b: u64): u64    // Addition
SafeMath.sub64(a: u64, b: u64): u64    // Subtraction
SafeMath.mul64(a: u64, b: u64): u64    // Multiplication
SafeMath.div64(a: u64, b: u64): u64    // Division
SafeMath.min64(a: u64, b: u64): u64    // Minimum
SafeMath.max64(a: u64, b: u64): u64    // Maximum
```

## SafeMathI128

For signed 128-bit operations (separate module):

```typescript
import { SafeMathI128 } from '@btc-vision/btc-runtime/runtime';
import { i128 } from '@btc-vision/as-bignum/assembly';
```

See the SafeMathI128 module for signed integer operations.

## Common Patterns

### Percentage Calculation

```typescript
// Calculate 5% fee
const FEE_PERCENT = u256.fromU64(5);
const HUNDRED = u256.fromU64(100);

function calculateFee(amount: u256): u256 {
    return SafeMath.div(SafeMath.mul(amount, FEE_PERCENT), HUNDRED);
}
```

### Basis Points

```typescript
// 100 basis points = 1%
const BPS = u256.fromU64(10000);

function applyBps(amount: u256, bps: u256): u256 {
    return SafeMath.div(SafeMath.mul(amount, bps), BPS);
}
```

### Fixed-Point Multiplication

```typescript
const PRECISION = u256.fromU64(1_000_000);  // 6 decimals

function mulFixed(a: u256, b: u256): u256 {
    return SafeMath.div(SafeMath.mul(a, b), PRECISION);
}
```

### Average Without Overflow

```typescript
function average(a: u256, b: u256): u256 {
    // (a + b) / 2 without overflow
    return SafeMath.add(
        SafeMath.shr(a, 1),
        SafeMath.add(
            SafeMath.shr(b, 1),
            SafeMath.mul(
                SafeMath.mod(a, u256.fromU64(2)),
                SafeMath.mod(b, u256.fromU64(2))
            )
        )
    );
}
```

## Error Handling

All SafeMath operations throw `Revert` on error:

```typescript
try {
    const result = SafeMath.div(amount, u256.Zero);
} catch (e) {
    // Division by zero caught
}
```

## Solidity Comparison

| Solidity | SafeMath |
|----------|----------|
| `a + b` (checked) | `SafeMath.add(a, b)` |
| `a - b` (checked) | `SafeMath.sub(a, b)` |
| `a * b` (checked) | `SafeMath.mul(a, b)` |
| `a / b` | `SafeMath.div(a, b)` |
| `a % b` | `SafeMath.mod(a, b)` |
| `a ** b` | `SafeMath.pow(a, b)` |
| `Math.sqrt(a)` | `SafeMath.sqrt(a)` |
| `mulmod(a, b, m)` | `SafeMath.mulmod(a, b, m)` |

---

**Navigation:**
- Previous: [OP721 API](./op721.md)
- Next: [Storage API](./storage.md)
