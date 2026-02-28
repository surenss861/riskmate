/**
 * Regression tests: SSRF webhook URL validation must block IPv4-mapped IPv6
 * loopback and private addresses in all encodings (dotted decimal and hex).
 */

import { validateWebhookUrl } from '../webhookUrl'

describe('validateWebhookUrl – IPv4-mapped IPv6 and reserved ranges', () => {
  describe('IPv4-mapped IPv6 loopback (must be blocked)', () => {
    it('blocks ::ffff:127.0.0.1 (dotted decimal)', async () => {
      const result = await validateWebhookUrl('https://[::ffff:127.0.0.1]/callback')
      expect(result.valid).toBe(false)
      expect(result.valid === false && result.reason).toContain('public')
    })

    it('blocks ::ffff:7f00:1 (hex form of 127.0.0.1)', async () => {
      const result = await validateWebhookUrl('https://[::ffff:7f00:1]/callback')
      expect(result.valid).toBe(false)
      expect(result.valid === false && result.reason).toContain('public')
    })

    it('blocks ::ffff:0:7f00:1 (hex with leading zero segment)', async () => {
      const result = await validateWebhookUrl('https://[::ffff:0:7f00:1]/callback')
      expect(result.valid).toBe(false)
      expect(result.valid === false && result.reason).toContain('public')
    })

    it('blocks ::ffff:7f00:0001 (hex with padding)', async () => {
      const result = await validateWebhookUrl('https://[::ffff:7f00:0001]/callback')
      expect(result.valid).toBe(false)
      expect(result.valid === false && result.reason).toContain('public')
    })
  })

  describe('IPv4-mapped IPv6 private (must be blocked)', () => {
    it('blocks ::ffff:10.0.0.1 (dotted decimal)', async () => {
      const result = await validateWebhookUrl('https://[::ffff:10.0.0.1]/callback')
      expect(result.valid).toBe(false)
      expect(result.valid === false && result.reason).toContain('public')
    })

    it('blocks ::ffff:0a00:1 (hex form of 10.0.0.1)', async () => {
      const result = await validateWebhookUrl('https://[::ffff:0a00:1]/callback')
      expect(result.valid).toBe(false)
      expect(result.valid === false && result.reason).toContain('public')
    })

    it('blocks ::ffff:192.168.1.1 (dotted decimal)', async () => {
      const result = await validateWebhookUrl('https://[::ffff:192.168.1.1]/callback')
      expect(result.valid).toBe(false)
      expect(result.valid === false && result.reason).toContain('public')
    })

    it('blocks ::ffff:c0a8:101 (hex form of 192.168.1.1)', async () => {
      const result = await validateWebhookUrl('https://[::ffff:c0a8:101]/callback')
      expect(result.valid).toBe(false)
      expect(result.valid === false && result.reason).toContain('public')
    })

    it('blocks ::ffff:172.16.0.1 (dotted decimal)', async () => {
      const result = await validateWebhookUrl('https://[::ffff:172.16.0.1]/callback')
      expect(result.valid).toBe(false)
      expect(result.valid === false && result.reason).toContain('public')
    })

    it('blocks ::ffff:ac10:1 (hex form of 172.16.0.1)', async () => {
      const result = await validateWebhookUrl('https://[::ffff:ac10:1]/callback')
      expect(result.valid).toBe(false)
      expect(result.valid === false && result.reason).toContain('public')
    })
  })

  describe('IPv4-mapped IPv6 public (must be allowed when literal IP)', () => {
    it('allows ::ffff:8.8.8.8 (dotted decimal)', async () => {
      const result = await validateWebhookUrl('https://[::ffff:8.8.8.8]/callback')
      expect(result.valid).toBe(true)
    })

    it('allows ::ffff:808:808 (hex form of 8.8.8.8)', async () => {
      const result = await validateWebhookUrl('https://[::ffff:808:808]/callback')
      expect(result.valid).toBe(true)
    })
  })

  describe('Non-mapped IPv6 reserved (must be blocked)', () => {
    it('blocks ::1 (loopback)', async () => {
      const result = await validateWebhookUrl('https://[::1]/callback')
      expect(result.valid).toBe(false)
      expect(result.valid === false && result.reason).toContain('public')
    })

    it('blocks fe80::1 (link-local)', async () => {
      const result = await validateWebhookUrl('https://[fe80::1]/callback')
      expect(result.valid).toBe(false)
      expect(result.valid === false && result.reason).toContain('public')
    })

    it('blocks fc00::1 (unique local)', async () => {
      const result = await validateWebhookUrl('https://[fc00::1]/callback')
      expect(result.valid).toBe(false)
      expect(result.valid === false && result.reason).toContain('public')
    })
  })
})
