# Reporting Engine Specification

## Objective

Design a reporting engine that consumes:

- `GET /api/v1/accounting/accounts`
- `GET /api/v1/accounting/journal-entries`

The engine must produce frontend-ready financial report JSON for:

- Trial Balance
- Income Statement (Profit & Loss)
- Summary cards and grouped subtotals by `parentId`

The engine is a read-only aggregation layer. It does not write to accounting tables and does not create journal entries.

## Scope

In scope:

- Fetching account master data and journal entries from existing API endpoints
- Normalizing paginated journal-entry responses
- Aggregating debits and credits by `accountId`
- Grouping totals and subtotals by `parentId`
- Calculating revenue, expenses, and `netIncome`
- Returning a JSON object compatible with dashboard widgets

Out of scope:

- Posting or reversing entries
- Currency conversion
- Budgeting, forecasting, or ratio analysis
- Balance-sheet-specific logic

## Existing Source Contracts

### 1. Accounts endpoint

`GET /api/v1/accounting/accounts`

Observed response envelope:

```json
{
  "ok": true,
  "data": [
    {
      "id": 71,
      "code": "1000",
      "name": "Cash",
      "nameAr": null,
      "accountType": "asset",
      "parentId": null,
      "isSystem": true,
      "isActive": true,
      "balance": 200000,
      "createdAt": "2026-03-01T10:00:00.000Z"
    }
  ]
}
```

Required source fields:

- `id`
- `code`
- `name`
- `accountType`
- `parentId`
- `isActive`

Optional pass-through fields:

- `nameAr`
- `isSystem`
- `balance`
- `createdAt`

### 2. Journal entries endpoint

`GET /api/v1/accounting/journal-entries?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&isPosted=true&limit=500&offset=0`

