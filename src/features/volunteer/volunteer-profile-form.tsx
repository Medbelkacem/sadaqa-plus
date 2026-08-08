'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Checkbox, Switch } from '@/components/ui/misc';
import { useI18n } from '@/i18n/context';
import { localizedName } from '@/i18n/format';
import { ApiClientError, api } from '@/lib/api/client';
import type { WilayaOption } from '@/server/services/reference.service';

const AVAILABILITY = [
  'WEEKDAY_MORNING',
  'WEEKDAY_AFTERNOON',
  'WEEKDAY_EVENING',
  'WEEKEND',
  'ON_CALL',
] as const;

const AVAILABILITY_LABELS: Record<(typeof AVAILABILITY)[number], string> = {
  WEEKDAY_MORNING: 'Semaine — matin',
  WEEKDAY_AFTERNOON: 'Semaine — après-midi',
  WEEKDAY_EVENING: 'Semaine — soir',
  WEEKEND: 'Week-end',
  ON_CALL: 'Sur appel / urgence',
};

const LANGUAGES = [
  { value: 'ar', label: 'العربية' },
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'ber', label: 'Tamazight' },
  { value: 'other', label: 'Autre' },
] as const;

type ExistingProfile = {
  skills: string[];
  languages: string[];
  availability: string[];
  hasTransport: boolean;
  experience: string | null;
  preferredActivities: string[];
  wilayaId: number | null;
  communeId: number | null;
  isSearchable: boolean;
  totalHours: unknown;
} | null;

/**
 * Volunteer profile editor.
 *
 * Collects only what an organisation needs to assign a mission. Skills and
 * activities are free text entered as a comma-separated list rather than a
 * fixed taxonomy, because real volunteer skills do not fit one.
 */
export function VolunteerProfileForm({
  wilayas,
  profile,
}: {
  wilayas: WilayaOption[];
  profile: ExistingProfile;
}) {
  const { t, locale } = useI18n();

  const [skills, setSkills] = React.useState((profile?.skills ?? []).join(', '));
  const [activities, setActivities] = React.useState(
    (profile?.preferredActivities ?? []).join(', '),
  );
  const [languages, setLanguages] = React.useState<string[]>(profile?.languages ?? ['ar', 'fr']);
  const [availability, setAvailability] = React.useState<string[]>(profile?.availability ?? []);
  const [hasTransport, setHasTransport] = React.useState(profile?.hasTransport ?? false);
  const [experience, setExperience] = React.useState(profile?.experience ?? '');
  const [wilayaId, setWilayaId] = React.useState(profile?.wilayaId?.toString() ?? '');
  const [isSearchable, setIsSearchable] = React.useState(profile?.isSearchable ?? true);
  const [error, setError] = React.useState<string | null>(null);

  const toList = (value: string) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 20);

  const save = useMutation({
    mutationFn: () =>
      api.put('/api/volunteers/profile', {
        skills: toList(skills),
        preferredActivities: toList(activities),
        languages,
        availability,
        hasTransport,
        experience: experience.trim() || undefined,
        wilayaId: wilayaId ? Number(wilayaId) : undefined,
        isSearchable,
      }),
    onSuccess: () => toast.success(t.common.saved),
    onError: (mutationError) =>
      setError(
        mutationError instanceof ApiClientError ? mutationError.message : t.errors.genericBody,
      ),
  });

  function toggle(list: string[], value: string, setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        save.mutate();
      }}
      className="space-y-6"
    >
      {error ? (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid gap-5 pt-6">
          <Field hint="Séparez par des virgules.">
            <FieldLabel>{t.volunteer.skills}</FieldLabel>
            <Input
              value={skills}
              onChange={(event) => setSkills(event.target.value)}
              placeholder="Logistique, conduite, secourisme"
            />
          </Field>

          <Field hint="Séparez par des virgules.">
            <FieldLabel>{t.volunteer.preferredActivities}</FieldLabel>
            <Input
              value={activities}
              onChange={(event) => setActivities(event.target.value)}
              placeholder="Distribution, soutien scolaire"
            />
          </Field>

          <fieldset>
            <legend className="text-sm font-medium text-foreground">
              {t.volunteer.languages}
            </legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {LANGUAGES.map((language) => (
                <label key={language.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={languages.includes(language.value)}
                    onCheckedChange={() => toggle(languages, language.value, setLanguages)}
                  />
                  {language.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-foreground">
              {t.volunteer.availability}
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {AVAILABILITY.map((slot) => (
                <label key={slot} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={availability.includes(slot)}
                    onCheckedChange={() => toggle(availability, slot, setAvailability)}
                  />
                  {AVAILABILITY_LABELS[slot]}
                </label>
              ))}
            </div>
          </fieldset>

          <Field>
            <FieldLabel>{t.requests.wilaya}</FieldLabel>
            <Select value={wilayaId} onChange={(event) => setWilayaId(event.target.value)}>
              <option value="">{t.common.selectPlaceholder}</option>
              {wilayas.map((wilaya) => (
                <option key={wilaya.id} value={wilaya.id}>
                  {wilaya.code} — {localizedName(wilaya, locale)}
                </option>
              ))}
            </Select>
          </Field>

          <Field>
            <FieldLabel optional={t.common.optional}>{t.volunteer.experience}</FieldLabel>
            <Textarea
              rows={4}
              maxLength={2000}
              value={experience}
              onChange={(event) => setExperience(event.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="hasTransport" className="text-sm text-foreground">
              {t.volunteer.hasTransport}
            </label>
            <Switch id="hasTransport" checked={hasTransport} onCheckedChange={setHasTransport} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <label htmlFor="isSearchable" className="text-sm text-foreground">
              {t.volunteer.searchable}
              <span className="mt-1 block text-xs text-muted-fg">{t.profile.privacyHint}</span>
            </label>
            <Switch id="isSearchable" checked={isSearchable} onCheckedChange={setIsSearchable} />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" loading={save.isPending} loadingLabel={t.common.saving}>
        {t.common.save}
      </Button>
    </form>
  );
}
