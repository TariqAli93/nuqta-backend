# HR & Payroll module

## OpenAPI surface

- `GET /api/v1/hr/employees`
- `GET /api/v1/hr/employees/{id}`
- `POST /api/v1/hr/employees`
- `PUT /api/v1/hr/employees/{id}`
- `GET /api/v1/hr/payroll-runs`
- `GET /api/v1/hr/payroll-runs/{id}`
- `POST /api/v1/hr/payroll-runs`
- `POST /api/v1/hr/payroll-runs/{id}/approve`

## Core data model

- `employees`: stores the HR master record with `id`, `name`, `salary`, `position`, and `department`.
- `payroll_runs`: stores one payroll header per month, the selected salary-expense, deductions-liability, and cash/bank account codes, totals, approval metadata, and the linked `journal_entry_id`.
- `payroll_run_items`: stores the monthly payroll snapshot per employee, including `gross_pay`, `deductions`, `bonuses`, and `net_pay`.

## Payroll calculation

For each payroll item:

`net_pay = gross_pay - deductions + bonuses`

Where:

- `gross_pay` is copied from the employee salary at the time the payroll run is created.
- `deductions` and `bonuses` are request-time adjustments stored as historical snapshots.
- Header totals are the sum of the item values across the run.

## Accounting integration

Approving a payroll run creates a draft journal entry through the existing accounting repository, which makes it visible under:

- `GET /api/v1/accounting/journal-entries?sourceType=manual`

Posting logic:

1. Resolve the payroll run's `salaryExpenseAccountCode`.
2. Resolve the payroll run's `deductionsLiabilityAccountCode` when deductions exist.
3. Resolve the payroll run's `paymentAccountCode`.
4. Create a `manual` journal entry with `sourceId = payroll_run.id`.
5. Add lines using the run totals:
   - Debit salary expense for `gross_pay + bonuses`.
   - Credit payroll deductions payable for `deductions` when deductions exist.
   - Credit cash/bank for `net_pay`.
6. Save the created `journalEntryId` back to the payroll run and mark the run as approved.

## Note

The current model uses one aggregated deductions-liability account because payroll input stores deductions as a single amount per employee. If the module later needs tax, pension, or insurance splits, the approval logic can fan those credits out into multiple liability accounts without changing the employee master data.