Runtime behavior currently returns paginated data from the use case:

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": 81,
        "entryNumber": "JE-001",
        "entryDate": "2026-03-01T10:00:00.000Z",
        "description": "Sale entry",
        "sourceType": "sale",
        "sourceId": 11,
        "isPosted": true,
        "isReversed": false,
        "reversalOfId": null,
        "postingBatchId": 41,
        "totalAmount": 20000,
        "currency": "IQD",
        "notes": "Generated from sale",
        "createdAt": "2026-03-01T10:00:00.000Z",
        "createdBy": 1,
        "lines": [
          {
            "id": 1,
            "journalEntryId": 81,
            "accountId": 71,
            "debit": 20000,
            "credit": 0,
            "description": "Cash",
            "createdAt": "2026-03-01T10:00:00.000Z"
          }
        ]
      }
    ],
    "total": 1
  }
}
```

Normalization requirement:

- Accept both `{ ok: true, data: { items, total } }` and `{ ok: true, data: JournalEntry[] }`.
- Treat the array-only form as a single page with `total = data.length`.

Required source fields:

- Entry: `id`, `entryDate`, `isPosted`, `isReversed`, `sourceType`, `lines`
- Line: `accountId`, `debit`, `credit`

## Query Contract

The reporting engine accepts the same date-range semantics as the accounting routes:

```ts
type DateRangeQuery = {
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
};
```

Recommended engine input:

```ts
type ReportingEngineQuery = DateRangeQuery & {
  sourceType?: "sale" | "purchase" | "payment" | "adjustment" | "manual";
  includeInactive?: boolean;     // default false
  includeZeroBalances?: boolean; // default true
  pageSize?: number;             // default 500
};
```

Default behavior:

- `isPosted=true` must always be sent to `/journal-entries`
- `isReversed=true` entries must be excluded client-side
- `includeInactive=false`
- `includeZeroBalances=true`
- `pageSize=500`

## Processing Pipeline

### Step 1. Fetch accounts

Call `GET /api/v1/accounting/accounts` once and build:

- `accountsById: Map<number, Account>`
- `childrenByParentId: Map<number | null, Account[]>`

Filtering:

- Exclude accounts where `isActive === false` unless `includeInactive=true`

Validation:

- Account IDs must be unique
- Parent references should resolve to an existing account when `parentId !== null`

### Step 2. Fetch all journal-entry pages

Call `GET /api/v1/accounting/journal-entries` with:

- `dateFrom`
- `dateTo`
- `sourceType` when provided
- `isPosted=true`
- `limit=pageSize`
- `offset=0, pageSize, pageSize * 2...`

Stop when:

- collected items >= `total`, or
- current page returns zero items

### Step 3. Normalize and filter journal entries

Exclude entries when:

- `isPosted !== true`
- `isReversed === true`
- `entryDate` falls outside the requested range after parsing

Validation:

- Every journal line `accountId` must exist in `accountsById`
- If not, fail the report with `DATA_INTEGRITY_ERROR`

### Step 4. Seed account accumulators

Initialize an accumulator for every included account:

```ts
type AccountAccumulator = {
  accountId: number;
  accountCode: string;
  accountName: string;
  accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
  parentId: number | null;
  debit: number;
  credit: number;
  balance: number;
};
```

Initial values:

- `debit = 0`
- `credit = 0`
- `balance = 0`

### Step 5. Aggregate journal lines

For each normalized journal entry:

```ts
for (const entry of entries) {
  for (const line of entry.lines ?? []) {
    const row = accountTotals.get(line.accountId)!;
    row.debit += line.debit ?? 0;
    row.credit += line.credit ?? 0;
  }
}
```

After accumulation:

```ts
row.balance = row.debit - row.credit;
```

## Trial Balance Logic

### Function contract

```ts
function buildTrialBalance(
  accounts: Account[],
  journalEntries: JournalEntry[],
): TrialBalanceSection
```

### Rules

1. Aggregate all `debit` and `credit` values by `accountId`.
2. Compute account balance as:

```ts
balance = debit - credit;
```

3. Compute report totals:

```ts
totalDebit = sum(account.debit);
totalCredit = sum(account.credit);
difference = totalDebit - totalCredit;
isBalanced = difference === 0;
```

4. Group account rows by `parentId`.
5. For each parent group, compute:

- `totalDebit`
- `totalCredit`
- `totalBalance`
- `accountCount`

6. Sort output:

- parent groups by parent account code, then `null` parent last
- account rows by `accountCode`

### Parent grouping rule

The engine groups by direct `parentId`, not recursive descendants.

Example:

- account `5002` with `parentId = 5000` contributes to the `5000` subtotal
- account `1001` with `parentId = null` contributes to the root subtotal

### Root group behavior

Accounts without a parent must still appear in grouped output:

```json
{
  "parentId": null,
  "parentCode": null,
  "parentName": "Root",
  "totalDebit": 0,
  "totalCredit": 0,
  "totalBalance": 0,
  "accountCount": 0,
  "accounts": []
}
```

## Income Statement (P&L) Logic

### Function contract

```ts
function buildProfitLoss(trialBalanceRows: TrialBalanceRow[]): ProfitLossSection
```

### Source filter

Only include rows where:

- `accountType === "revenue"`
- `accountType === "expense"`

### Amount rules

Revenue accounts:

```ts
amount = credit - debit;
```

Expense accounts:

```ts
amount = debit - credit;
```

Totals:

```ts
totalRevenue = sum(revenue.amount);
totalExpenses = sum(expense.amount);
netIncome = totalRevenue - totalExpenses;
```

### Grouping

P&L output must provide both:

- detail rows by account
- subtotal groups by `parentId`

Grouping logic is identical to trial balance grouping, but only for revenue and expense rows.

## Output Contract

The response must use the repo's standard success envelope:

```json
{
  "ok": true,
  "data": {}
}
```

### Response shape

```ts
type ParentSubtotal = {
  parentId: number | null;
  parentCode: string | null;
  parentName: string | null;
  accountType?: "asset" | "liability" | "equity" | "revenue" | "expense";
  totalDebit?: number;
  totalCredit?: number;
  totalBalance?: number;
  totalAmount?: number;
  accountCount: number;
  accounts: Array<{
    accountId: number;
    accountCode: string;
    accountName: string;
    accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
    parentId: number | null;
    debit?: number;
    credit?: number;
    balance?: number;
    amount?: number;
  }>;
};

