import path from 'node:path';
import { AvatarStorage, detectImageType } from './avatar-storage';

describe('detectImageType', () => {
  it.each([
    ['jpg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])],
    ['png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])],
    ['webp', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')])],
  ])('detects %s from magic bytes', (expected, buf) => {
    expect(detectImageType(buf)).toBe(expected);
  });

  it.each([
    ['text', Buffer.from('<svg onload=alert(1)>')],
    ['empty', Buffer.alloc(0)],
    ['truncated png', Buffer.from([0x89, 0x50, 0x4e])],
    ['riff that is not webp', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')])],
  ])('rejects %s', (_label, buf) => {
    expect(detectImageType(buf)).toBeNull();
  });
});

describe('AvatarStorage', () => {
  const storage = new AvatarStorage();

  it('resolves names inside the avatar directory only', () => {
    const resolved = storage.resolve('../../etc/passwd');
    expect(path.dirname(resolved)).toBe(path.join(process.env.UPLOAD_DIR!, 'avatars'));
    expect(path.basename(resolved)).toBe('passwd');
  });

  it('maps extensions to MIME types', () => {
    expect(storage.mimeOf('a.jpg')).toBe('image/jpeg');
    expect(storage.mimeOf('a.webp')).toBe('image/webp');
    expect(storage.mimeOf('a.exe')).toBe('application/octet-stream');
  });
});
