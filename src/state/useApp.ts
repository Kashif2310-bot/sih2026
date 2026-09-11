import { useContext } from 'react'
import { AppCtx } from './app-state'

export function useApp() {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp outside provider')
  return ctx
}
