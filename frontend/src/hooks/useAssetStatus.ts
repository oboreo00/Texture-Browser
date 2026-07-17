import { useState, useEffect, useRef } from 'react'
import { getAsset, type Asset } from '../api/client'

const POLL_INTERVAL_MS = 2500

/**
 * Polls GET /assets/{id} every 2.5 seconds until status changes from 'processing'.
 * Stops automatically when status becomes 'ready' or 'error'.
 */
export function useAssetStatus(assetId: string | null, initialStatus: string = 'processing') {
  const [asset, setAsset] = useState<Asset | null>(null)
  const [status, setStatus] = useState(initialStatus)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!assetId || status !== 'processing') return

    const poll = async () => {
      try {
        const data = await getAsset(assetId)
        setAsset(data)
        setStatus(data.status)
        if (data.status !== 'processing') {
          clearInterval(intervalRef.current!)
        }
      } catch {
        // Network blip — keep polling
      }
    }

    poll() // Immediate first check
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => clearInterval(intervalRef.current!)
  }, [assetId, status])

  return { asset, status }
}
