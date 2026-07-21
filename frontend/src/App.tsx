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
        className="sticky top-0 z-20 flex items-center justify-between app-header"
        style={{
          height: '56px',
          background: 'rgba(7,9,14,0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8" style={{
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dim) 100%)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 14px var(--accent-glow)',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[14px] h-[14px] sm:w-[18px] sm:h-[18px]">
              {/* Shield outline representing the Vault */}
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(255,255,255,0.12)" />
              {/* Safe/Vault lock wheel with spokes pointing outwards (hollow center) */}
              <circle cx="12" cy="11" r="3.5" />
              <line x1="12" y1="7.5" x2="12" y2="5" />
              <line x1="12" y1="14.5" x2="12" y2="17" />
              <line x1="8.5" y1="11" x2="6" y2="11" />
              <line x1="15.5" y1="11" x2="18" y2="11" />
            </svg>
          </div>
          <span className="text-xs sm:text-[14px]" style={{
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            fontFamily: 'system-ui, sans-serif'
          }}>
            Texture Bank
          </span>
          <span className="text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5" style={{
            fontWeight: 600, color: 'var(--accent)',
            background: 'var(--accent-glow)', border: '1px solid rgba(245,130,74,0.25)',
            borderRadius: 4, letterSpacing: '0.04em',
          }}>
            PHASE 1
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3 sm:gap-5 pr-2 sm:pr-4">
          <span className="text-[10px] sm:text-[12px]" style={{ color: 'var(--text-muted)' }}>FastAPI · Lambda · RDS</span>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className={`w-1.5 h-1.5 sm:w-[7px] sm:h-[7px] rounded-full ${health === 'online' ? 'status-dot' : ''}`} style={{
              background: health === 'online' ? 'var(--success)'
                : health === 'offline' ? 'var(--error)'
                  : 'var(--text-muted)',
              transition: 'background 0.4s',
            }} />
            <span className="text-[10px] sm:text-[12px]" style={{ color: 'var(--text-secondary)' }}>
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
            <p style={{ fontSize: 16, color: 'var(--text-primary)', lineHeight: 1.6, maxWidth: 480 }}>
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
