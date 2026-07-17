import { useState, useEffect, useCallback } from 'react'
import { listAssets, deleteAsset, requestUploadUrl, uploadToS3, type Asset } from '../api/client'
import { AssetCard } from './AssetCard'
import { UploadProgress } from './UploadProgress'

interface UploadItem {
  id: string
  filename: string
  progress: number
  status: 'uploading' | 'processing' | 'ready' | 'error'
}

interface AssetGridProps {
  pendingFiles: File[]
  onUploadComplete: () => void
}

export function AssetGrid({ pendingFiles, onUploadComplete }: AssetGridProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Fetch asset list
  const fetchAssets = useCallback(async () => {
    try {
      const data = await listAssets(1, 80)
      setAssets(data.items)
    } catch {
      // silently fail on network error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  // Handle incoming files from UploadZone
  useEffect(() => {
    if (!pendingFiles.length) return

    pendingFiles.forEach(async (file) => {
      const tempId = `upload-${Date.now()}-${file.name}`

      // Add to upload queue
      setUploads((prev) => [
        ...prev,
        { id: tempId, filename: file.name, progress: 0, status: 'uploading' },
      ])

      let asset_id: string | null = null
      try {
        // Step 1: Get pre-signed URL from FastAPI
        const { asset_id: id, upload_url } = await requestUploadUrl(file.name, file.size)
        asset_id = id

        // Step 2: PUT directly to S3
        await uploadToS3(upload_url, file, (pct) => {
          setUploads((prev) =>
            prev.map((u) => (u.id === tempId ? { ...u, progress: pct } : u))
          )
        })

        // Step 3: Mark as processing (Lambda will take over)
        setUploads((prev) =>
          prev.map((u) => (u.id === tempId ? { ...u, status: 'processing', id: asset_id! } : u))
        )

        // Refresh the grid to show the new asset card
        await fetchAssets()
        onUploadComplete()

        // Auto-remove upload item from progress list after 8 seconds
        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.id !== asset_id))
        }, 8000)
      } catch (err) {
        console.error('[Upload failed]', err)
        setUploads((prev) =>
          prev.map((u) => (u.id === tempId ? { ...u, status: 'error' } : u))
        )
        // Clean up orphaned DB record so it doesn't poll forever
        if (asset_id) {
          try { await deleteAsset(asset_id) } catch {}
        }
      }
    })
  }, [pendingFiles])

  const handleDelete = async (id: string) => {
    await deleteAsset(id)
    setAssets((prev) => prev.filter((a) => a.id !== id))
  }

  const FILTERS = ['all', 'ready', 'processing', 'error']

  const filtered = filterStatus === 'all'
    ? assets
    : assets.filter((a) => a.status === filterStatus)

  return (
    <div className="flex flex-col gap-6">
      {/* Active uploads progress */}
      {uploads.length > 0 && (
        <div className="glass rounded-xl p-4 flex flex-col gap-3"
             style={{ border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Uploads
          </p>
          {uploads.map((u) => (
            <UploadProgress key={u.id} filename={u.filename} progress={u.progress} status={u.status} />
          ))}
        </div>
      )}

      {/* Filter tabs + count — only show when there are assets */}
      {assets.length > 0 && (
        <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border-subtle)' }}>
          {/* Status Filters */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
              Filter By:
            </span>
            <div className="flex gap-1.5 p-1 rounded-xl glass relative group/bar" style={{ border: '1px solid var(--border-subtle)' }}>
              {FILTERS.map((f) => {
                const isActive = filterStatus === f
                const tooltipText = f === 'all' ? 'Show all assets'
                                  : f === 'ready' ? 'Show assets ready for use'
                                  : f === 'processing' ? 'Show assets currently processing'
                                  : 'Show failed uploads'

                return (
                  <div key={f} className="relative group/btn">
                    <button
                      id={`filter-${f}`}
                      onClick={() => setFilterStatus(f)}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all duration-200 flex items-center gap-1.5"
                      style={{
                        background: isActive ? 'var(--bg-overlay)' : 'transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        boxShadow: isActive ? 'inset 0 1px 0 0 rgba(255,255,255,0.05), var(--shadow-sm)' : 'none',
                        border: isActive ? '1px solid var(--border-default)' : '1px solid transparent',
                        cursor: 'pointer',
                      }}
                    >
                      {/* Status dot helper */}
                      {f === 'ready' && (
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
                      )}
                      {f === 'processing' && (
                        <span className="w-1.5 h-1.5 rounded-full status-dot" style={{ background: 'var(--warning)' }} />
                      )}
                      {f === 'error' && (
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--error)' }} />
                      )}
                      {f}
                    </button>

                    {/* Tooltip — moved higher (mb-3.5) with slight translateY correction */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3.5 hidden group-hover/btn:block z-30 pointer-events-none">
                      <div className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium leading-normal normal-case whitespace-nowrap text-center text-primary-200 glass shadow-lg"
                           style={{ 
                             background: 'rgba(12,15,24,0.95)', 
                             border: '1px solid var(--border-strong)',
                             color: 'var(--text-primary)',
                             boxShadow: 'var(--shadow-md)'
                           }}>
                        {tooltipText}
                      </div>
                      {/* Tooltip Arrow — adjusted relative position */}
                      <div className="w-2 h-2 rotate-45 absolute top-full left-1/2 -translate-x-1/2 -translate-y-1"
                           style={{ background: 'rgba(12,15,24,0.95)', borderRight: '1px solid var(--border-strong)', borderBottom: '1px solid var(--border-strong)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          
          {/* Total assets count */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-[11px]" 
               style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            <span>TOTAL:</span>
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {filtered.length} / {assets.length}
            </span>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {filterStatus === 'all' ? 'No textures yet — drop some files above' : `No ${filterStatus} assets`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4"
             style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {filtered.map((asset) => (
            <AssetCard key={asset.id} asset={asset} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
