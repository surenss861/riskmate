/**
 * Component-level tests for SelectedOrganizationBootstrap effect orchestration:
 * first-session bootstrap, auth-key change cancellation, and retry with cleanup.
 * @jest-environment jsdom
 */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { SelectedOrganizationBootstrap } from '@/components/SelectedOrganizationBootstrap'

beforeAll(() => {
  ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

const RETRY_DELAY_MS = 3000

function makeSession(userId: string, accessToken: string) {
  return {
    user: { id: userId },
    access_token: accessToken,
  }
}

type SessionShape = ReturnType<typeof makeSession> | null

let getSessionReturn: SessionShape = null
let onAuthStateChangeCb: (() => void) | null = null
const runBootstrapMock = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: getSessionReturn } }),
      onAuthStateChange: (cb: () => void) => {
        onAuthStateChangeCb = cb
        return { data: { subscription: { unsubscribe: jest.fn() } } }
      },
    },
  }),
}))

jest.mock('@/lib/selectedOrganizationBootstrap', () => ({
  runSelectedOrganizationBootstrap: (token: string) => runBootstrapMock(token),
}))

describe('SelectedOrganizationBootstrap', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    onAuthStateChangeCb = null
    runBootstrapMock.mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  async function renderAndFlush() {
    await act(async () => {
      root.render(
        <SelectedOrganizationBootstrap />
      )
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  it('triggers bootstrap immediately on first authenticated session', async () => {
    getSessionReturn = makeSession('user-1', 'token-1')
    runBootstrapMock.mockResolvedValue({ ok: true })

    await renderAndFlush()

    expect(runBootstrapMock).toHaveBeenCalledTimes(1)
    expect(runBootstrapMock).toHaveBeenCalledWith('token-1')
  })

  it('auth-key change cancels prior in-flight bootstrap result application', async () => {
    let resolveFirst: (value: { ok: true }) => void
    const firstPromise = new Promise<{ ok: true }>((r) => {
      resolveFirst = r
    })
    getSessionReturn = makeSession('user-1', 'token-1')
    runBootstrapMock.mockImplementation((token: string) => {
      if (token === 'token-1') return firstPromise
      return Promise.resolve({ ok: true })
    })

    await renderAndFlush()
    expect(runBootstrapMock).toHaveBeenCalledTimes(1)
    expect(runBootstrapMock).toHaveBeenCalledWith('token-1')

    getSessionReturn = makeSession('user-1', 'token-2')
    await act(async () => {
      onAuthStateChangeCb?.()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(runBootstrapMock).toHaveBeenCalledTimes(2)
    expect(runBootstrapMock).toHaveBeenLastCalledWith('token-2')

    await act(async () => {
      resolveFirst!({ ok: true })
      await Promise.resolve()
    })

    expect(runBootstrapMock).toHaveBeenCalledTimes(2)
  })

  it('schedules retries on failure up to MAX_RETRIES with timeout cleanup on unmount', async () => {
    jest.useFakeTimers()
    getSessionReturn = makeSession('user-1', 'token-1')
    runBootstrapMock.mockResolvedValue({ ok: false })

    await renderAndFlush()
    expect(runBootstrapMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      jest.advanceTimersByTime(RETRY_DELAY_MS)
      await Promise.resolve()
    })
    expect(runBootstrapMock).toHaveBeenCalledTimes(2)

    await act(async () => {
      jest.advanceTimersByTime(RETRY_DELAY_MS)
      await Promise.resolve()
    })
    expect(runBootstrapMock).toHaveBeenCalledTimes(3)

    await act(async () => {
      jest.advanceTimersByTime(RETRY_DELAY_MS)
      await Promise.resolve()
    })
    expect(runBootstrapMock).toHaveBeenCalledTimes(3)

    jest.useRealTimers()
  })

  it('cleans up retry timeout on unmount so no further retries run', async () => {
    jest.useFakeTimers()
    getSessionReturn = makeSession('user-1', 'token-1')
    runBootstrapMock.mockResolvedValue({ ok: false })

    await renderAndFlush()
    expect(runBootstrapMock).toHaveBeenCalledTimes(1)

    act(() => {
      root.unmount()
    })
    jest.advanceTimersByTime(RETRY_DELAY_MS * 2)

    expect(runBootstrapMock).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
  })

  it('cleans up retry timeout on auth-key change so scheduled retry does not run', async () => {
    jest.useFakeTimers()
    getSessionReturn = makeSession('user-1', 'token-1')
    runBootstrapMock.mockImplementation((token: string) => {
      return Promise.resolve({ ok: token === 'token-2' })
    })

    await renderAndFlush()
    expect(runBootstrapMock).toHaveBeenCalledTimes(1)
    expect(runBootstrapMock).toHaveBeenCalledWith('token-1')

    getSessionReturn = makeSession('user-1', 'token-2')
    await act(async () => {
      onAuthStateChangeCb?.()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(runBootstrapMock).toHaveBeenCalledTimes(2)
    expect(runBootstrapMock).toHaveBeenLastCalledWith('token-2')

    jest.advanceTimersByTime(RETRY_DELAY_MS * 2)
    await act(async () => {
      await Promise.resolve()
    })
    expect(runBootstrapMock).toHaveBeenCalledTimes(2)
    jest.useRealTimers()
  })
})
