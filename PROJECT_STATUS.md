Overview:
Repo: C:\Users\aleks\planlife

Stack: Next.js + TS

Current files:

src/engine/types/planState.ts (v1 schema: household/income/expenses/debt/balanceSheet/home, asOfYearMonth)

src/engine/simulatePlan.ts (cashflow + returns + retirement match; outputs YearRow incl retirement fields)

src/engine/utils/debt.ts (suggested payment helper)

Next task: debt amortization

PROJECT: Planlife
STACK: Next.js + TypeScript
FOCUS: Engine-first lifetime financial projection (v1)

CURRENT ARCHITECTURE

src/
engine/
types/planState.ts
simulatePlan.ts
utils/debt.ts

scripts/
demo.ts

CURRENT DATA MODEL (v1)

PlanState includes:

asOfYearMonth (YYYY-MM)

startAge

endAge

household

expenses

debt[]

balanceSheet

assumptions

Household:

user (age, income)

optional partner (same structure)

children[] (age only)

housing:
rent → monthlyRent
own → monthlyPaymentPITI

Income:

baseAnnual

hasBonus / bonusAnnual

incomeGrowthRate

retirement:
hasPlan
employeeContributionPct
hasEmployerMatch
employerMatchPct
employerMatchUpToPct

Expenses:
Important design rule:
Lifestyle spending excludes housing and debt.

Two modes:

total → lifestyleMonthly

itemized → line items (lifestyle only)

Debt:

balance

aprPct

payoffYearMonth (YYYY-MM)

monthlyPayment (truth value)

monthlyPaymentIsOverride

Suggested payment helper:
computeSuggestedDebtMonthlyPayment()

BalanceSheet:

assets[] (cash, brokerage, retirementTaxDeferred, retirementRoth, hsa, 529, other)

home.currentValue (always included)

CURRENT ENGINE BEHAVIOR (v1)

simulatePlan():

For each year:

Compute gross household income using incomeGrowthRate.

Compute lifestyle, housing, and debt monthly.

annualSavings = grossIncome − annualOutflow.

Apply returns:

cash → cashRate

non-cash → returnRate.

Compute retirement contributions:

employee contribution (based on base salary only).

employer match (capped by upTo percent).

Add retirement contributions to non-cash.

Add remaining savings to cash.

Debt principal does NOT amortize yet.

endNetWorth = assets + home − totalDebtBalance.

YearRow outputs:

age

grossIncome

lifestyleMonthly

housingMonthly

debtMonthly

annualSavings

employeeRetirementAnnual

employerMatchAnnual

retirementTotalAnnual

endAssetValue

endNetWorth

KNOWN LIMITATIONS (NOT YET IMPLEMENTED)

Debt amortization

Taxes

Retirement contributions reducing taxable income

Asset-level allocation tracking

Inflation adjustments

Real-dollar display mode

Income overrides / job change segments

Retirement drawdown modeling

DESIGN DECISIONS LOCKED IN

Engine-first architecture.

Nominal modeling internally.

Lifestyle excludes housing and debt.

Employer match treated as incremental wealth.

Retirement contributions are allocation of savings (until tax model added).

Scenarios will be layered on top of baseline PlanState.

NEXT STEP

Implement debt amortization (principal reduction over time).