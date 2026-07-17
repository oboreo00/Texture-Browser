import React, { useCallback, useState } from 'react'

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tga']

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void
  uploading: boolean
}

export function UploadZone({ onFilesSelected, uploading }: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const validateFiles = (files: FileList | File[]): File[] => {
    const arr = Array.from(files)
    const valid = arr.filter((f) => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase()
      return ALLOWED_EXTENSIONS.includes(ext)
    })
    if (valid.length < arr.length) {
      setError('Some files skipped — only PNG, JPG, TGA are supported.')
      setTimeout(() => setError(null), 4000)
    } else {
      setError(null)
    }
    return valid
  }

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragActive(false)
      const files = validateFiles(e.dataTransfer.files)
      if (files.length) onFilesSelected(files)
    },
    [onFilesSelected]
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    const files = validateFiles(e.target.files)
    if (files.length) onFilesSelected(files)
    e.target.value = ''
  }

  return (
    <div
      id="upload-zone"
      role="button"
      tabIndex={0}
      aria-label="Upload texture files"
      onClick={() => !uploading && inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      className={dragActive ? 'upload-zone-active' : ''}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        minHeight: 240,
        borderRadius: 18,
        border: `1.5px dashed ${dragActive ? 'var(--accent)' : 'var(--border-default)'}`,
        background: dragActive
          ? 'rgba(245,130,74,0.04)'
          : 'linear-gradient(160deg, rgba(19,25,41,0.7) 0%, rgba(12,15,24,0.9) 100%)',
        cursor: uploading ? 'not-allowed' : 'pointer',
        opacity: uploading ? 0.55 : 1,
        transition: 'border-color 0.2s, background 0.2s',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        id="file-input"
        multiple
        accept=".png,.jpg,.jpeg,.tga"
        onChange={handleChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* Subtle corner accents */}
      {(['tl','tr','bl','br'] as const).map((corner) => (
        <div key={corner} style={{
          position: 'absolute',
          width: 16, height: 16,
          top: corner.startsWith('t') ? 16 : undefined,
          bottom: corner.startsWith('b') ? 16 : undefined,
          left: corner.endsWith('l') ? 16 : undefined,
          right: corner.endsWith('r') ? 16 : undefined,
          borderTop: corner.startsWith('t') ? `1.5px solid var(--accent)` : undefined,
          borderBottom: corner.startsWith('b') ? `1.5px solid var(--accent)` : undefined,
          borderLeft: corner.endsWith('l') ? `1.5px solid var(--accent)` : undefined,
          borderRight: corner.endsWith('r') ? `1.5px solid var(--accent)` : undefined,
          opacity: 0.45,
          borderRadius: corner === 'tl' ? '4px 0 0 0' : corner === 'tr' ? '0 4px 0 0' : corner === 'bl' ? '0 0 0 4px' : '0 0 4px 0',
        }}/>
      ))}

      {/* Upload icon */}
      <div className="icon-float" style={{
        width: 52, height: 52,
        borderRadius: 14,
        background: 'rgba(245,130,74,0.1)',
        border: '1px solid rgba(245,130,74,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(245,130,74,0.12)',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>

      {/* Text */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          {dragActive ? 'Release to upload' : 'Drop textures here'}
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          or{' '}
          <span style={{ color: 'var(--accent)', fontWeight: 500 }}>browse files</span>
          {' '}· PNG, JPG, TGA · up to 50 MB
        </p>
      </div>

      {/* Error toast */}
      {error && (
        <div style={{
          position: 'absolute', bottom: 16,
          fontSize: 12, color: 'var(--error)',
          background: 'rgba(248,113,113,0.08)',
          border: '1px solid rgba(248,113,113,0.2)',
          borderRadius: 8, padding: '6px 14px',
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
