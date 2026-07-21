import { useState, useEffect } from 'react'
import { type Asset, getThumbUrl, getDownloadUrl } from '../api/client'
import { useAssetStatus } from '../hooks/useAssetStatus'

interface AssetCardProps {
  asset: Asset
  onDelete: (id: string) => void
}

const EXT_COLORS: Record<string, string> = {
  png: '#3b82f6',
  jpg: '#8b5cf6',
  jpeg: '#8b5cf6',
  tga: '#f59e0b',
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function AssetCard({ asset: initialAsset, onDelete }: AssetCardProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const [thumbLoaded, setThumbLoaded] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  // Poll status if still processing
  const { asset: polledAsset, status } = useAssetStatus(
    initialAsset.status === 'processing' ? initialAsset.id : null,
    initialAsset.status
  )
  const asset = polledAsset ?? initialAsset
  const ext = asset.original_extension ?? asset.filename.split('.').pop() ?? ''
  const extColor = EXT_COLORS[ext.toLowerCase()] ?? 'var(--accent)'

  // Fetch thumb URL once ready
  useEffect(() => {
    if (status === 'ready' && !thumbUrl) {
      getThumbUrl(asset.id)
        .then((r) => setThumbUrl(r.thumb_url))
        .catch(() => { })
    }
  }, [status, asset.id, thumbUrl])

  return (
    <div
      id={`asset-card-${asset.id}`}
      className="fade-in glass rounded-sm overflow-hidden group relative"
      style={{
        border: '1px solid var(--border-subtle)',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)'
        setShowDelete(true)
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
        setShowDelete(false)
      }}
    >
      {/* Thumbnail area */}
      <div
        className="relative flex items-center justify-center h-[100px] sm:h-40"
        style={{ background: 'var(--bg-elevated)' }}
      >
        {/* Ready — show thumbnail */}
        {status === 'ready' && thumbUrl && (
          <img
            src={thumbUrl}
            alt={asset.filename}
            className={`w-full h-full object-cover transition-opacity duration-500 ${thumbLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setThumbLoaded(true)}
          />
        )}

        {/* Processing overlay */}
        {status === 'processing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{ background: 'rgba(10,12,16,0.75)' }}>
            <div className="spinner" />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Optimizing…</span>
          </div>
        )}

        {/* Error overlay */}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1"
            style={{ background: 'rgba(239,68,68,0.08)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-xs" style={{ color: 'var(--error)' }}>Failed</span>
          </div>
        )}

        {/* Extension badge */}
        <div className="absolute top-2 left-2">
          <span
            className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded font-mono"
            style={{
              background: 'rgba(7, 9, 14, 0.75)',
              color: extColor,
              border: `1px solid ${extColor}55`,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
            }}
          >
            {ext}
          </span>
        </div>

        {/* Action Buttons — only show if asset is fully ready or failed (not processing) */}
        {showDelete && (status === 'ready' || status === 'error') && (
          <div className="absolute top-2 right-2 flex gap-1.5 z-10">
            {/* Download button — only for ready status */}
            {status === 'ready' && (
              <button
                id={`download-asset-${asset.id}`}
                aria-label={`Download ${asset.filename}`}
                onClick={async () => {
                  try {
                    const r = await getDownloadUrl(asset.id)
                    // Trigger native browser download by opening the presigned URL
                    window.open(r.download_url, '_blank')
                  } catch (err) {
                    console.error('Download failed:', err)
                  }
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 hover:scale-105"
                style={{
                  background: 'rgba(15, 18, 28, 0.4)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
            )}

            {/* Delete button */}
            <button
              id={`delete-asset-${asset.id}`}
              aria-label={`Delete ${asset.filename}`}
              onClick={() => onDelete(asset.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 hover:scale-105"
              style={{
                background: 'rgba(239, 68, 68, 0.35)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                cursor: 'pointer',
                color: '#ffffff'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="p-3 flex flex-col gap-1.5">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}
          title={asset.filename}>
          {asset.filename}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {asset.width && asset.height ? `${asset.width}×${asset.height}` : '—'}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {formatBytes(asset.file_size)}
          </span>
        </div>
      </div>
    </div>
  )
}
