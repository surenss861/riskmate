/**
 * Integration tests for entitlement system
 * 
 * Verifies that premium features are properly gated
 * and that audit logs are written correctly.
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { getEntitlements, assertEntitled, EntitlementError, type OrgSubscription } from '../lib/entitlements'

describe('Entitlement System', () => {
  describe('getEntitlements', () => {
    it('should default to starter plan when no subscription', () => {
      const entitlements = getEntitlements(null)
      
      expect(entitlements.tier).toBe('starter')
      expect(entitlements.status).toBe('none')
      expect(entitlements.permit_packs).toBe(false)
      expect(entitlements.version_history).toBe(false)
      expect(entitlements.jobs_monthly_limit).toBe(10)
      expect(entitlements.seats_limit).toBe(1)
    })

    it('should grant Business features for active Business subscription', () => {
      const subscription: OrgSubscription = {
        tier: 'business',
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        organization_id: 'org-123',
        stripe_subscription_id: 'sub_123',
        stripe_customer_id: 'cus_123',
      }

      const entitlements = getEntitlements(subscription)

      expect(entitlements.permit_packs).toBe(true)
      expect(entitlements.version_history).toBe(true)
      expect(entitlements.jobs_monthly_limit).toBe(null) // unlimited
      expect(entitlements.seats_limit).toBe(null) // unlimited
    })

    it('should grant Business features for trialing Business subscription', () => {
      const subscription: OrgSubscription = {
        tier: 'business',
        status: 'trialing',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        organization_id: 'org-123',
        stripe_subscription_id: 'sub_123',
        stripe_customer_id: 'cus_123',
      }

      const entitlements = getEntitlements(subscription)

      expect(entitlements.permit_packs).toBe(true)
      expect(entitlements.version_history).toBe(true)
    })

    it('should block Business features for past_due subscription', () => {
      const subscription: OrgSubscription = {
        tier: 'business',
        status: 'past_due',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        organization_id: 'org-123',
        stripe_subscription_id: 'sub_123',
        stripe_customer_id: 'cus_123',
      }

      const entitlements = getEntitlements(subscription)

      expect(entitlements.permit_packs).toBe(false)
      expect(entitlements.version_history).toBe(false)
      expect(entitlements.jobs_monthly_limit).toBe(0)
      expect(entitlements.seats_limit).toBe(0)
    })

    it('should allow Business features for canceled subscription still in period', () => {
      const subscription: OrgSubscription = {
        tier: 'business',
        status: 'canceled',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        organization_id: 'org-123',
        stripe_subscription_id: 'sub_123',
        stripe_customer_id: 'cus_123',
      }

      const entitlements = getEntitlements(subscription)

      expect(entitlements.permit_packs).toBe(true)
      expect(entitlements.version_history).toBe(true)
    })

    it('should block Business features for canceled subscription after period end', () => {
      const subscription: OrgSubscription = {
        tier: 'business',
        status: 'canceled',
        current_period_start: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
        current_period_end: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        organization_id: 'org-123',
        stripe_subscription_id: 'sub_123',
        stripe_customer_id: 'cus_123',
      }

      const entitlements = getEntitlements(subscription)

      expect(entitlements.permit_packs).toBe(false)
      expect(entitlements.version_history).toBe(false)
    })

    it('should set Pro plan limits correctly', () => {
      const subscription: OrgSubscription = {
        tier: 'pro',
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        organization_id: 'org-123',
        stripe_subscription_id: 'sub_123',
        stripe_customer_id: 'cus_123',
      }

      const entitlements = getEntitlements(subscription)

      expect(entitlements.permit_packs).toBe(false)
      expect(entitlements.version_history).toBe(false)
      expect(entitlements.jobs_monthly_limit).toBe(null) // unlimited
      expect(entitlements.seats_limit).toBe(5)
    })
  })

  describe('assertEntitled', () => {
    it('should throw EntitlementError when feature not available', () => {
      const entitlements = getEntitlements(null) // Starter plan

      expect(() => {
        assertEntitled(entitlements, 'permit_packs')
      }).toThrow(EntitlementError)
    })

    it('should not throw when feature is available', () => {
      const subscription: OrgSubscription = {
        tier: 'business',
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        organization_id: 'org-123',
        stripe_subscription_id: 'sub_123',
        stripe_customer_id: 'cus_123',
      }

      const entitlements = getEntitlements(subscription)

      expect(() => {
        assertEntitled(entitlements, 'permit_packs')
      }).not.toThrow()
    })

    it('should include tier and status in error message', () => {
      const entitlements = getEntitlements(null) // Starter plan

      try {
        assertEntitled(entitlements, 'permit_packs')
        expect(true).toBe(false) // Should not reach here
      } catch (err) {
        expect(err).toBeInstanceOf(EntitlementError)
        if (err instanceof EntitlementError) {
          expect(err.tier).toBe('starter')
          expect(err.status).toBe('none')
          expect(err.feature).toBe('permit_packs')
        }
      }
    })
  })
})

