import { CheckCircle2, MinusCircle } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

type Status = {
  redis: boolean;
  objectStorage: boolean;
  email: boolean;
  push: boolean;
  payments: boolean;
  ai: boolean;
  malwareScanner: boolean;
};

const NOTES: Record<keyof Status, string> = {
  redis: 'Limitation de débit distribuée. Sans Redis, la limite est par instance.',
  objectStorage:
    'Stockage objet durable (Vercel Blob ou S3). Sans lui, les fichiers sont écrits sur le disque local de l’instance — ce qui est éphémère en serverless.',
  email: 'Envoi SMTP réel. Sans lui, les e-mails sont écrits dans le journal serveur.',
  push: 'Notifications push (clés VAPID).',
  payments: 'Paiement en ligne. Sans prestataire, aucun don ne peut être encaissé.',
  ai: 'Assistance IA à la modération. Aucune décision automatique n’est prise.',
  malwareScanner: 'Analyse antivirus des fichiers téléversés.',
};

const LABELS: Record<keyof Status, string> = {
  redis: 'Redis',
  objectStorage: 'Stockage objet durable',
  email: 'E-mail (SMTP)',
  push: 'Notifications push',
  payments: 'Paiement en ligne',
  ai: 'Assistance IA',
  malwareScanner: 'Analyse antivirus',
};

/**
 * Which external services this deployment actually has.
 *
 * This panel is the platform being honest with its own operators: anything
 * unconfigured is shown as unconfigured, with the consequence spelled out,
 * rather than being quietly absent.
 */
export function IntegrationStatusPanel({
  status,
  labels,
}: {
  status: Status;
  labels: { configured: string; notConfigured: string };
}) {
  const entries = Object.entries(status) as [keyof Status, boolean][];

  return (
    <Card>
      <CardContent className="pt-5">
        <ul className="divide-y divide-border">
          {entries.map(([key, configured]) => (
            <li key={key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              {configured ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <MinusCircle className="mt-0.5 size-4 shrink-0 text-muted-fg" aria-hidden="true" />
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{LABELS[key]}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-fg">{NOTES[key]}</p>
              </div>

              <span
                className={
                  configured
                    ? 'shrink-0 text-xs font-semibold text-success'
                    : 'shrink-0 text-xs font-medium text-muted-fg'
                }
              >
                {configured ? labels.configured : labels.notConfigured}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
