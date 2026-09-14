import type { PrismaClient } from '@prisma/client';

/**
 * Case-insensitive search (ILIKE) only folds Vietnamese letters when the database
 * LC_CTYPE is UTF-8; with "C" it would not match "TRẦN" against "Trần".
 * Returns a message describing the problem, or null when the locale is fine.
 */
export async function assertUtf8Ctype(prisma: Pick<PrismaClient, '$queryRaw'>): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ lc_ctype: string }>>`SHOW lc_ctype`;
  const ctype = rows[0]?.lc_ctype ?? '';
  if (/utf-?8/i.test(ctype)) return null;
  return (
    `Database đang dùng LC_CTYPE="${ctype}" nên tìm kiếm tiếng Việt không phân biệt hoa thường sẽ sai. ` +
    'Hãy tạo database với locale UTF-8, vd: createdb -T template0 -E UTF8 --lc-collate=en_US.UTF-8 --lc-ctype=en_US.UTF-8 <tên_db>'
  );
}