type ReportingEngineResponse = {
  ok: true;
  data: {
    meta: {
      generatedAt: string;
      currency: string;
      dateRange: {
        dateFrom: string | null;
        dateTo: string | null;
      };
      sourceEndpoints: {
        accounts: "/api/v1/accounting/accounts";
        journalEntries: "/api/v1/accounting/journal-entries";
      };
    };
    summary: {
      accountCount: number;
      journalEntryCount: number;
      lineCount: number;
      totalDebit: number;
      totalCredit: number;
      difference: number;
      isBalanced: boolean;
      totalRevenue: number;
      totalExpenses: number;
      netIncome: number;
    };
    trialBalance: {
      totals: {
        totalDebit: number;
        totalCredit: number;
        difference: number;
        isBalanced: boolean;
      };
      byParent: ParentSubtotal[];
    };
    profitLoss: {
      revenue: {
        total: number;
        byParent: ParentSubtotal[];
      };
      expenses: {
        total: number;
        byParent: ParentSubtotal[];
      };
      netIncome: number;
    };
    cards: Array<{
      id:
        | "totalDebit"
        | "totalCredit"
        | "difference"
        | "totalRevenue"
        | "totalExpenses"
        | "netIncome";
      label: string;
      value: number;
    }>;
  };
};
```

### Example response

```json
{
  "ok": true,
  "data": {
    "meta": {
      "generatedAt": "2026-03-04T08:00:00.000Z",
      "currency": "IQD",
      "dateRange": {
        "dateFrom": "2026-03-01",
        "dateTo": "2026-03-31"
      },
      "sourceEndpoints": {
        "accounts": "/api/v1/accounting/accounts",
        "journalEntries": "/api/v1/accounting/journal-entries"
      }
    },
    "summary": {
      "accountCount": 10,
      "journalEntryCount": 42,
      "lineCount": 96,
      "totalDebit": 3200000,
      "totalCredit": 3200000,
      "difference": 0,
      "isBalanced": true,
      "totalRevenue": 900000,
      "totalExpenses": 550000,
      "netIncome": 350000
    },
    "trialBalance": {
      "totals": {
        "totalDebit": 3200000,
        "totalCredit": 3200000,
        "difference": 0,
        "isBalanced": true
      },
      "byParent": [
        {
          "parentId": null,
          "parentCode": null,
          "parentName": "Root",
          "totalDebit": 1200000,
          "totalCredit": 850000,
          "totalBalance": 350000,
          "accountCount": 3,
          "accounts": [
            {
              "accountId": 71,
              "accountCode": "1000",
              "accountName": "Cash",
              "accountType": "asset",
              "parentId": null,
              "debit": 700000,
              "credit": 200000,
              "balance": 500000
            }
          ]
        }
      ]
    },
    "profitLoss": {
      "revenue": {
        "total": 900000,
        "byParent": [
          {
            "parentId": null,
            "parentCode": null,
            "parentName": "Root",
            "accountType": "revenue",
            "totalAmount": 900000,
            "accountCount": 1,
            "accounts": [
              {
                "accountId": 81,
                "accountCode": "4001",
                "accountName": "Sales Revenue",
                "accountType": "revenue",
                "parentId": null,
                "amount": 900000
              }
            ]
          }
        ]
      },
      "expenses": {
        "total": 550000,
        "byParent": [
          {
            "parentId": null,
            "parentCode": null,
            "parentName": "Root",
            "accountType": "expense",
            "totalAmount": 550000,
            "accountCount": 2,
            "accounts": [
              {
                "accountId": 91,
                "accountCode": "5001",
                "accountName": "COGS",
                "accountType": "expense",
                "parentId": null,
                "amount": 350000
              }
            ]
          }
        ]
      },
      "netIncome": 350000
    },
    "cards": [
      { "id": "totalRevenue", "label": "Total Revenue", "value": 900000 },
      { "id": "totalExpenses", "label": "Total Expenses", "value": 550000 },
      { "id": "netIncome", "label": "Net Income", "value": 350000 },
      { "id": "totalDebit", "label": "Total Debit", "value": 3200000 },
      { "id": "totalCredit", "label": "Total Credit", "value": 3200000 },
      { "id": "difference", "label": "Difference", "value": 0 }
    ]
  }
}
```

## Reference Implementation Notes

Recommended service signature:

```ts
async function buildFinancialDashboardReport(
  query: ReportingEngineQuery,
): Promise<ReportingEngineResponse>
```

Recommended internal helpers:

- `fetchAccounts()`
- `fetchJournalEntryPages(query)`
- `normalizeJournalEntriesResponse(payload)`
- `aggregateByAccount(accounts, entries)`
- `groupByParent(rows, accountsById)`
- `buildTrialBalanceSection(rows, accountsById)`
- `buildProfitLossSection(rows, accountsById)`
- `buildCards(summary)`

## Error Handling

Return a failed response when:

- upstream accounting endpoint returns non-200
- source payload does not match expected envelope
- journal lines reference unknown account IDs
- `dateFrom > dateTo`

Suggested error codes:

- `UPSTREAM_ACCOUNTING_ERROR`
- `INVALID_REPORT_QUERY`
- `DATA_INTEGRITY_ERROR`

## Performance Notes

- Time complexity: `O(A + E + L)`
  - `A` = accounts count
  - `E` = journal entries count
  - `L` = journal lines count
- Space complexity: `O(A + L_page)`
- Cache `/accounts` for short-lived report sessions if multiple dashboard widgets share the same data
- Prefer one full report payload over separate dashboard widget requests to avoid repeated pagination work

## Acceptance Criteria

1. Trial balance totals satisfy `totalDebit === totalCredit` when the ledger is balanced.
2. Every included account appears in exactly one `parentId` group.
3. Each parent subtotal equals the sum of its account rows.
4. Revenue rows use `credit - debit`.
5. Expense rows use `debit - credit`.
6. `netIncome = totalRevenue - totalExpenses`.
7. The response uses `{ ok: true, data: ... }`.
8. The output includes both totals and `parentId` subtotals for dashboard rendering.
