import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { getAnalyticsContext } from '@/lib/utils/analyticsAuth'
import { parsePeriod, parseSinceUntil } from '@/lib/utils/analyticsDateRange'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

const ROUTE = '/api/analytics/hazard-frequency'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsedPeriod = parsePeriod(searchParams.get('period'))
    const sinceParam = searchParams.get('since')
    const untilParam = searchParams.get('until')
    const customRange = parseSinceUntil(sinceParam, untilParam)
    if (customRange && 'error' in customRange) {
      const requestId = getRequestId(request)
      if (customRange.error === 'invalid_order') {
        const { response, errorId } = createErrorResponse(
          'Invalid date range: since must be before or equal to until',
          'VALIDATION_ERROR',
          { requestId, statusCode: 400 }
        )
        logApiError(400, 'VALIDATION_ERROR', errorId, requestId, undefined, response.message, {
          category: 'validation', severity: 'warn', route: ROUTE,
        })
        return NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
      if (customRange.error === 'invalid_format') {
        const { response, errorId } = createErrorResponse(
          'Invalid date format for since or until',
          'VALIDATION_ERROR',
          { requestId, statusCode: 400 }
        )
        logApiError(400, 'VALIDATION_ERROR', errorId, requestId, undefined, response.message, {
          category: 'validation', severity: 'warn', route: ROUTE,
        })
        return NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
      if (customRange.error === 'missing_bound') {
        const { response, errorId } = createErrorResponse(
          'Date range requires both since and until',
          'VALIDATION_ERROR',
          { requestId, statusCode: 400 }
        )
        logApiError(400, 'VALIDATION_ERROR', errorId, requestId, undefined, response.message, {
          category: 'validation', severity: 'warn', route: ROUTE,
        })
        return NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
    }

    const ctx = await getAnalyticsContext(request, ROUTE)
    if (ctx instanceof NextResponse) return ctx
    const { requestId, hasAnalytics, isActive } = ctx

    const groupByParam = searchParams.get('groupBy')
    const groupBy = groupByParam === 'location' ? 'location' : 'type'

    if (!isActive || !hasAnalytics) {
      const periodLabel = parsedPeriod.key === '1y' ? '1y' : `${parsedPeriod.days}d`
      return NextResponse.json(
        { period: periodLabel, groupBy, items: [], locked: true },
        { status: 200, headers: { 'X-Request-ID': requestId } }
      )
    }

    return proxyToBackend(request, '/api/analytics/hazard-frequency', { method: 'GET' })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Analytics hazard-frequency proxy error:', error)
    const rid = getRequestId(request)
    const { response, errorId } = createErrorResponse(
      'Failed to fetch hazard frequency',
      'PROXY_ERROR',
      {
        requestId: rid,
        statusCode: 500,
        details: process.env.NODE_ENV === 'development' ? { detail: err?.message } : undefined,
      }
    )
    logApiError(500, 'PROXY_ERROR', errorId, rid, undefined, response.message, {
      category: 'internal', severity: 'error', route: ROUTE,
      details: process.env.NODE_ENV === 'development' ? { detail: err?.message } : undefined,
    })
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': rid, 'X-Error-ID': errorId },
    })
  }
}
