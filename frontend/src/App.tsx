import { useState } from 'react'
import './index.css'
import { UploadZone } from './components/UploadZone'
import { AssetGrid } from './components/AssetGrid'
import { usePipelineHealth } from './hooks/usePipelineHealth'

export default function App() {
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const health = usePipelineHealth()

  const handleFilesSelected = (files: File[]) => {
    setUploading(true)
    setPendingFiles(files)
  }

  const handleUploadComplete = () => {
    setPendingFiles([])
    setUploading(false)
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg-base)' }}>

      {/* ── Nav ───────────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between"
        style={{
          padding: '0 32px',
          height: '56px',
          background: 'rgba(7,9,14,0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div style={{
            width: 30, height: 30,
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dim) 100%)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px var(--accent-glow)',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2.5" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="white" stroke="none" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 500, color: 'var(--accent)',
            background: 'var(--accent-glow)', border: '1px solid rgba(245,130,74,0.25)',
            borderRadius: 4, padding: '2px 7px', letterSpacing: '0.04em',
          }}>
            PHASE 1
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-5">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>FastAPI · Lambda · RDS</span>
          <div className="flex items-center gap-2">
            <div className={health === 'online' ? 'status-dot' : ''} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: health === 'online' ? 'var(--success)'
                : health === 'offline' ? 'var(--error)'
                  : 'var(--text-muted)',
              transition: 'background 0.4s',
            }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {health === 'online' ? 'API online'
                : health === 'offline' ? 'API offline'
                  : 'Checking…'}
            </span>
          </div>
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        maxWidth: 900,
        width: '100%',
        margin: '0 auto',
        padding: '56px 32px 80px',
        display: 'flex',
        flexDirection: 'column',
        gap: 48,
      }}>

        {/* ── Hero block ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
              color: 'var(--accent)', textTransform: 'uppercase',
            }}>
              Workspace
            </p>
            <h1 style={{
              fontSize: 32, fontWeight: 700, lineHeight: 1.15,
              letterSpacing: '-0.03em', color: 'var(--text-primary)',
            }}>
              Texture Drop
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 480 }}>
              Import, preview, and organize your textures in real-time.
            </p>
          </div>
          <button
            onClick={() => setShowAbout(true)}
            className="info-btn"
            style={{ marginTop: 8 }}
          >
            About
          </button>
        </div>

        {/* ── Upload ─────────────────────────────────────────────────────────── */}
        <section aria-label="Upload textures">
          <UploadZone onFilesSelected={handleFilesSelected} uploading={uploading} />
        </section>

        {/* ── Asset browser ──────────────────────────────────────────────────── */}
        <section aria-label="Asset browser">
          <AssetGrid pendingFiles={pendingFiles} onUploadComplete={handleUploadComplete} />
        </section>

      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer style={{
        padding: '16px 32px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-dimmed)' }}>
          Texture Browser · Phase 1
        </span>
        <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-dimmed)' }}>
          PNG · JPG · TGA · WEBP
        </span>
      </footer>

      {/* ── About Pipeline Modal ────────────────────────────────────────────────── */}
      {showAbout && (
        <div className="modal-overlay" onClick={() => setShowAbout(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowAbout(false)} aria-label="Close modal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
                color: 'var(--accent)', textTransform: 'uppercase',
              }}>
                Asset Ingestion Pipeline
              </p>
              <h2 style={{
                fontSize: 22, fontWeight: 700, lineHeight: 1.2,
                letterSpacing: '-0.02em', color: 'var(--text-primary)',
              }}>
                How it works
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Drop your textures — S3 ingests them, Lambda generates thumbnails, and they appear in the browser ready to use.
              </p>
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginTop: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Architecture Stack</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 12, color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>1. Upload</span>
                    <span>→ Direct to secure S3 storage bucket</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>2. Process</span>
                    <span>→ AWS Lambda generates optimized thumbnails</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>3. Browse</span>
                    <span>→ Metadata syncs to RDS/FastAPI database</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
