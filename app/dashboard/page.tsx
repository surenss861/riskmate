import { redirect } from 'next/navigation'

type SearchParams = Record<string, string | string[] | undefined>

export default function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const queryString = (() => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (value === undefined || value === null) continue
      if (Array.isArray(value)) {
        value.forEach((v) => v !== undefined && params.append(key, v))
      } else {
        params.append(key, value)
      }
    }
    return params.toString()
  })()
  redirect(queryString ? `/operations?${queryString}` : '/operations')
}
