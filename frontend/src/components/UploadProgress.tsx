interface UploadProgressProps {
  filename: string
  progress: number
  status: 'uploading' | 'processing' | 'ready' | 'error'
}

const STATUS_COLOR: Record<string, string> = {
  uploading:  'var(--accent)',
  processing: 'var(--warning)',
  ready:      'var(--success)',
  error:      'var(--error)',
}

const STATUS_LABEL: Record<string, string> = {
  uploading:  'Uploading to S3',
  processing: 'Lambda processing…',
  ready:      'Ready',
  error:      'Failed',
}

export function UploadProgress({ filename, progress, status }: UploadProgressProps) {
  const color = STATUS_COLOR[status]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{
          fontSize: 12, color: 'var(--text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: '60%',
        }}>
          {filename}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {(status === 'uploading' || status === 'processing') && (
            <div className="spinner" />
          )}
          <span style={{ fontSize: 11, fontWeight: 500, color }}>{STATUS_LABEL[status]}</span>
        </div>
      </div>

      {/* Track */}
      <div style={{
        width: '100%', height: 3, borderRadius: 2,
        background: 'var(--bg-overlay)', overflow: 'hidden',
      }}>
        <div
          className={status === 'uploading' ? 'progress-shimmer' : ''}
          style={{
            height: '100%', borderRadius: 2,
            width: status === 'ready' ? '100%' : status === 'processing' ? '100%' : `${progress}%`,
            background: status !== 'uploading' ? color : undefined,
            opacity: status === 'processing' ? 0.5 : 1,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  )
}
