import { useState, useEffect } from 'react'
import { api } from '../api/client'

type PipelineStatus = 'checking' | 'online' | 'offline'

/**
 * Polls GET /health every 15 seconds.
 * "online" means FastAPI is reachable → the pipeline can accept uploads.
 * Lambda and S3 have no browser-pingable endpoints, but if the API is up,
 * the pipeline is ready.
 */
export function usePipelineHealth(intervalMs = 30_000) {
  const [status, setStatus] = useState<PipelineStatus>('checking')

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        await api.get('/health', { timeout: 5000 })
        if (!cancelled) setStatus('online')
      } catch {
        if (!cancelled) setStatus('offline')
      }
    }

    check() // immediate on mount
    const id = setInterval(check, intervalMs)
    return () => { cancelled = true; clearInterval(id) }
  }, [intervalMs])

  return status
}
