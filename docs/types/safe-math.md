# SafeMath

SafeMath provides overflow-safe arithmetic operations for `u256` and other numeric types. It's essential for all smart contract arithmetic to prevent silent overflow/underflow bugs.

## Overview

```typescript
import { SafeMath } from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

const a = u256.fromU64(100);
const b = u256.fromU64(50);

// Safe operations
const sum = SafeMath.add(a, b);       // 150
const diff = SafeMath.sub(a, b);      // 50
const product = SafeMath.mul(a, b);   // 5000
const quotient = SafeMath.div(a, b);  // 2
```

## Why SafeMath?

### The Problem

Native arithmetic can overflow silently:

```typescript
// DANGEROUS: Silent overflow
const max = u256.Max;
const result = max + u256.One;  // Wraps to 0!

// DANGEROUS: Silent underflow
const zero = u256.Zero;
const result = zero - u256.One;  // Wraps to u256.Max!
```

### The Solution

SafeMath reverts on overflow/underflow:

```typescript
// SAFE: Reverts on overflow
const max = u256.Max;
const result = SafeMath.add(max, u256.One);  // Reverts!

// SAFE: Reverts on underflow
const zero = u256.Zero;
const result = SafeMath.sub(zero, u256.One);  // Reverts!
```

## Basic Operations

### Addition

```typescript
const sum = SafeMath.add(a, b);

// Reverts if a + b > u256.Max
// Equivalent to Solidity: a + b (with checked arithmetic)
```

### Subtraction

```typescript
const diff = SafeMath.sub(a, b);

// Reverts if b > a (would underflow)
// Equivalent to Solidity: a - b (with checked arithmetic)
```

### Multiplication

```typescript
const product = SafeMath.mul(a, b);

// Reverts if a * b > u256.Max
// Equivalent to Solidity: a * b (with checked arithmetic)
```

### Division

```typescript
const quotient = SafeMath.div(a, b);

// Reverts if b == 0
// Equivalent to Solidity: a / b
```

### Modulo

```typescript
const remainder = SafeMath.mod(a, b);

// Reverts if b == 0
// Equivalent to Solidity: a % b
```

## Advanced Operations

### Power (Exponentiation)

```typescript
const base = u256.fromU64(2);
const exp = u256.fromU64(10);

const result = SafeMath.pow(base, exp);  // 2^10 = 1024

// Reverts on overflow
// Uses efficient exponentiation by squaring (binary exponentiation)
```

### Power of 10

```typescript
// Optimized function for 10^n
const million = SafeMath.pow10(6);  // 10^6 = 1,000,000
const ether = SafeMath.pow10(18);   // 10^18

// Maximum safe exponent is 77 (10^78 > u256.Max)
// Reverts if exponent > 77
```

### Square Root

```typescript
const value = u256.fromU64(144);
const sqrt = SafeMath.sqrt(value);  // 12

// Uses Newton-Raphson method
// Returns floor of square root
```

### Increment and Decrement

```typescript
const value = u256.fromU64(100);

// Safe increment (reverts at u256.Max)
const incremented = SafeMath.inc(value);  // 101

// Safe decrement (reverts at 0)
const decremented = SafeMath.dec(value);  // 99
```

## Shift Operations

### Left Shift

```typescript
const shifted = SafeMath.shl(value, 10);  // value << 10

// WARNING: Unlike other SafeMath operations, bit shifts do NOT throw on overflow!
// Bits shifted beyond the type width are SILENTLY LOST
// Shifts >= 256 return 0
// Negative shifts return 0 (defensive behavior)
```

### Right Shift

```typescript
const shifted = SafeMath.shr(value, 5);  // value >> 5

// Right shift is always safe (can't overflow)
// Equivalent to division by 2^bits
```

### Bitwise Operations

```typescript
// AND operation
const result1 = SafeMath.and(a, b);  // a & b

// OR operation
const result2 = SafeMath.or(a, b);   // a | b

// XOR operation
const result3 = SafeMath.xor(a, b);  // a ^ b

// Check if even
const isEven = SafeMath.isEven(value);  // (value & 1) == 0
```

## Comparison Operations

```typescript
// Use u256 built-in comparison methods (not SafeMath)
if (u256.lt(a, b)) { }   // Less than
if (u256.le(a, b)) { }   // Less than or equal
if (u256.gt(a, b)) { }   // Greater than
if (u256.ge(a, b)) { }   // Greater than or equal
if (u256.eq(a, b)) { }   // Equal
if (u256.ne(a, b)) { }   // Not equal

// SafeMath provides min/max operations
const smaller = SafeMath.min(a, b);
const larger = SafeMath.max(a, b);
```

## Specialized Functions

### Modular Multiplication

```typescript
// (a * b) % n without intermediate overflow
const result = SafeMath.mulmod(a, b, n);

// Useful for cryptographic operations
```

### Modular Inverse

```typescript
// Find x such that (a * x) % n == 1
const inverse = SafeMath.modInverse(a, n);

// Used in elliptic curve operations
// Reverts if inverse doesn't exist
```

