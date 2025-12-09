# SafeMath API Reference

The `SafeMath` class provides overflow-safe arithmetic operations for `u256` values.

## Import

```typescript
import { SafeMath } from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';
```

## SafeMath Overview

```mermaid
---
config:
  theme: default
  look: classic
---
graph TB
    subgraph "SafeMath Operations"
        A[SafeMath Library]

        subgraph "Basic Arithmetic"
            B1[add - Addition]
            B2[sub - Subtraction]
            B3[mul - Multiplication]
            B4[div - Division]
            B5[mod - Modulus]
        end

        subgraph "Advanced Math"
            C1[pow - Exponentiation]
            C2[sqrt - Square Root]
            C3[log2 - Logarithm Base 2]
            C4[log10 - Logarithm Base 10]
            C5[logN - Logarithm Base N]
        end

        subgraph "Cryptographic"
            D1[mulmod - Modular Multiplication]
            D2[modInverse - Modular Inverse]
        end

        subgraph "Bitwise"
            E1[shl - Shift Left]
            E2[shr - Shift Right]
        end

        subgraph "Comparison"
            F1[eq - Equal]
            F2[gt - Greater Than]
            F3[gte - Greater or Equal]
            F4[lt - Less Than]
            F5[lte - Less or Equal]
            F6[min - Minimum]
            F7[max - Maximum]
        end

        A --> B1 & B2 & B3 & B4 & B5
        A --> C1 & C2 & C3 & C4 & C5
        A --> D1 & D2
        A --> E1 & E2
        A --> F1 & F2 & F3 & F4 & F5 & F6 & F7
    end

    style A fill:#e1f5fe,stroke:#01579b,stroke-width:3px
    style B1 fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style B2 fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style B3 fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style D1 fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    style D2 fill:#fff9c4,stroke:#f57f17,stroke-width:2px
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

## Overflow Protection Flow

```mermaid
---
config:
  theme: neutral
  look: classic
---
flowchart TB
    subgraph "SafeMath.add Example"
        A[SafeMath.add a, b] --> B[Compute result = a + b]
        B --> C{result < a?}
        C -->|Yes - Overflow| D[throw Revert 'Overflow']
        C -->|No - Valid| E[Return result]
    end

    subgraph "SafeMath.sub Example"
        F[SafeMath.sub a, b] --> G{b > a?}
        G -->|Yes - Underflow| H[throw Revert 'Underflow']
        G -->|No - Valid| I[Compute result = a - b]
        I --> J[Return result]
    end

    subgraph "SafeMath.mul Example"
        K[SafeMath.mul a, b] --> L{a == 0 OR b == 0?}
        L -->|Yes| M[Return 0]
        L -->|No| N[Compute result = a * b]
        N --> O{result / a != b?}
        O -->|Yes - Overflow| P[throw Revert 'Overflow']
        O -->|No - Valid| Q[Return result]
    end

    subgraph "SafeMath.div Example"
        R[SafeMath.div a, b] --> S{b == 0?}
        S -->|Yes| T[throw Revert 'Division by zero']
        S -->|No| U[Compute result = a / b]
        U --> V[Return result]
    end

    style D fill:#ffcdd2,stroke:#c62828,stroke-width:2px
    style H fill:#ffcdd2,stroke:#c62828,stroke-width:2px
    style P fill:#ffcdd2,stroke:#c62828,stroke-width:2px
    style T fill:#ffcdd2,stroke:#c62828,stroke-width:2px
    style E fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style J fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style Q fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style V fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
```

```mermaid
---
config:
  theme: default
  look: classic
---
sequenceDiagram
    participant Contract
    participant SafeMath
    participant Revert

    Note over Contract,Revert: Safe Addition

    Contract->>SafeMath: add(u256.Max, u256.One)
    SafeMath->>SafeMath: result = u256.Max + u256.One
    SafeMath->>SafeMath: Check: result < u256.Max?
    SafeMath->>SafeMath: Yes, overflow detected
    SafeMath->>Revert: throw Revert('Overflow')
    Revert->>Contract: Transaction reverted

    Note over Contract,Revert: Safe Subtraction

    Contract->>SafeMath: sub(u256.fromU64(100), u256.fromU64(200))
    SafeMath->>SafeMath: Check: 200 > 100?
    SafeMath->>SafeMath: Yes, underflow
    SafeMath->>Revert: throw Revert('Underflow')
    Revert->>Contract: Transaction reverted

    Note over Contract,Revert: Successful Operation

    Contract->>SafeMath: add(u256.fromU64(100), u256.fromU64(50))
    SafeMath->>SafeMath: result = 100 + 50 = 150
    SafeMath->>SafeMath: Check overflow: 150 < 100?
    SafeMath->>SafeMath: No, valid result
    SafeMath->>Contract: Return u256.fromU64(150)
