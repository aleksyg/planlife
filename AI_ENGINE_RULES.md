Project Vision and System Architecture
Product Objective

Planlife is a deterministic lifetime financial projection engine designed to model an individual or household’s financial path from today through end-of-life.

The product flow is:

Baseline Plan Creation

User inputs current financial state:

Income

Expenses

Debt

Assets

Retirement contributions

Housing

Household composition

Engine produces a forward projection (“Base Case”).

Scenario Planning

User models decisions:

Taking a break from work

One spouse quitting

Returning to school

Income increases/decreases

Changes in expenses

Buying/selling a home

Wedding, honeymoon, one-time events

Each scenario runs a parallel PlanState.

Results are compared against the baseline.

Output focuses on variance:

Retirement age impact

Net worth delta

Savings rate changes

Probability shifts (future Monte Carlo)

Allocation & Execution Guidance

Based on where the user stands and their goals,

The system recommends capital allocation consistent with best practices:

Emergency fund first

High-interest debt payoff

Employer match capture

Tax-advantaged retirement accounts

Near-term goals funded safely

Long-term surplus invested in brokerage

The engine underpins all of this. It must remain mathematically precise and structurally clean.

Mathematical Integrity Requirements

Financial correctness is mandatory across all domains, not just debt.

The engine must ensure:

Accounting Identity Integrity

All inflows and outflows reconcile.

Asset growth equals returns plus net savings.

Debt changes reconcile interest, payment, and principal.

Net worth equals assets minus liabilities at all times.

Deterministic Reproducibility

Identical PlanState must produce identical output.

No hidden state.

No implicit mutation.

No nondeterministic behavior.

Long-Horizon Stability

Projections may span 50–70 years.

Rounding must be explicitly controlled.

Compounding must not drift due to floating-point leakage.

Intermediate totals must reconcile exactly.

Transparent Math

Intermediate values (interest, principal, contributions, savings, etc.) should be traceable.

Outputs should be explainable.

No black-box financial shortcuts.

Extensibility Without Breakage
The engine must support future layers:

Federal, state, and local tax modeling

Retirement drawdown sequencing

Capital gains realization logic

Asset allocation by account type

Monte Carlo simulations

Scenario comparisons

AI-driven modeling actions

No new feature may degrade mathematical integrity.

Architectural Boundaries
Engine Layer (engine/)

Pure deterministic simulation.

Takes PlanState.

Returns structured projection output.

Contains no UI logic.

Contains no AI logic.

Contains no network calls.

Scenario Layer

Clones and mutates PlanState.

Runs parallel simulations.

Computes deltas vs baseline.

Never alters baseline state.

AI Layer

Converts plain English into structured modeling actions.

May ask clarifying questions.

Must output structured mutations.

Must never modify engine math.

Must never inject heuristic calculations.

UI Layer

Presentation only.

No financial modeling logic.

No hidden assumptions.

AI Modeling Objective

The AI integration will allow users to describe financial decisions in plain English, such as:

“I’m working two jobs and feel burned out. What happens if I quit one?”

The AI must:

Interpret the scenario.

Determine which structured fields change (income, savings, timeline).

Ask for missing inputs if necessary.

Generate a structured mutation to PlanState.

Trigger a parallel simulation.

Compare scenario vs baseline.

Provide:

Quantitative results (e.g., retirement age shifts)

Clear financial explanation

Human-readable summary

Example output:

“Quitting the second job reduces annual savings by $60,000.
Your projected retirement age moves from 57 to 59.
Your retirement portfolio at age 60 decreases from $3.5M to $3.2M.”

AI responses must always be derived from engine outputs.

AI must never fabricate projections.

Design Philosophy

Determinism over cleverness.

Clarity over abstraction.

Structure over magic.

Explicit modeling over hidden assumptions.

Financial rigor over speed of feature delivery.

This is not a budgeting tool.
This is a long-horizon financial simulation engine.

Every implementation decision must align with this vision.