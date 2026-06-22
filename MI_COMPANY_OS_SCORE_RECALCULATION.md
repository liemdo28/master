# Mi Company OS Score Recalculation

Generated: 2026-06-18 15:20 ICT

## Score

| Field | Value |
|---|---|
| Previous verified score | 86.4 / 100 |
| New verified score | 86.4 / 100 |
| Increase | 0.0 |

## Scoring Rule Applied

Only a target system with `LIVE_READ_PASS` can increase the score.

The following do not count:

- architecture
- runtime process startup
- internal package reads
- manual or seeded data
- historical cache
- compile success
- dry-run or certification labels

## Connectivity Results

| System | Result | Live read counted |
|---|---|---|
| QuickBooks | UNREACHABLE | No |
| Toast | DATA_MISSING | No |
| DoorDash | DATA_MISSING | No |
| Payroll | NOT_IMPLEMENTED | No |
| Tax | NOT_IMPLEMENTED | No |

## What Improved

- Mi-Core port `4001` ownership was restored.
- SEO Local Maps continues on port `4011`.
- DoorDash runtime was made reachable on port `3000` for inspection.
- Root causes are now specific instead of generic.

These improvements do not increase the score because they did not produce a live business read.

## What Remains Blocked

- Laptop1 QB bridge and current read-only report execution
- Toast authenticated production session
- DoorDash merchant credentials, IDs, and live import
- Payroll provider integration
- Tax provider/IRS integration

