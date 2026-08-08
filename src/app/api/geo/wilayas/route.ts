import { handler, ok } from '@/lib/api/response';
import { getWilayas } from '@/server/services/reference.service';

export const runtime = 'nodejs';
// Reference data: safe to cache at the edge for a day.
export const revalidate = 86400;

export const GET = handler(async () => {
  const wilayas = await getWilayas();
  return ok(wilayas);
});
