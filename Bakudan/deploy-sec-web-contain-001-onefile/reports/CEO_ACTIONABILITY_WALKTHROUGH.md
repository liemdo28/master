# CEO Actionability Walkthrough

## Navigation Path 1: "I see Overdue Bills — what do I do?"

1. **Overview page** — CEO sees the "Overdue Bills" KPI tile with count + dollar amount.
2. **Click tile** → `/overview/drilldown/overdue-bills`
3. **Drill-down page** shows:
   - Summary bar: total overdue count + total $ at risk
   - Sortable table: Bill Name | Vendor | Store | Amount | Due Date | Overdue Days | Owner | Status
   - Each row has **[View Bill]** → `/bills/{id}` to open the specific bill and pay or upload docs.
4. **Action**: CEO clicks "View Bill" on the most critical item → lands on bill detail → clicks "Pay Now" or "Upload Evidence".

---

## Navigation Path 2: "Critical Tasks are high — who is blocked?"

1. **Overview page** — CEO sees "Critical Tasks" KPI tile showing count > threshold.
2. **Click tile** → `/overview/drilldown/critical-tasks`
3. **Drill-down page** shows:
   - Table: Task | Store | Assignee | Reviewer | Priority | Due Date | Overdue Days | Status
   - Each row has **[View Task]** → `/tasks/{id}`
4. **Action**: CEO finds tasks with no assignee or stuck in review, clicks into the task to reassign, add comment, or change priority.

---

## Navigation Path 3: "Finance Risk shows 190 Critical bills — which stores?"

1. **Overview page** — CEO sees Payment Risk Board: Critical/High/Medium/Low columns.
2. **Click "CRITICAL" column** → `/overview/drilldown/finance-bills?risk=critical`
3. **Drill-down page** shows:
   - Header: "Critical Risk Bills" with total count + exposure amount
   - Table: Bill | Vendor | Store | Amount | Due Date | Overdue Days | Owner | Status
   - [View Bill] per row
4. **Action**: CEO sorts by Store to see which location is causing most exposure, then navigates to `/overview/store/{id}` for that store.

---

## Navigation Path 4: "Execution Risk shows overloaded people — who?"

1. **Overview page** — CEO sees "Execution Risk" KPI tile with overloaded member count.
2. **Click tile** → `/overview/drilldown/execution-risk`
3. **Drill-down page** shows two sections:
   - **Overloaded Users**: User | Open Tasks | Overdue Tasks | [View Workload → /overview/member/{id}]
   - **Stuck Tasks**: Task | Stuck Since | Stage | Owner | [View Task]
4. **Action**: CEO clicks "View Workload" on the most overloaded person → member detail shows all tasks → can reassign from there.

---

## Navigation Path 5: "Something feels off — what's the biggest risk right now?"

1. **Overview page** — CEO sees the "Unified Risk Score" panel.
2. **CEO navigates to** `/overview/drilldown/unified-risk` (accessible from unified risk panel area)
3. **Drill-down page** shows:
   - Top 20 highest-risk items across bills AND tasks, ranked by risk score
   - Type | Record | Store | Owner | Risk Level | Risk Reason | Action link
4. **Action**: CEO scans the list — can directly click View on any item regardless of whether it's a bill, task, or compliance item. Triage in one view.
