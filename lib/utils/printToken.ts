import crypto from 'crypto'

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXTAUTH_SECRET || 'fallback-secret-do-not-use-in-prod'

interface PrintTokenPayload {
    jobId: string
    organizationId: string
    exp: number
}

export function signPrintToken(payload: Omit<PrintTokenPayload, 'exp'>, expiresInSeconds = 300): string {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
    const data = JSON.stringify({ ...payload, exp })
    const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex')
    return Buffer.from(JSON.stringify({ d: data, s: signature })).toString('base64')
}

export function verifyPrintToken(token: string): PrintTokenPayload | null {
    try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
        const { d: data, s: signature } = decoded

        // Verify signature
        const expectedSignature = crypto.createHmac('sha256', SECRET).update(data).digest('hex')
        if (signature !== expectedSignature) {
            console.error('[printToken] Signature mismatch')
            return null
        }

        // Verify expiration
        const payload = JSON.parse(data) as PrintTokenPayload
        if (Date.now() / 1000 > payload.exp) {
            console.error('[printToken] Token expired', { exp: payload.exp, now: Date.now() / 1000 })
            return null
        }

        return payload
    } catch (error: any) {
        console.error('[printToken] Token verification failed:', error?.message || error)
        return null
    }
}
