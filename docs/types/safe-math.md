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
const exp: u32 = 10;

const result = SafeMath.pow(base, exp);  // 2^10 = 1024

// Reverts on overflow
// Uses efficient exponentiation by squaring
```

### Square Root

```typescript
const value = u256.fromU64(144);
const sqrt = SafeMath.sqrt(value);  // 12

// Uses Newton-Raphson method
// Returns floor of square root
```

### Fast Division by 10

```typescript
const value = u256.fromU64(123);

const quotient = SafeMath.div10(value);  // 12
const remainder = SafeMath.rem10(value); // 3

// Optimized for base-10 operations (string conversion, etc.)
```

### Multiply then Divide

```typescript
// Calculate (a * b) / c without intermediate overflow
const a = u256.Max;
const b = u256.fromU64(2);
const c = u256.fromU64(3);

const result = u128.muldiv(a, b, c);  // Uses u256 internally

// Useful for percentage calculations, price conversions, etc.
```

## Shift Operations

### Left Shift

```typescript
const shifted = SafeMath.shl(value, bits);

// NOTE: Left shift can silently discard high bits
// If you need overflow checking, use multiplication:
const safe = SafeMath.mul(value, SafeMath.pow(u256.fromU64(2), bits));
```

### Right Shift

```typescript
const shifted = SafeMath.shr(value, bits);

// Right shift is always safe (can't overflow)
// Equivalent to division by 2^bits
```

## Comparison Operations

```typescript
// Less than
if (SafeMath.lt(a, b)) { }

// Less than or equal
if (SafeMath.lte(a, b)) { }

// Greater than
if (SafeMath.gt(a, b)) { }

// Greater than or equal
if (SafeMath.gte(a, b)) { }

// Equal
if (SafeMath.eq(a, b)) { }
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

### Logarithm

```typescript
// Log base 2 (floor)
const log2 = SafeMath.log2(value);

// Log base 10 (floor)
const log10 = SafeMath.log10(value);

// Useful for AMM pricing, bit operations
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
| `mulmod(a, b, n)` | `SafeMath.mulmod(a, b, n)` |

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
SafeMath.pow(u256.Zero, 0);  // Returns 1

// n^0 = 1
SafeMath.pow(u256.fromU64(5), 0);  // Returns 1

// 0^n = 0 (for n > 0)
SafeMath.pow(u256.Zero, 5);  // Returns 0
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
