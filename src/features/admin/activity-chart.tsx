'use client';

import * as React from 'react';

import { useI18n } from '@/i18n/context';
import { formatDate } from '@/i18n/format';
import { cn } from '@/lib/utils';

export type ActivityPoint = { date: string; users: number; requests: number };

/**
 * Daily new users and new requests over the last 30 days.
 *
 * Inline SVG rather than a charting library: two series over 30 points does
 * not justify shipping a runtime, and hand-drawing the marks keeps them inside
 * the design tokens in both themes.
 *
 * Series colours are the two brand hues, validated for categorical use against
 * both surfaces (light: #16A34A / #2563EB — CVD ΔE 30.3, normal ΔE 33.3;
 * dark: #1FA84F / #4A84F5 — CVD ΔE 26.7, normal ΔE 29.2; all within the
 * lightness band and above 3:1 contrast on their surface). Identity is never
 * carried by colour alone: each series also gets a legend key, a direct label
 * at its end, and a distinct line pattern.
 */
export function ActivityChart({
  data,
  labels,
}: {
  data: ActivityPoint[];
  labels: { users: string; requests: string };
}) {
  const { locale } = useI18n();
  const [hover, setHover] = React.useState<number | null>(null);
  const [showTable, setShowTable] = React.useState(false);

  const width = 720;
  const height = 220;
  const padding = { top: 16, right: 56, bottom: 28, left: 36 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // A "nice" ceiling with a floor of 4, so a day with one signup does not
  // render as a full-height spike.
  const rawMax = Math.max(4, ...data.flatMap((point) => [point.users, point.requests]));
  const step = rawMax <= 8 ? 2 : Math.ceil(rawMax / 4 / 5) * 5;
  const yMax = Math.ceil(rawMax / step) * step;

  const x = (index: number) =>
    padding.left + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const y = (value: number) => padding.top + plotHeight - (value / yMax) * plotHeight;

  const path = (key: 'users' | 'requests') =>
    data.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point[key])}`).join(' ');

  const ticks = Array.from({ length: yMax / step + 1 }, (_, index) => index * step);

  const series = [
    { key: 'users' as const, label: labels.users, className: 'text-[#16A34A] dark:text-[#1FA84F]', dash: undefined },
    { key: 'requests' as const, label: labels.requests, className: 'text-[#2563EB] dark:text-[#4A84F5]', dash: '6 4' },
  ];

  const active = hover !== null ? data[hover] : null;

  /** Maps a pointer x to the nearest data index. */
  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const relative = ((event.clientX - rect.left) / rect.width) * width;
    const ratio = (relative - padding.left) / plotWidth;
    const index = Math.round(ratio * (data.length - 1));
    setHover(index >= 0 && index < data.length ? index : null);
  }

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex flex-wrap items-center gap-4">
        {/* Legend is always present for two series. */}
        {series.map((entry) => (
          <span key={entry.key} className="inline-flex items-center gap-2 text-xs text-muted-fg">
            <svg width="18" height="8" aria-hidden="true" className={entry.className}>
              <line
                x1="1"
                y1="4"
                x2="17"
                y2="4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={entry.dash}
              />
            </svg>
            {entry.label}
          </span>
        ))}

        <button
          type="button"
          onClick={() => setShowTable((current) => !current)}
          className="ms-auto rounded-md px-2 py-1 text-xs font-medium text-muted-fg underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={showTable}
        >
          {showTable ? '—' : '⊞'} {locale === 'ar' ? 'جدول' : locale === 'en' ? 'Table' : 'Tableau'}
        </button>
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full touch-none"
          role="img"
          aria-label={`${labels.users} / ${labels.requests}`}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
        >
          {/* Recessive hairline gridlines, solid — never dashed. */}
          <g className="text-border">
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y(tick) + 4}
                  textAnchor="end"
                  className="fill-[var(--muted-foreground)] text-[10px] tabular-nums"
                >
                  {tick}
                </text>
              </g>
            ))}
          </g>

          {/* x labels: first, middle, last only — 30 dates would collide. */}
          {[0, Math.floor(data.length / 2), data.length - 1].map((index) => (
            <text
              key={index}
              x={x(index)}
              y={height - 8}
              textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
              className="fill-[var(--muted-foreground)] text-[10px]"
            >
              {new Date(data[index].date).toLocaleDateString(
                locale === 'ar' ? 'ar-DZ-u-nu-latn' : locale === 'en' ? 'en-GB' : 'fr-DZ',
                { day: 'numeric', month: 'short' },
              )}
            </text>
          ))}

          {/* Crosshair */}
          {hover !== null ? (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padding.top}
              y2={padding.top + plotHeight}
              className="stroke-[var(--border-strong)]"
              strokeWidth="1"
            />
          ) : null}

          {series.map((entry) => (
            <g key={entry.key} className={entry.className}>
              <path
                d={path(entry.key)}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={entry.dash}
              />

              {/* End marker: r=4 with a 2px surface ring so it stays legible
                  where the two lines cross. */}
              <circle
                cx={x(data.length - 1)}
                cy={y(data[data.length - 1][entry.key])}
                r="4"
                fill="currentColor"
                className="stroke-[var(--surface)]"
                strokeWidth="2"
              />

              {/* Direct end label — two series, so both get one. */}
              <text
                x={x(data.length - 1) + 10}
                y={y(data[data.length - 1][entry.key]) + 4}
                className="fill-[var(--muted-foreground)] text-[11px] font-semibold tabular-nums"
              >
                {data[data.length - 1][entry.key]}
              </text>

              {hover !== null ? (
                <circle
                  cx={x(hover)}
                  cy={y(data[hover][entry.key])}
                  r="4.5"
                  fill="currentColor"
                  className="stroke-[var(--surface)]"
                  strokeWidth="2"
                />
              ) : null}
            </g>
          ))}
        </svg>

        {active ? (
          <div
            role="status"
            className={cn(
              'pointer-events-none absolute top-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-[var(--shadow-lifted)]',
              hover! > data.length / 2 ? 'start-2' : 'end-2',
            )}
          >
            <p className="font-medium text-foreground">{formatDate(active.date, locale)}</p>
            <p className="mt-1 text-muted-fg">
              {labels.users}: <span className="tabular-nums text-foreground">{active.users}</span>
            </p>
            <p className="text-muted-fg">
              {labels.requests}:{' '}
              <span className="tabular-nums text-foreground">{active.requests}</span>
            </p>
          </div>
        ) : null}
      </div>

      {/* Table view — the same data, never gated behind colour or hover. */}
      {showTable ? (
        <div className="scrollbar-slim mt-4 max-h-64 overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-muted">
              <tr>
                <th scope="col" className="p-2 text-start font-medium text-muted-fg">
                  Date
                </th>
                <th scope="col" className="p-2 text-end font-medium text-muted-fg">
                  {labels.users}
                </th>
                <th scope="col" className="p-2 text-end font-medium text-muted-fg">
                  {labels.requests}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((point) => (
                <tr key={point.date}>
                  <td className="p-2 text-muted-fg">{formatDate(point.date, locale)}</td>
                  <td className="p-2 text-end tabular-nums text-foreground">{point.users}</td>
                  <td className="p-2 text-end tabular-nums text-foreground">{point.requests}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </figure>
  );
}