### Logarithm Operations

```typescript
// Approximate log2 (returns floor of log2(x))
// Fast O(1) using bit length calculation
const log2 = SafeMath.approximateLog2(value);  // Returns u256

// Precise natural log (ln) scaled by 10^6 for fixed-point precision
// Higher accuracy but more gas intensive
const lnScaled = SafeMath.preciseLog(value);  // ln(x) * 1e6

// Approximate natural log scaled by 10^6
// Uses bit length * ln(2) approximation
const approxLn = SafeMath.approxLog(value);  // Approximate ln(x) * 1e6

// Bit length (number of bits needed to represent value)
const bits = SafeMath.bitLength256(value);  // Returns u32
```

## Other Integer Sizes

SafeMath also provides u128 and u64 variants. See [SafeMath API Reference](../api-reference/safe-math.md#u128-operations) for the complete list.

## SafeMathI128

For signed 128-bit arithmetic:

```typescript
import { SafeMathI128 } from '@btc-vision/btc-runtime/runtime';
import { i128 } from '@btc-vision/as-bignum/assembly';

const a = i128.from(-100);
const b = i128.from(50);

const sum = SafeMathI128.add(a, b);  // -50
const diff = SafeMathI128.sub(a, b); // -150

// Handles signed overflow correctly
```

## Common Patterns

### Percentage Calculation

```typescript
// Calculate percentage: (amount * percentage) / 100
public calculatePercentage(amount: u256, percentage: u256): u256 {
    const numerator = SafeMath.mul(amount, percentage);
    return SafeMath.div(numerator, u256.fromU64(100));
}

// Example: 10% of 1000
const result = calculatePercentage(u256.fromU64(1000), u256.fromU64(10));  // 100
```

### Fee Deduction

```typescript
// Deduct fee and return remaining
public deductFee(amount: u256, feePercent: u256): u256 {
    const fee = SafeMath.div(SafeMath.mul(amount, feePercent), u256.fromU64(100));
    return SafeMath.sub(amount, fee);
}
```

### Balance Updates

```typescript
// Safe balance increase
private addToBalance(addr: Address, amount: u256): void {
    const current = this.balances.get(addr);
    const newBalance = SafeMath.add(current, amount);
    this.balances.set(addr, newBalance);
}

// Safe balance decrease
private subFromBalance(addr: Address, amount: u256): void {
    const current = this.balances.get(addr);
    if (current < amount) {
        throw new Revert('Insufficient balance');
    }
    const newBalance = SafeMath.sub(current, amount);
    this.balances.set(addr, newBalance);
}
```

### Supply Cap Enforcement

```typescript
public mint(to: Address, amount: u256): void {
    const currentSupply = this.totalSupply.value;
    const maxSupply = this.maxSupply.value;

    // Check supply cap
    const newSupply = SafeMath.add(currentSupply, amount);
    if (newSupply > maxSupply) {
        throw new Revert('Exceeds max supply');
    }

    this.totalSupply.value = newSupply;
    this.addToBalance(to, amount);
}
```

## Edge Cases

### Division by Zero

```typescript
// Always reverts
SafeMath.div(u256.fromU64(100), u256.Zero);  // Reverts!
SafeMath.mod(u256.fromU64(100), u256.Zero);  // Reverts!
```

### Power Edge Cases

```typescript
// 0^0 = 1 (mathematical convention)
SafeMath.pow(u256.Zero, u256.Zero);  // Returns 1

// n^0 = 1
SafeMath.pow(u256.fromU64(5), u256.Zero);  // Returns 1

// 0^n = 0 (for n > 0)
SafeMath.pow(u256.Zero, u256.fromU64(5));  // Returns 0

// 1^n = 1
SafeMath.pow(u256.One, u256.fromU64(1000));  // Returns 1
```

### Maximum Values

```typescript
// Near max value operations
const nearMax = SafeMath.sub(u256.Max, u256.fromU64(10));

SafeMath.add(nearMax, u256.fromU64(5));   // OK: 5 from max
SafeMath.add(nearMax, u256.fromU64(15));  // Reverts: would overflow
```

## Best Practices

### 1. Always Use SafeMath

```typescript
// WRONG
const sum = a + b;
const diff = a - b;

// CORRECT
const sum = SafeMath.add(a, b);
const diff = SafeMath.sub(a, b);
```

### 2. Validate Before Division

```typescript
// Explicit zero check for better error messages
public divide(a: u256, b: u256): u256 {
    if (b.isZero()) {
        throw new Revert('Division by zero');
    }
    return SafeMath.div(a, b);
}
```

### 3. Order Operations to Minimize Overflow

```typescript
// RISKY: Large intermediate value
const result = SafeMath.div(SafeMath.mul(largeA, largeB), c);

// BETTER: Divide first if possible
const result = SafeMath.mul(SafeMath.div(largeA, c), largeB);

// BEST: Use muldiv for multiplication then division
const result = u128.muldiv(largeA, largeB, c);
```

---

**Navigation:**
- Previous: [Address](./address.md)
- Next: [Calldata](./calldata.md)
