# Planlife – To-do list

## 1. Allocation logic: cash vs investments (current savings flow)

**Goal:** Stop sending all non-retirement savings to cash. Instead, auto-allocate so that:

- **Cash target:** 6 months of expenses (emergency buffer).
- **Rule:** New non-retirement savings go to **cash** until the household’s cash balance would reach that 6‑month target; any **overflow** goes to **investments** (non-cash).

**Definition of “expenses” for the buffer:**  
Use the same outflow the engine already uses: **total monthly outflow** = lifestyle + housing + debt (i.e. `totalMonthlyOutflow`). So:

- **Cash target (per year)** = `6 * totalMonthlyOutflow` (could be computed once per year from plan inputs).

**Behavior:**

- If current cash is already ≥ 6 months of expenses, all new non-retirement savings in that year go to investments.
- If current cash is below target, allocate that year’s non-retirement savings to cash first until the target is reached (or savings run out), then the remainder to investments.
- Retirement contributions stay as today: they always go to investments (non-cash). Only the **non-retirement** part of `annualSavings` is split by this rule.

**Implementation note:**  
The split can be done inside the engine’s yearly loop: compute `cashTarget = 6 * totalMonthlyOutflow`, then treat “savings available for cash/investments” as `annualSavings - retirementTotalAnnual`. Allocate to cash up to `max(0, cashTarget - cashValue)` (after returns), then add the rest to non-cash. This keeps a single source of truth and avoids double-counting.

**Later:** This same “cash target” idea can be extended for goal-based cash (see below).

---

## 2. (Later) Goal-based cash: large expenses in &lt;~5 years

**Goal:** Let the user say they’re saving for a **near-term goal** (e.g. home down payment, wedding, vacation, car) with a **target date and amount** within about 5 years. The engine should then **add to the cash target** so that more savings are directed to cash until that goal is “funded” in the model.

**Idea:**

- User can add one or more **short-horizon goals**: e.g. “$50k for home down payment by 2030”, “$15k wedding in 2 years”.
- Only goals with target date within a horizon (e.g. 5 years from plan start) affect allocation.
- **Total cash target** = 6 months of expenses **+** sum of (goal amounts that are due within that horizon and not yet “funded”).
- Same allocation rule: non-retirement savings go to cash until this total target is met, then overflow to investments.

So the cash account can grow for both the emergency buffer and for known large one-off expenses in the &lt;5 year window. Exact UX (where goals are entered, how they’re stored in PlanState or a separate structure) can be decided when you add this; the allocation logic in (1) can be written so that “cash target” is a single number the engine receives each year (today = 6 months expenses; later = 6 months + goal-based add-on).

---

## 3. (Later) Short-horizon scenarios: “invest the goal” + Monte Carlo for probabilistic outcomes

**Context:** Once AI is integrated, users may ask things like: *“What if I hold my home down payment in investments for the next few years instead of cash?”* So we need **scenarios** that can compare:

- **Baseline:** Goal funded in cash (deterministic, no market risk).
- **Scenario:** Same goal amount and date, but the “goal bucket” is invested (or we run a short-horizon projection with that allocation).

For that to be useful, the **short-term** slice (e.g. next 3–5 years) should support **probabilistic outcomes**, not just a single path.

**Methodology (agreed):**

- Run a **Monte Carlo** over the goal’s time horizon: many paths (e.g. 1,000+) with stochastic returns (e.g. lognormal, using the same expected return/vol assumptions).
- For each path we get an ending value for the goal bucket (e.g. down-payment fund at year 3).
- Aggregate across paths to show:
  - **Percentiles:** e.g. 10th, 50th, 90th percentile ending value.
  - **Probability of success:** e.g. P(ending value ≥ target).
  - Optional: probability of a “bad” outcome (e.g. below 80% of target).

So the user can see: *“If you keep the down payment in cash you’ll have $X by 2028. If you invest it, there’s an ~Y% chance you have at least $X, but a Z% chance you’re below that.”* That supports a real trade-off (expected upside vs risk of shortfall).

**Architecture (fits AI_ENGINE_RULES):**

- **Core engine** stays **deterministic**: one PlanState → one projection. No randomness inside `simulatePlan()`.
- **Monte Carlo** is a **separate layer**: it runs the same (or a focused short-horizon) projection **many times** with different return draws, then summarizes. So:
  - Single-path math stays pure and auditable.
  - Stochastic layer is explicitly “scenario / analysis” and doesn’t change the core formulas.

Cash handling and goal logic should be designed so that:

1. The **default** (baseline) can be “goal in cash” (deterministic).
2. A **scenario** can say “this goal bucket is invested over this horizon.”
3. For that scenario we can run a **short-horizon Monte Carlo** (e.g. 3–5 years, N paths) and expose probabilistic outcomes to the user (and to the AI so it can explain them in plain language).

---

## Backlog / ideas (no order)

- [ ] Anything else you want to track here.

---

## 4. Mortgage handling (buy vs rent, amortization, extra payments)

**Goal:** Support modeling “buy now vs rent longer” and “pay down mortgage vs invest” with realistic mortgage cashflows.

**Core pieces (engine-level):**

- [ ] Add a first-class “home purchase” path (timed event) with:
  - Purchase price, down payment, closing costs
  - Mortgage principal, rate, term, start year
  - Ongoing housing costs: property tax, insurance, maintenance (rules/inputs TBD)
- [ ] Mortgage amortization schedule (monthly accrual + payments; principal/interest split; payoff).
- [ ] Optional extra principal payments (fixed monthly or percent of surplus) to enable “pay down vs invest” comparisons.
- [ ] Home value appreciation assumptions (separate from investment returns; deterministic).

**Tax note (later):**

- [ ] Consider **mortgage interest deductibility**:
  - Only applies if **itemizing** beats standard deduction (MFJ/single).
  - Deduction caps/limits depend on policy year; treat as a versioned tax policy constant (like 2026 brackets).
  - Start with a simple deterministic implementation (federal only), then refine.

---

## 5. AI upgrades (beyond single-mutation proposals)

**Goal:** Move from “single proposed mutation” to “AI proposes + runs a small set of reasonable scenarios and explains tradeoffs” while keeping the engine pure/deterministic.

- [ ] Add “planner mode” that can generate **3–5 candidate scenarios**, run them, and present a short **tradeoff summary** (net worth, liquidity/cash-buffer breaches, time-to-goal).
- [ ] Expand action vocabulary toward **time-based policies**, not only single scalar edits (e.g., “from yearIndex onward”, “until goal funded”).
- [ ] Add deterministic **scenario selection** rules (e.g., show Pareto-efficient set + anchors: maximize net worth / maximize liquidity / balanced).
- [ ] Improve conditional language handling:
  - “once income hits $X” (done for rent)
  - “once cash reaches $X”
  - “until age X / yearIndex X”
- [ ] Add stress-test scenarios (deterministic bear/base/bull) as a bridge before Monte Carlo.
