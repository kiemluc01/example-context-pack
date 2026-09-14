import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
export type AvatarExt = keyof typeof AVATAR_MIME;

/** Identifies the image type from its magic bytes; the client-supplied MIME type is not trusted. */
export function detectImageType(buf: Buffer): AvatarExt | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  return null;
}

@Injectable()
export class AvatarStorage {
  private readonly dir = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads'), 'avatars');

  async save(buf: Buffer, ext: AvatarExt): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    await writeFile(this.resolve(name), buf);
    return name;
  }

  /** Stored names are generated server-side; basename() still blocks path traversal. */
  resolve(name: string): string {
    return path.join(this.dir, path.basename(name));
  }

  async remove(name: string): Promise<void> {
    await rm(this.resolve(name), { force: true });
  }

  mimeOf(name: string): string {
    const ext = path.extname(name).slice(1) as AvatarExt;
    return AVATAR_MIME[ext] ?? 'application/octet-stream';
  }
}
