# Double-Entry Bookkeeping — Principles and Practice

## What Is Double-Entry Bookkeeping?

Double-entry bookkeeping is the accounting method in which every financial transaction is recorded in at least two accounts, with equal debits and credits. The system ensures that the accounting equation always remains balanced:

**Assets = Liabilities + Equity**

Every transaction involves a **debit** to one or more accounts and an equal **credit** to one or more accounts. The total debits always equal the total credits.

## The Five Account Types

1. **Assets** — Resources owned by the business (cash, receivables, inventory, equipment, real estate)
2. **Liabilities** — Obligations owed to others (accounts payable, loans, accrued expenses)
3. **Equity** — Owner's residual interest (common stock, retained earnings, owner's capital)
4. **Revenue** — Income earned from operations (sales, service fees, interest income)
5. **Expenses** — Costs incurred to generate revenue (rent, salaries, cost of goods sold)

## Normal Balances

| Account Type | Normal Balance | Debit Effect | Credit Effect |
|-------------|---------------|--------------|---------------|
| Asset       | Debit         | Increase     | Decrease      |
| Liability   | Credit        | Decrease     | Increase      |
| Equity      | Credit        | Decrease     | Increase      |
| Revenue     | Credit        | Decrease     | Increase      |
| Expense     | Debit         | Increase     | Decrease      |

Mnemonic: **DEAD CLIC** — Debits increase: Expenses, Assets, Dividends. Credits increase: Liabilities, Income (revenue), Capital (equity).

## Journal Entries

Journal entries are the primary record of transactions. Each entry lists the date, accounts affected, amounts, and a brief description.

**Example 1 — Sale on credit ($500):**
```
Date: 2024-01-15
  DR Accounts Receivable    500
    CR Sales Revenue              500
  (Sold goods on account)
```

**Example 2 — Cash collection ($500):**
```
Date: 2024-01-22
  DR Cash                   500
    CR Accounts Receivable        500
  (Collected payment from customer)
```

**Example 3 — Pay rent ($1,200):**
```
Date: 2024-01-31
  DR Rent Expense           1,200
    CR Cash                       1,200
  (Paid monthly office rent)
```

## The General Ledger

The general ledger is the master set of accounts containing all recorded transactions. Each account has a running balance. The ledger is derived from posting journal entries.

A **T-account** is a visual representation of a ledger account:

```
         Cash
  ─────────────────
  DR       |  CR
  ─────────────────
  10,000   |  1,200  (rent)
   5,000   |  3,500  (supplies)
  ─────────────────
  Balance: 10,300
```

## Trial Balance

A trial balance is a list of all ledger account balances at a point in time. It confirms that total debits equal total credits:

```
Account                 Debit       Credit
Cash                   10,300
Accounts Receivable     2,000
Equipment              15,000
Accounts Payable                    4,500
Owner's Equity                     20,000
Sales Revenue                       8,000
Rent Expense            1,200
Salaries Expense        4,000
────────────────────────────────────────
Totals                 32,500      32,500
```

An unequal trial balance indicates a recording error.

## Adjusting Entries

At period-end, adjusting entries bring accounts to their correct balances:

- **Accrued revenue** — revenue earned but not yet recorded
- **Accrued expense** — expense incurred but not yet paid
- **Deferred revenue** — cash received before it is earned (liability until earned)
- **Prepaid expense** — cash paid before the benefit is received (asset until used)
- **Depreciation** — allocation of fixed-asset cost over useful life

**Example — Accrue one month of employee salaries ($3,000):**
```
  DR Salaries Expense       3,000
    CR Salaries Payable            3,000
```

## Financial Statements

From the adjusted trial balance:
- **Income Statement** — Revenue − Expenses = Net Income
- **Balance Sheet** — Assets = Liabilities + Equity (snapshot at period end)
- **Statement of Cash Flows** — Operating, Investing, Financing activities
- **Statement of Changes in Equity** — Opening equity + Net income − Dividends = Closing equity

## Sources

- OpenStax Financial Accounting — CC BY 4.0 (OpenStax CNX)
- IRS Publication 583: Starting a Business and Keeping Records — Public Domain (US Government)
