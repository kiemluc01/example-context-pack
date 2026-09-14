import { assertUtf8Ctype } from './locale';

const fakePrisma = (lc_ctype: string) => ({ $queryRaw: jest.fn().mockResolvedValue([{ lc_ctype }]) }) as never;

describe('assertUtf8Ctype', () => {
  it.each(['en_US.UTF-8', 'vi_VN.utf8', 'C.UTF-8'])('accepts %s', async (ctype) => {
    await expect(assertUtf8Ctype(fakePrisma(ctype))).resolves.toBeNull();
  });

  it.each(['C', 'POSIX', ''])('explains how to fix %p', async (ctype) => {
    const message = await assertUtf8Ctype(fakePrisma(ctype));
    expect(message).toContain(`LC_CTYPE="${ctype}"`);
    expect(message).toContain('--lc-ctype=en_US.UTF-8');
  });
});
