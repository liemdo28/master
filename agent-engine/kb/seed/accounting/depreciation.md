# Depreciation — Methods, Calculations, and Tax Treatment

## What Is Depreciation?

Depreciation is the systematic allocation of a tangible asset's cost over its useful life. It represents the consumption of the asset's economic benefits over time. Depreciation is a non-cash expense — it reduces net income without requiring a cash outflow.

**Why depreciate?**
The matching principle requires that expenses be recognised in the same period as the revenue they help generate. A machine used over 10 years should be expensed over 10 years, not all at once when purchased.

## Key Terms

- **Cost basis** — Purchase price plus any costs to bring the asset into service (shipping, installation, taxes)
- **Salvage value** — Estimated residual value at end of useful life
- **Depreciable base** — Cost basis − Salvage value
- **Useful life** — Estimated period over which the asset generates economic benefit

## Depreciation Methods

### 1. Straight-Line (SL)

The simplest and most common method. Equal depreciation expense each year.

**Formula:**
```
Annual Depreciation = (Cost − Salvage Value) / Useful Life
```

**Example:** Machine costs $50,000, salvage value $5,000, useful life 5 years.
```
Annual Depreciation = ($50,000 − $5,000) / 5 = $9,000/year
```

| Year | Book Value (Start) | Depreciation | Book Value (End) |
|------|-------------------|-------------|-----------------|
| 1    | 50,000            | 9,000       | 41,000          |
| 2    | 41,000            | 9,000       | 32,000          |
| 3    | 32,000            | 9,000       | 23,000          |
| 4    | 23,000            | 9,000       | 14,000          |
| 5    | 14,000            | 9,000       | 5,000           |

### 2. Double Declining Balance (DDB)

An accelerated method that recognises more depreciation early in the asset's life. Used when assets lose value quickly (computers, vehicles).

**Formula:**
```
Rate = (2 / Useful Life) × 100%
Annual Depreciation = Book Value × Rate
```
(Switch to straight-line when SL gives a higher expense than DDB.)

**Example:** Same machine, rate = 2/5 = 40%.

| Year | Book Value (Start) | Rate | Depreciation | Book Value (End) |
|------|-------------------|------|-------------|-----------------|
| 1    | 50,000            | 40%  | 20,000      | 30,000          |
| 2    | 30,000            | 40%  | 12,000      | 18,000          |
| 3    | 18,000            | 40%  | 7,200       | 10,800          |
| 4    | 10,800            | SL↑  | 5,800       | 5,000           |
| 5    | 5,000             | SL   | 0           | 5,000           |

### 3. Sum-of-Years-Digits (SYD)

Another accelerated method. The fraction used each year is: (remaining life) / (sum of years' digits).

For useful life n: SYD = n(n+1)/2

**Example:** 5-year life: SYD = 5+4+3+2+1 = 15.

Year 1 fraction: 5/15 = 33.3%
Year 2 fraction: 4/15 = 26.7%
... and so on.

### 4. Units of Production (Activity Method)

Depreciation is tied to actual usage rather than time. Best for production equipment.

**Formula:**
```
Rate per Unit = (Cost − Salvage) / Total Estimated Units
Annual Depreciation = Units Produced × Rate per Unit
```

## Journal Entry for Depreciation

```
  DR Depreciation Expense     9,000
    CR Accumulated Depreciation      9,000
  (Annual depreciation — Machine A, Year 1)
```

Accumulated Depreciation is a contra-asset account — it reduces the asset's book value on the balance sheet without removing the original cost.

```
Balance Sheet presentation:
  Equipment (cost)               50,000
  Less: Accumulated Depreciation (9,000)
  Net Book Value                 41,000
```

## MACRS — US Tax Depreciation

For US federal income tax purposes, most businesses use **Modified Accelerated Cost Recovery System (MACRS)** rather than GAAP depreciation. MACRS specifies asset classes, recovery periods, and methods mandated by the IRS.

Key MACRS property classes:
- **3-year property** — small tools, racehorses
- **5-year property** — computers, automobiles, trucks
- **7-year property** — office furniture, most manufacturing equipment
- **15-year property** — land improvements, fences
- **27.5-year property** — residential rental real estate
- **39-year property** — commercial real estate

MACRS uses the **half-year convention** by default — assets placed in service any time during the year are treated as placed in service at mid-year.

### Section 179 Expensing

Section 179 allows businesses to immediately deduct the full cost of qualifying property in the year placed in service (up to the annual limit, $1,160,000 for 2023). This is an election — the business chooses whether to take it.

### Bonus Depreciation

For assets placed in service after September 27, 2017 through 2022: 100% bonus depreciation (immediate deduction). This phases down after 2022: 80% (2023), 60% (2024), 40% (2025), 20% (2026).

## Book vs Tax Depreciation

GAAP depreciation (book) and tax depreciation (MACRS) rarely match. The difference creates **deferred tax assets or liabilities** on the balance sheet. Most companies maintain two sets of depreciation schedules.

## Sources

- IRS Publication 946: How to Depreciate Property — Public Domain (US Government)
- OpenStax Financial Accounting: Long-Term Assets — CC BY 4.0
