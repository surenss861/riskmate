import { generatePdfServiceAuthToken } from './pdf-service-auth'

interface PdfOptions {
    url: string
    jobId: string
    organizationId: string // for logging context
    requestId?: string // Optional request ID for log correlation
}

/**
 * Generate PDF using self-hosted PDF service.
 * This calls your own Docker-based PDF service instead of Browserless.
 */
export async function generatePdfFromService({ url, jobId, organizationId, requestId }: PdfOptions): Promise<Buffer> {
    const start = Date.now()
    const logRequestId = requestId || `PDF-${jobId.substring(0, 8)}-${organizationId.substring(0, 8)}`
    console.log(`[${logRequestId}][stage] START generating via PDF Service for Job:${jobId.substring(0, 8)} Org:${organizationId}`)

    const serviceUrl = process.env.PDF_SERVICE_URL
    const serviceSecret = process.env.PDF_SERVICE_SECRET

    if (!serviceUrl) {
        throw new Error(`[${logRequestId}][stage] pdf_service_missing_url: PDF_SERVICE_URL environment variable is required`)
    }

    if (!serviceSecret) {
        throw new Error(`[${logRequestId}][stage] pdf_service_missing_secret: PDF_SERVICE_SECRET environment variable is required`)
    }

    // Generate HMAC auth token
    const authToken = generatePdfServiceAuthToken(serviceSecret, logRequestId)
    
    // Debug logging for auth (helps verify format matches service expectations)
    const [timestamp, hmac] = authToken.split(':')
    console.log(`[${logRequestId}][stage] call_pdf_service_start url=${serviceUrl} token_timestamp=${timestamp} token_hmac_prefix=${hmac?.substring(0, 8)}...`)

    try {
        const response = await fetch(`${serviceUrl}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
                url,
                requestId: logRequestId,
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            let errorData: any = {}
            try {
                errorData = JSON.parse(errorText)
            } catch {
                // Not JSON
            }

            const errorMessage = errorData?.message || errorData?.error || errorText || `PDF service returned ${response.status}`
            const stage = errorData?.stage || 'call_pdf_service'
            
            console.error(`[${logRequestId}][stage] ${stage}_failed status=${response.status}`)
            console.error(`[${logRequestId}] error_message=`, errorMessage)

            // Re-throw with stage context
            throw new Error(`[stage=${stage}] PDF service failed: ${errorMessage} (status: ${response.status})`)
        }

        // Get PDF buffer from response
        const arrayBuffer = await response.arrayBuffer()
        const pdfBuffer = Buffer.from(arrayBuffer)

        console.log(`[${logRequestId}][stage] call_pdf_service_ok size=${pdfBuffer.length} bytes duration=${Date.now() - start}ms`)
        console.log(`[${logRequestId}] Total duration: ${Date.now() - start}ms`)

        return pdfBuffer

    } catch (error: any) {
        const errorMessage = error?.message || 'Unknown error'
        const stage = errorMessage.match(/\[stage=(\w+)\]/)?.[1] || 'call_pdf_service'
        
        console.error(`[${logRequestId}][stage] ${stage}_failed`)
        console.error(`[${logRequestId}] error_message=`, errorMessage)
        console.error(`[${logRequestId}] error_stack=`, error?.stack || 'No stack')

        // Re-throw with stage context
        throw new Error(`[stage=${stage}] PDF service generation failed: ${errorMessage}`)
    }
}

