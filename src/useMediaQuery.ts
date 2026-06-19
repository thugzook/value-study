import { useEffect, useState } from 'react'

// Reactive CSS media query (e.g. layout breakpoint, coarse pointer).
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatch(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return match
}
