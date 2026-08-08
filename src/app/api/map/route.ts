import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { ipOf } from '@/lib/api/request';
import { RATE_LIMITS, enforce } from '@/server/rate-limit';
import { listCampaignMapMarkers } from '@/server/services/campaign.service';
import { listEventMapMarkers } from '@/server/services/event.service';
import { listRequestMapMarkers } from '@/server/services/request.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public map markers.
 *
 * Returns only items that are published AND carry a coordinate the author
 * agreed to expose. Requests marked COMMUNE_ONLY are excluded entirely, and
 * APPROXIMATE coordinates are rounded server-side to roughly a kilometre —
 * the browser never receives a precise position it should not have.
 *
 * On a fresh install this returns three empty arrays, and the map says so.
 */
export const GET = handler(async (request: NextRequest) => {
  await enforce(RATE_LIMITS.publicApi, ipOf(request));

  const [requests, campaigns, events] = await Promise.all([
    listRequestMapMarkers(),
    listCampaignMapMarkers(),
    listEventMapMarkers(),
  ]);

  return ok({ requests, campaigns, events });
});
