# Security Policy

<p align="center">
  <a href="https://verichains.io">
    <img src="https://raw.githubusercontent.com/btc-vision/contract-logo/refs/heads/main/public-assets/verichains.png" alt="Verichains" width="150"/>
  </a>
</p>

<p align="center">
  <a href="https://verichains.io">
    <img src="https://img.shields.io/badge/Security%20Audit-Verichains-4C35E0?style=for-the-badge" alt="Audited by Verichains"/>
  </a>
</p>

## Audit Status

| Component          | Status  | Auditor                               |
|--------------------|---------|---------------------------------------|
| btc-runtime   | Audited | [Verichains](https://verichains.io)   |

## Supported Versions

| Version | Status             |
|---------|--------------------|
| 1.11.x  | Supported          |
| < 1.10 | Not supported      |

## Reporting a Vulnerability

**DO NOT** open a public GitHub issue for security vulnerabilities.

Report vulnerabilities through [GitHub Security Advisories](https://github.com/btc-vision/btc-runtime/security/advisories/new).

Include:
- Description of the vulnerability
- Affected version(s)
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

| Action                   | Timeframe         |
|--------------------------|-------------------|
| Initial response         | 48 hours          |
| Vulnerability assessment | 7 days            |
| Patch development        | 14-30 days        |
| Public disclosure        | After patch       |

## Security Scope

### In Scope

- Contract standards (OP_NET, OP20, OP721, OP20S)
- Storage system (pointers, maps, arrays)
- Cryptographic operations (Schnorr, ML-DSA, SHA256)
- SafeMath operations
- Reentrancy guards
- Access control mechanisms
- Event system
- Cross-contract calls

### Out of Scope

- Third-party dependencies (report to respective maintainers)
- User contract logic errors
- Issues in development/test environments only

## Contact

- **Security Issues**: [GitHub Security Advisories](https://github.com/btc-vision/btc-runtime/security/advisories)
- **General Issues**: [GitHub Issues](https://github.com/btc-vision/btc-runtime/issues)
- **Website**: [opnet.org](https://opnet.org)