```

## Advanced Operations

### pow

Raises a to power b.

```typescript
static pow(a: u256, b: u256): u256
```

```typescript
const power = SafeMath.pow(u256.fromU64(2), u256.fromU64(10));  // 1024
```

**Throws:** `Revert` on overflow

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

### log2

Returns floor of base-2 logarithm.

```typescript
static log2(x: u256): u256
```

```typescript
const log = SafeMath.log2(u256.fromU64(1024));  // 10
```

### log10

Returns floor of base-10 logarithm.

```typescript
static log10(x: u256): u256
```

```typescript
const log = SafeMath.log10(u256.fromU64(1000));  // 3
```

### logN

Returns floor of base-n logarithm.

```typescript
static logN(x: u256, base: u256): u256
```

```typescript
const log = SafeMath.logN(u256.fromU64(81), u256.fromU64(3));  // 4
```

## Bitwise Operations

### shl

Shifts left by specified bits.

```typescript
static shl(a: u256, bits: u32): u256
```

```typescript
const shifted = SafeMath.shl(u256.fromU64(1), 10);  // 1024
```

**Warning:** Overflowing bits are silently lost

### shr

Shifts right by specified bits.

```typescript
static shr(a: u256, bits: u32): u256
```

```typescript
const shifted = SafeMath.shr(u256.fromU64(1024), 5);  // 32
```

## Comparison Operations

### eq

Checks equality.

```typescript
static eq(a: u256, b: u256): bool
```

### gt

Checks if a > b.

```typescript
static gt(a: u256, b: u256): bool
```

### gte

Checks if a >= b.

```typescript
static gte(a: u256, b: u256): bool
```

### lt

Checks if a < b.

```typescript
static lt(a: u256, b: u256): bool
```

### lte

Checks if a <= b.

```typescript
static lte(a: u256, b: u256): bool
```

## SafeMathI128

For signed 128-bit operations:

```typescript
import { SafeMathI128 } from '@btc-vision/btc-runtime/runtime';
import { i128 } from '@btc-vision/as-bignum/assembly';
```

### Operations

| Method | Description |
|--------|-------------|
| `add(a, b)` | Addition with overflow check |
| `sub(a, b)` | Subtraction with underflow check |
| `mul(a, b)` | Multiplication with overflow check |
| `div(a, b)` | Division with zero check |
| `abs(a)` | Absolute value |
| `neg(a)` | Negation |

```typescript
const a = i128.from(-100);
const b = i128.from(50);
const sum = SafeMathI128.add(a, b);  // -50
const abs = SafeMathI128.abs(a);     // 100
```

## Cryptographic Operations Flow

```mermaid
---
config:
  theme: neutral
  look: classic
---
flowchart TB
    subgraph "Modular Multiplication mulmod"
        A[mulmod a, b, modulus] --> B{modulus == 0?}
        B -->|Yes| C[throw Revert]
        B -->|No| D[Compute a * b mod modulus]
        D --> E{Avoid intermediate overflow}
        E --> F[Return result]
    end

    subgraph "Modular Inverse modInverse"
        G[modInverse a, modulus] --> H{gcd a, modulus == 1?}
        H -->|No| I[throw Revert 'No inverse']
        H -->|Yes| J[Extended Euclidean Algorithm]
        J --> K[Find x: a * x ≡ 1 mod modulus]
        K --> L[Return x]
    end

    style C fill:#ffcdd2,stroke:#c62828,stroke-width:2px
    style I fill:#ffcdd2,stroke:#c62828,stroke-width:2px
    style F fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style L fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style D fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    style J fill:#fff9c4,stroke:#f57f17,stroke-width:2px
```

```mermaid
---
config:
  theme: default
  look: classic
---
graph LR
    subgraph "Use Cases for Cryptographic Math"
        A[Cryptographic Operations]

        B[Elliptic Curve Operations]
        C[Modular Arithmetic]
        D[Field Operations]
        E[Signature Verification]

        A --> B
        A --> C
        A --> D
        A --> E

        B --> F[Point multiplication]
        B --> G[Point addition]

        C --> H[mulmod for large numbers]
        C --> I[modInverse for division]

        D --> J[Finite field arithmetic]
        E --> K[Key derivation]
    end

    style A fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    style H fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    style I fill:#fff9c4,stroke:#f57f17,stroke-width:2px
```

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

---

**Navigation:**
- Previous: [OP721 API](./op721.md)
- Next: [Storage API](./storage.md)
