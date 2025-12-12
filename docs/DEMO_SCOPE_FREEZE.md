# Demo Scope Freeze

## Rule

**The demo is frozen unless production changes require it.**

## Rationale

The demo is a controlled, enterprise-ready proof environment. Adding features, steps, or "improvements" reduces trust and introduces risk.

## What This Means

- ✅ Demo works as-is for enterprise reviewers
- ✅ No new demo steps unless production workflow changes
- ✅ No gamification, feature toggles, or "try anything" freedom
- ✅ No analytics inside demo
- ✅ No fake database or additional simulation layers

## When Demo Can Change

1. **Production workflow changes**: If the real product workflow changes significantly, demo must reflect it
2. **Critical bug fixes**: If demo breaks or shows incorrect behavior
3. **Security issues**: If a security vulnerability is discovered

## What Demo Cannot Change For

- ❌ "Wouldn't it be cool if..."
- ❌ "Let's add one more step..."
- ❌ "What if users could..."
- ❌ Feature requests from sales
- ❌ Competitive pressure

## Sales Conversation Script

**Memorize this. Use it verbatim:**

> "This demo shows the real workflow. In production, every action is permissioned, persisted, and logged to an immutable audit trail."

## Outbound Link Strategy

**When sending the demo:**

- ✅ Use only `/demo`
- ❌ Never send `/pricing` first
- ✅ Let pricing be discovered after trust is established
- ✅ The `?from=demo` carryover is already wired correctly

## Last Updated

2025-01-15 - Demo v1.0.0

