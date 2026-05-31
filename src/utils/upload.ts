import { getClient } from '../db/cloud'

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

function timestampName(original: string): string {
  const now = new Date()
  const ts = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}_${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`
  const ext = original.includes('.') ? original.split('.').pop() : ''
  const base = original.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '_').slice(0, 40)
  return ext ? `${ts}_${base}.${ext}` : `${ts}_${base}`
}

export async function uploadFile(
  bucket: string,
  folder: string,
  file: File
): Promise<{ storagePath: string; publicUrl: string }> {
  const storagePath = `${folder}/${timestampName(file.name)}`
  const client = getClient()
  const { error } = await client.storage.from(bucket).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  const { data: pubData } = client.storage.from(bucket).getPublicUrl(storagePath)
  return { storagePath, publicUrl: pubData.publicUrl }
}

export async function deleteFile(bucket: string, storagePath: string): Promise<void> {
  const client = getClient()
  const { error } = await client.storage.from(bucket).remove([storagePath])
  if (error) throw new Error(`Delete failed: ${error.message}`)
}
