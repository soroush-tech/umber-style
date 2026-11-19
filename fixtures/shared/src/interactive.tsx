'use client'

import { useEffect, useState } from 'react'
import { Button } from './components'
import { darkClass, lightClass } from './style'
import { STORAGE_KEY } from './themes'

/** An interactive button: a client component in a framework with server components. */
export function Counter() {
  const [count, setCount] = useState(0)
  return (
    <Button variant="secondary" data-testid="counter" onClick={() => setCount(count + 1)}>
      Count {count}
    </Button>
  )
}

/** Switches the root theme: a class on <html>, and the choice stored for the next load. */
export function ThemeSwitch() {
  const toggle = () => {
    const isDark = document.documentElement.className === darkClass
    document.documentElement.className = isDark ? lightClass : darkClass
    try {
      localStorage.setItem(STORAGE_KEY, isDark ? 'light' : 'dark')
    } catch {
      // Storage can be blocked: the switch still works for this page.
    }
  }
  return (
    <Button variant="outline" data-testid="theme-switch" onClick={toggle}>
      Switch theme
    </Button>
  )
}

/** Marks <html> once React has taken the page over: the end-to-end tests wait for it. */
export function Hydrated() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true'
  }, [])
  return null
}
