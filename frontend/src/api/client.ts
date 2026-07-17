import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || '/api'  // Fallback to dev proxy if not set

export const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
})

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssetStatus = 'processing' | 'ready' | 'error'

export interface Asset {
  id: string
  filename: string
  original_extension: string | null
  raw_key: string
  thumb_key: string | null
  file_size: number | null
  mime_type: string | null
  width: number | null
  height: number | null
  status: AssetStatus
  tags: string[] | null
  created_at: string
  updated_at: string
}

export interface AssetListResponse {
  total: number
  page: number
  page_size: number
  items: Asset[]
}

export interface UploadUrlResponse {
  asset_id: string
  upload_url: string
  raw_key: string
}

export interface ThumbUrlResponse {
  asset_id: string
  thumb_url: string
  expires_in: number
}

export interface DownloadUrlResponse {
  asset_id: string
  download_url: string
  expires_in: number
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** Step 1: Ask FastAPI for a pre-signed S3 upload URL */
export async function requestUploadUrl(
  filename: string,
  fileSize: number
): Promise<UploadUrlResponse> {
  const { data } = await api.post<UploadUrlResponse>(
    `/assets/upload-url?filename=${encodeURIComponent(filename)}&file_size=${fileSize}`
  )
  return data
}

/** Step 2: PUT the file directly to S3 using the pre-signed URL */
export async function uploadToS3(
  presignedUrl: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<void> {
  console.log('[S3] uploadToS3 called')
  console.log('[S3] URL:', presignedUrl.slice(0, 90))
  console.log('[S3] File:', file.name, '|', file.type, '|', file.size, 'bytes')
  try {
    await axios.put(presignedUrl, file, {
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total))
      },
    })
    console.log('[S3] PUT succeeded ✅')
  } catch (err: any) {
    console.error('[S3] PUT failed ❌', err?.response?.status, err?.response?.data || err?.message)
    throw err
  }
}

/** Poll a single asset's status */
export async function getAsset(assetId: string): Promise<Asset> {
  const { data } = await api.get<Asset>(`/assets/${assetId}`)
  return data
}

/** List all assets */
export async function listAssets(page = 1, pageSize = 40): Promise<AssetListResponse> {
  const { data } = await api.get<AssetListResponse>(
    `/assets?page=${page}&page_size=${pageSize}`
  )
  return data
}

/** Get a fresh pre-signed thumbnail URL */
export async function getThumbUrl(assetId: string): Promise<ThumbUrlResponse> {
  const { data } = await api.get<ThumbUrlResponse>(`/assets/${assetId}/thumb-url`)
  return data
}

/** Delete an asset */
export async function deleteAsset(assetId: string): Promise<void> {
  await api.delete(`/assets/${assetId}`)
}

/** Get a fresh pre-signed download URL for the original raw texture */
export async function getDownloadUrl(assetId: string): Promise<DownloadUrlResponse> {
  const { data } = await api.get<DownloadUrlResponse>(`/assets/${assetId}/download-url`)
  return data
}
