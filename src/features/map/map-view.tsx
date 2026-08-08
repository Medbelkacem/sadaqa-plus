'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPinOff } from 'lucide-react';

import 'leaflet/dist/leaflet.css';

import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/empty-state';
import { useI18n, useLocalizedHref } from '@/i18n/context';
import { localizedName } from '@/i18n/format';
import { api } from '@/lib/api/client';

type Marker = {
  id: string;
  slug: string;
  title: string;
  latitude: number;
  longitude: number;
  category: { nameFr: string; nameAr: string; nameEn: string; color: string | null };
};

type MapPayload = {
  requests: (Marker & { urgency: string; locationPrecision: string })[];
  campaigns: Marker[];
  events: (Marker & { startsAt: string })[];
};

/** Algeria's approximate geographic centre and a zoom that frames the country. */
const ALGERIA_CENTER: [number, number] = [28.0, 2.5];
const ALGERIA_ZOOM = 5;

/**
 * Coloured pin built from an inline SVG data URI.
 * Avoids Leaflet's default marker asset, which 404s under a bundler.
 */
function pinIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
    <path d="M14 0C6.3 0 0 6.3 0 14c0 10 14 24 14 24s14-14 14-24C28 6.3 21.7 0 14 0z" fill="${color}"/>
    <circle cx="14" cy="14" r="5.2" fill="#fff"/>
  </svg>`;

  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -34],
  });
}

/** Fits the viewport to whatever markers exist, once they arrive. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  React.useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 11);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 12 });
  }, [map, points]);

  return null;
}

export function MapView() {
  const { t, locale } = useI18n();
  const href = useLocalizedHref();

  const [layers, setLayers] = React.useState({
    requests: true,
    campaigns: true,
    events: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['map'],
    queryFn: () => api.get<MapPayload>('/api/map'),
    staleTime: 60_000,
  });

  const visible = React.useMemo(() => {
    if (!data) return [] as { marker: Marker; kind: keyof MapPayload; color: string }[];

    const entries: { marker: Marker; kind: keyof MapPayload; color: string }[] = [];
    if (layers.requests) {
      for (const marker of data.requests) {
        entries.push({ marker, kind: 'requests', color: marker.category.color ?? '#DC2626' });
      }
    }
    if (layers.campaigns) {
      for (const marker of data.campaigns) {
        entries.push({ marker, kind: 'campaigns', color: marker.category.color ?? '#2563EB' });
      }
    }
    if (layers.events) {
      for (const marker of data.events) {
        entries.push({ marker, kind: 'events', color: marker.category.color ?? '#16A34A' });
      }
    }
    return entries;
  }, [data, layers]);

  const points = React.useMemo(
    () => visible.map((entry) => [entry.marker.latitude, entry.marker.longitude] as [number, number]),
    [visible],
  );

  const totalMarkers =
    (data?.requests.length ?? 0) + (data?.campaigns.length ?? 0) + (data?.events.length ?? 0);

  const pathFor = (kind: keyof MapPayload, slug: string) =>
    kind === 'requests'
      ? href(`/requests/${slug}`)
      : kind === 'campaigns'
        ? href(`/campaigns/${slug}`)
        : href(`/events/${slug}`);

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <aside className="space-y-4">
        <Card>
          <CardContent className="space-y-3 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
              {t.map.layers}
            </p>

            {(
              [
                ['requests', t.map.showRequests, data?.requests.length ?? 0],
                ['campaigns', t.map.showCampaigns, data?.campaigns.length ?? 0],
                ['events', t.map.showEvents, data?.events.length ?? 0],
              ] as const
            ).map(([key, label, count]) => (
              <label key={key} className="flex items-center gap-2.5 text-sm">
                <Checkbox
                  checked={layers[key]}
                  onCheckedChange={(checked) =>
                    setLayers((current) => ({ ...current, [key]: checked === true }))
                  }
                />
                <span className="flex-1 text-foreground">{label}</span>
                <span className="tabular-nums text-xs text-muted-fg">{count}</span>
              </label>
            ))}
          </CardContent>
        </Card>

        <p className="rounded-[var(--radius-card)] border border-border bg-surface-muted/60 p-3 text-xs leading-relaxed text-muted-fg">
          {t.map.approximateNotice}
        </p>
      </aside>

      <div className="min-h-[28rem] overflow-hidden rounded-[var(--radius-card)] border border-border">
        {isLoading ? (
          <div className="h-[32rem] animate-pulse bg-surface-sunken" aria-hidden="true" />
        ) : totalMarkers === 0 ? (
          <EmptyState
            icon={MapPinOff}
            title={t.empty.mapTitle}
            description={t.empty.mapBody}
            className="h-[32rem] rounded-none border-0"
          />
        ) : (
          <MapContainer
            center={ALGERIA_CENTER}
            zoom={ALGERIA_ZOOM}
            scrollWheelZoom
            className="h-[32rem] w-full"
            // Announced as a region so keyboard users know what they entered.
            aria-label={t.map.title}
          >
            <TileLayer
              url={
                process.env.NEXT_PUBLIC_MAP_TILE_URL ??
                'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
              }
              attribution={
                process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ?? '© OpenStreetMap contributors'
              }
              maxZoom={18}
            />

            <FitBounds points={points} />

            {visible.map(({ marker, kind, color }) => (
              <Marker
                key={`${kind}-${marker.id}`}
                position={[marker.latitude, marker.longitude]}
                icon={pinIcon(color)}
              >
                <Popup>
                  <span className="block text-xs font-medium text-muted-fg">
                    {localizedName(marker.category, locale)}
                  </span>
                  <Link
                    href={pathFor(kind, marker.slug)}
                    className="mt-1 block text-sm font-semibold underline-offset-2 hover:underline"
                  >
                    {marker.title}
                  </Link>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
