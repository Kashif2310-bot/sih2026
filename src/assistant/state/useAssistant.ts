import { useContext } from 'react'
import { AssistantCtx } from './assistant-state'

export function useAssistant() {
  const ctx = useContext(AssistantCtx)
  if (!ctx) throw new Error('useAssistant outside provider')
  return ctx
}
