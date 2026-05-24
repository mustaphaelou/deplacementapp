import { writeFile, unlink } from "fs/promises"
import { join } from "path"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE = 2 * 1024 * 1024

export class AvatarError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "AvatarError"
    this.status = status
  }
}

export interface AvatarStorage {
  save(dataUri: string, userId: string): Promise<string>
  delete(urlPath: string): Promise<void>
}

export class LocalFilesystemAvatarStorage implements AvatarStorage {
  async save(dataUri: string, userId: string): Promise<string> {
    const matches = dataUri.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!matches) {
      throw new AvatarError("Format d'image invalide", 400)
    }
    const mime = matches[1]
    if (!ALLOWED_TYPES.includes(mime)) {
      throw new AvatarError("Type d'image non autorisé (JPG, PNG, WebP uniquement)", 400)
    }
    const buffer = Buffer.from(matches[2], "base64")
    if (buffer.length > MAX_SIZE) {
      throw new AvatarError("L'image ne doit pas dépasser 2 Mo", 400)
    }
    const ext = mime.split("/")[1]
    const filename = `avatar-${userId}-${Date.now()}.${ext}`
    const filepath = join(process.cwd(), "public", "uploads", "avatars", filename)
    await writeFile(filepath, buffer)
    return `/uploads/avatars/${filename}`
  }

  async delete(urlPath: string): Promise<void> {
    const fullPath = join(process.cwd(), "public", urlPath)
    try { await unlink(fullPath) } catch {}
  }
}

export const avatarStorage: AvatarStorage = new LocalFilesystemAvatarStorage()
