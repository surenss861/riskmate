# Error Dashboard Queries

This document provides ready-to-use queries for building error dashboards from structured error logs.

## Dashboard Views

### 1. Top Entitlement Denials by Organization

**Use Case:** Identify organizations hitting limits or payment issues

**Query (Splunk/Datadog/CloudWatch):**
```
category=entitlements 
| stats count by organization_id, code
| sort -count
| head 20
```

**Visualization:**
- Bar chart: Organization ID (x-axis) vs Error Count (y-axis)
- Color by error code
- Filter: Last 7 days

**Key Metrics:**
- `ENTITLEMENTS_JOB_LIMIT_REACHED`: Revenue opportunity (upgrade prompts)
- `ENTITLEMENTS_PLAN_PAST_DUE`: Payment issues (billing outreach)
- `ENTITLEMENTS_PLAN_INACTIVE`: Churn risk (reactivation campaigns)

---

### 2. Past Due Organizations Attempting Gated Actions

**Use Case:** Identify organizations with payment issues trying to use features

**Query:**
```
code=ENTITLEMENTS_PLAN_PAST_DUE 
| stats count, values(route) as routes by organization_id
| sort -count
```

**Visualization:**
- Table: Organization ID | Error Count | Routes Attempted
- Alert threshold: > 5 attempts in 24h

**Action Items:**
- Auto-send payment reminder email
- Flag for sales outreach
- Display upgrade banner in UI

---

### 3. Most Frequent Pagination Misuse

**Use Case:** Identify client misconfigurations or API misuse

**Query:**
```
code=PAGINATION_CURSOR_NOT_SUPPORTED 
| stats count by organization_id, sort
| sort -count
```

**Visualization:**
- Pie chart: Sort modes causing errors
- Table: Organization ID | Count | Sort Mode

**Action Items:**
- Update client SDKs if widespread
- Add client-side validation
- Update API documentation

---

### 4. Error Budget by Route (5xx Errors)

**Use Case:** Monitor error budget consumption and identify problematic endpoints

**Query:**
```
status>=500 
| stats count by route, organization_id
| sort -count
```

**Visualization:**
- Line chart: Error count over time by route
- Alert threshold: > 10 5xx errors/hour per route

**Key Metrics:**
- Error rate per route
- Error budget consumption
- Top failing endpoints

---

### 5. Error Rate Trends

**Use Case:** Track error rate over time to identify regressions

**Query:**
```
status>=400 
| timechart span=1h count by category
```

**Visualization:**
- Multi-line chart: Error count over time
- One line per category (pagination, entitlements, auth, etc.)

---

### 6. Retryable vs Non-Retryable Errors

**Use Case:** Understand error recovery patterns

**Query:**
```
status>=400 
| stats count by retryable, code
| sort -count
```

**Visualization:**
- Stacked bar chart: Retryable (green) vs Non-retryable (red)
- Grouped by error code

---

## Alert Rules

### Critical Alerts

1. **High 5xx Error Rate**
   ```
   status>=500 AND count > 10 in 5 minutes
   → Page on-call engineer
   ```

2. **Error Budget Exhaustion**
   ```
   status>=500 AND count > 100 in 1 hour
   → Alert SRE team
   ```

### Warning Alerts

1. **Entitlement Denial Spike**
   ```
   category=entitlements AND count > 50 in 1 hour
   → Notify product/sales team
   ```

2. **Pagination Misuse Pattern**
   ```
   code=PAGINATION_CURSOR_NOT_SUPPORTED AND count > 20 in 1 hour
   → Review client SDKs
   ```

---

## Key Performance Indicators (KPIs)

### Error Rate
```
total_errors / total_requests * 100
```

### Error Budget Consumption
```
5xx_errors / error_budget_limit * 100
```

### Entitlement Denial Rate
```
entitlement_errors / total_requests * 100
→ Target: < 5%
```

### Retry Success Rate
```
retryable_errors_resolved / total_retryable_errors * 100
```

---

## Sample Dashboard JSON (Grafana/Datadog)

```json
{
  "dashboard": {
    "title": "RiskMate Error Monitoring",
    "panels": [
      {
        "title": "Error Rate by Category",
        "query": "category=* | stats count by category",
        "type": "pie"
      },
      {
        "title": "5xx Errors by Route",
        "query": "status>=500 | stats count by route",
        "type": "bar"
      },
      {
        "title": "Top Entitlement Denials",
        "query": "category=entitlements | stats count by organization_id",
        "type": "table"
      }
    ]
  }
}
```

---

**Last Updated:** 2025-01-16

