'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/misc';
import { useI18n } from '@/i18n/context';
import { ApiClientError, api } from '@/lib/api/client';
import { formatDateTime } from '@/i18n/format';

type Setting = {
  key: string;
  value: unknown;
  description: string | null;
  updatedAt: string;
};

/**
 * System settings editor.
 *
 * The control is chosen from the *current* value's type: booleans get a
 * switch, numbers a number input, everything else a JSON textarea validated
 * before submit. That keeps a new setting usable without a UI change, while
 * preventing an accidental type change from a stray keystroke.
 */
export function SettingsEditor({ settings }: { settings: Setting[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [drafts, setDrafts] = React.useState<Record<string, unknown>>(() =>
    Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
  );
  const [jsonErrors, setJsonErrors] = React.useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      api.put('/api/admin/settings', { key, value }),
    onSuccess: () => {
      toast.success(t.common.saved);
      router.refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : t.errors.genericBody),
  });

  return (
    <ul className="space-y-4">
      {settings.map((setting) => {
        const draft = drafts[setting.key];
        const original = setting.value;
        const dirty = JSON.stringify(draft) !== JSON.stringify(original);

        return (
          <li key={setting.key}>
            <Card>
              <CardContent className="space-y-3 pt-5">
                <div>
                  <p className="font-mono text-sm font-medium text-foreground">{setting.key}</p>
                  {setting.description ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted-fg">
                      {setting.description}
                    </p>
                  ) : null}
                </div>

                {typeof original === 'boolean' ? (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-foreground">
                      {draft ? t.common.yes : t.common.no}
                    </span>
                    <Switch
                      checked={Boolean(draft)}
                      onCheckedChange={(checked) =>
                        setDrafts((current) => ({ ...current, [setting.key]: checked }))
                      }
                    />
                  </div>
                ) : typeof original === 'number' ? (
                  <Field>
                    <FieldLabel>{t.common.edit}</FieldLabel>
                    <Input
                      type="number"
                      value={String(draft ?? '')}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [setting.key]: Number(event.target.value),
                        }))
                      }
                    />
                  </Field>
                ) : typeof original === 'string' ? (
                  <Field>
                    <FieldLabel>{t.common.edit}</FieldLabel>
                    <Input
                      value={String(draft ?? '')}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [setting.key]: event.target.value }))
                      }
                    />
                  </Field>
                ) : (
                  <Field error={jsonErrors[setting.key]}>
                    <FieldLabel>JSON</FieldLabel>
                    <Textarea
                      rows={3}
                      className="font-mono text-xs"
                      defaultValue={JSON.stringify(original, null, 2)}
                      onChange={(event) => {
                        try {
                          const parsed = JSON.parse(event.target.value) as unknown;
                          setDrafts((current) => ({ ...current, [setting.key]: parsed }));
                          setJsonErrors((current) => {
                            const next = { ...current };
                            delete next[setting.key];
                            return next;
                          });
                        } catch {
                          setJsonErrors((current) => ({
                            ...current,
                            [setting.key]: 'JSON invalide.',
                          }));
                        }
                      }}
                    />
                  </Field>
                )}

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-fg">
                    {t.common.updated} {formatDateTime(setting.updatedAt, locale)}
                  </p>
                  <Button
                    size="sm"
                    disabled={!dirty || Boolean(jsonErrors[setting.key])}
                    loading={save.isPending && save.variables?.key === setting.key}
                    onClick={() => save.mutate({ key: setting.key, value: draft })}
                  >
                    {t.common.save}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
