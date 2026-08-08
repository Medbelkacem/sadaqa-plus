'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, Save } from 'lucide-react';

import { FileUploader, type UploadedFile } from '@/components/upload/file-uploader';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/misc';
import { Stepper } from '@/components/ui/stepper';
import { useI18n, useLocalizedHref } from '@/i18n/context';
import { localizedName } from '@/i18n/format';
import { ApiClientError, api } from '@/lib/api/client';
import type { CategoryOption, WilayaOption } from '@/server/services/reference.service';
import { cn } from '@/lib/utils';
import { createRequestSchema } from '@/validations/request';

type FormValues = {
  categoryId: string;
  title: string;
  description: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  quantity?: string;
  beneficiaryCount?: number;
  wilayaId: number;
  communeId?: number;
  addressPrivate?: string;
  locationPrecision: 'EXACT' | 'APPROXIMATE' | 'COMMUNE_ONLY';
  latitude?: number;
  longitude?: number;
  contactMethod: 'PLATFORM' | 'EMAIL' | 'PHONE' | 'WHATSAPP';
  contactPhone?: string;
  contactEmail?: string;
  contactWhatsapp?: string;
  contactPublic: boolean;
  attachmentIds: string[];
  saveAsDraft: boolean;
};

type CommuneOption = { id: number; nameFr: string; nameAr: string; nameEn: string };

/** Fields validated before each step is allowed to advance. */
const STEP_FIELDS: Path<FormValues>[][] = [
  ['categoryId'],
  ['title', 'description', 'urgency', 'quantity', 'beneficiaryCount'],
  ['wilayaId', 'communeId', 'locationPrecision', 'addressPrivate'],
  ['contactMethod', 'contactPhone', 'contactEmail', 'contactWhatsapp', 'contactPublic'],
  [],
  [],
];

export function RequestWizard({
  wilayas,
  categories,
}: {
  wilayas: WilayaOption[];
  categories: CategoryOption[];
}) {
  const { t, locale } = useI18n();
  const href = useLocalizedHref();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [step, setStep] = React.useState(0);
  const [maxReached, setMaxReached] = React.useState(0);
  const [files, setFiles] = React.useState<UploadedFile[]>([]);
  // Keyed by wilaya so switching never shows the previous wilaya's communes
  // and nothing has to be cleared from an effect.
  const [communesByWilaya, setCommunesByWilaya] = React.useState<
    Record<string, CommuneOption[]>
  >({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState<{ reference: string } | null>(null);

  const stepLabels = [
    t.requests.steps.category,
    t.requests.steps.description,
    t.requests.steps.location,
    t.requests.steps.contact,
    t.requests.steps.attachments,
    t.requests.steps.review,
  ];

  const form = useForm<FormValues>({
    // The same schema the server runs. The client copy is for immediate
    // feedback only; the server re-validates from scratch.
    resolver: zodResolver(createRequestSchema) as never,
    mode: 'onBlur',
    defaultValues: {
      urgency: 'MEDIUM',
      locationPrecision: 'COMMUNE_ONLY',
      contactMethod: 'PLATFORM',
      contactPublic: false,
      attachmentIds: [],
      saveAsDraft: false,
    },
  });

  const { register, control, setValue, trigger, getValues, formState } = form;

  // `useWatch` is subscription-based, so React Compiler can memoize this
  // component; the `watch()` helper cannot be memoized safely.
  const values = useWatch({ control });
  const wilayaId = values.wilayaId;
  const contactMethod = values.contactMethod;
  const contactPublic = values.contactPublic;
  const locationPrecision = values.locationPrecision ?? 'COMMUNE_ONLY';
  const urgency = values.urgency ?? 'MEDIUM';

  const communes = wilayaId ? (communesByWilaya[String(wilayaId)] ?? []) : [];

  React.useEffect(() => {
    if (!wilayaId) return;

    let cancelled = false;
    const key = String(wilayaId);

    fetch(`/api/geo/communes?wilayaId=${wilayaId}`)
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        setCommunesByWilaya((current) => ({
          ...current,
          [key]: payload?.success ? (payload.data as CommuneOption[]) : [],
        }));
      })
      .catch(() => {
        if (!cancelled) setCommunesByWilaya((current) => ({ ...current, [key]: [] }));
      });

    return () => {
      cancelled = true;
    };
  }, [wilayaId]);

  React.useEffect(() => {
    setValue(
      'attachmentIds',
      files.map((file) => file.id),
    );
  }, [files, setValue]);

  async function goNext() {
    const fields = STEP_FIELDS[step];
    if (fields.length > 0) {
      const valid = await trigger(fields);
      if (!valid) return;
    }
    const next = Math.min(step + 1, stepLabels.length - 1);
    setStep(next);
    setMaxReached((current) => Math.max(current, next));
  }

  async function submit(asDraft: boolean) {
    setFormError(null);
    const valid = await trigger();
    if (!valid && !asDraft) {
      setFormError(t.errors.genericBody);
      return;
    }

    const payload = { ...getValues(), saveAsDraft: asDraft };

    try {
      const result = await api.post<{ reference: string; slug: string; status: string }>(
        '/api/requests',
        payload,
      );

      if (asDraft) {
        router.push(href('/dashboard/requests'));
        return;
      }
      setSubmitted({ reference: result.reference });
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.fields) {
          for (const [field, messages] of Object.entries(error.fields)) {
            form.setError(field as Path<FormValues>, { message: messages[0] });
          }
        }
        setFormError(error.message);
        return;
      }
      setFormError(t.errors.genericBody);
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <CheckCircle2 className="size-12 text-success" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-foreground">{t.requests.submitted}</h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-fg">
            {t.requests.submittedBody}
          </p>
          <p className="font-mono text-sm text-muted-fg">{submitted.reference}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button onClick={() => router.push(href('/dashboard/requests'))}>
              {t.requests.myRequests}
            </Button>
            <Button variant="secondary" onClick={() => router.push(href('/requests'))}>
              {t.requests.title}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedCategory = categories.find((c) => c.id === values.categoryId);
  const selectedWilaya = wilayas.find((w) => w.id === Number(wilayaId));
  const selectedCommune = communes.find((c) => c.id === Number(values.communeId));

  // `prefers-reduced-motion` collapses the step transition to nothing rather
  // than merely shortening it.
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="space-y-8">
      <Stepper
        steps={stepLabels}
        current={step}
        stepLabel={t.onboarding.step}
        maxReached={maxReached}
        onStepClick={(index) => setStep(index)}
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(false);
        }}
        noValidate
      >
        <Card>
          <CardContent className="pt-6">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={{ opacity: 0, x: reduceMotion ? 0 : 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: reduceMotion ? 0 : -12 }}
                transition={transition}
              >
                {/* --- Step 1: category ----------------------------------- */}
                {step === 0 ? (
                  <fieldset className="space-y-4">
                    <legend className="text-base font-semibold text-foreground">
                      {t.requests.steps.category}
                    </legend>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {categories.map((category) => {
                        const selected = values.categoryId === category.id;
                        return (
                          <label
                            key={category.id}
                            className={cn(
                              'flex cursor-pointer items-center gap-3 rounded-[var(--radius-field)] border p-3.5 text-sm transition-colors',
                              selected
                                ? 'border-primary bg-primary-soft'
                                : 'border-border hover:border-border-strong hover:bg-surface-muted',
                            )}
                          >
                            <input
                              type="radio"
                              value={category.id}
                              className="size-4 accent-[var(--primary)]"
                              {...register('categoryId')}
                            />
                            <span className="font-medium text-foreground">
                              {localizedName(category, locale)}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {formState.errors.categoryId ? (
                      <p className="text-xs font-medium text-danger" role="alert">
                        {formState.errors.categoryId.message}
                      </p>
                    ) : null}
                  </fieldset>
                ) : null}

                {/* --- Step 2: description -------------------------------- */}
                {step === 1 ? (
                  <div className="space-y-5">
                    <Field
                      error={formState.errors.title?.message}
                      hint={t.requests.fields.titleHint}
                    >
                      <FieldLabel>{t.requests.fields.title}</FieldLabel>
                      <Input maxLength={140} {...register('title')} />
                    </Field>

                    <Field
                      error={formState.errors.description?.message}
                      hint={t.requests.fields.descriptionHint}
                    >
                      <FieldLabel>{t.requests.fields.description}</FieldLabel>
                      <Textarea rows={8} maxLength={5000} {...register('description')} />
                    </Field>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        error={formState.errors.urgency?.message}
                        hint={t.requests.fields.urgencyHint}
                      >
                        <FieldLabel>{t.requests.urgency}</FieldLabel>
                        <Select {...register('urgency')}>
                          {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((level) => (
                            <option key={level} value={level}>
                              {t.requests.urgencyLevels[level]}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field
                        error={formState.errors.beneficiaryCount?.message}
                        hint={t.requests.beneficiaries}
                      >
                        <FieldLabel optional={t.common.optional}>
                          {t.requests.beneficiaries}
                        </FieldLabel>
                        <Input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          {...register('beneficiaryCount', { valueAsNumber: true })}
                        />
                      </Field>
                    </div>

                    <Field
                      error={formState.errors.quantity?.message}
                      hint={t.requests.fields.quantityHint}
                    >
                      <FieldLabel optional={t.common.optional}>{t.requests.quantity}</FieldLabel>
                      <Input maxLength={120} {...register('quantity')} />
                    </Field>
                  </div>
                ) : null}

                {/* --- Step 3: location ----------------------------------- */}
                {step === 2 ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field error={formState.errors.wilayaId?.message}>
                        <FieldLabel>{t.requests.wilaya}</FieldLabel>
                        <Select {...register('wilayaId', { valueAsNumber: true })}>
                          <option value="">{t.common.selectPlaceholder}</option>
                          {wilayas.map((wilaya) => (
                            <option key={wilaya.id} value={wilaya.id}>
                              {wilaya.code} — {localizedName(wilaya, locale)}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field error={formState.errors.communeId?.message}>
                        <FieldLabel optional={t.common.optional}>{t.requests.commune}</FieldLabel>
                        <Select
                          disabled={!wilayaId || communes.length === 0}
                          {...register('communeId', { valueAsNumber: true })}
                        >
                          <option value="">{t.common.selectPlaceholder}</option>
                          {communes.map((commune) => (
                            <option key={commune.id} value={commune.id}>
                              {localizedName(commune, locale)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>

                    <Field error={formState.errors.locationPrecision?.message}>
                      <FieldLabel>{t.requests.fields.locationPrecision}</FieldLabel>
                      <Select {...register('locationPrecision')}>
                        {(['COMMUNE_ONLY', 'APPROXIMATE', 'EXACT'] as const).map((precision) => (
                          <option key={precision} value={precision}>
                            {t.requests.precision[precision]}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field
                      error={formState.errors.addressPrivate?.message}
                      hint={t.requests.fields.addressPrivateHint}
                    >
                      <FieldLabel optional={t.common.optional}>
                        {t.requests.fields.addressPrivate}
                      </FieldLabel>
                      <Input maxLength={300} {...register('addressPrivate')} />
                    </Field>

                    {locationPrecision === 'EXACT' ? (
                      <Alert tone="warning">{t.map.approximateNotice}</Alert>
                    ) : null}
                  </div>
                ) : null}

                {/* --- Step 4: contact ------------------------------------ */}
                {step === 3 ? (
                  <div className="space-y-5">
                    <Field error={formState.errors.contactMethod?.message}>
                      <FieldLabel>{t.requests.fields.contactMethod}</FieldLabel>
                      <Select {...register('contactMethod')}>
                        <option value="PLATFORM">{t.requests.contactViaPlatform}</option>
                        <option value="PHONE">{t.common.phone}</option>
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="EMAIL">{t.auth.email}</option>
                      </Select>
                    </Field>

                    {contactMethod === 'PHONE' ? (
                      <Field error={formState.errors.contactPhone?.message}>
                        <FieldLabel>{t.common.phone}</FieldLabel>
                        <Input
                          type="tel"
                          inputMode="tel"
                          dir="ltr"
                          placeholder="05 55 12 34 56"
                          {...register('contactPhone')}
                        />
                      </Field>
                    ) : null}

                    {contactMethod === 'WHATSAPP' ? (
                      <Field error={formState.errors.contactWhatsapp?.message}>
                        <FieldLabel>WhatsApp</FieldLabel>
                        <Input
                          type="tel"
                          inputMode="tel"
                          dir="ltr"
                          placeholder="05 55 12 34 56"
                          {...register('contactWhatsapp')}
                        />
                      </Field>
                    ) : null}

                    {contactMethod === 'EMAIL' ? (
                      <Field error={formState.errors.contactEmail?.message}>
                        <FieldLabel>{t.auth.email}</FieldLabel>
                        <Input type="email" dir="ltr" {...register('contactEmail')} />
                      </Field>
                    ) : null}

                    <div className="rounded-[var(--radius-card)] border border-border bg-surface-muted/60 p-4">
                      <div className="flex items-start gap-2.5">
                        <Checkbox
                          id="contactPublic"
                          checked={contactPublic}
                          onCheckedChange={(checked) =>
                            setValue('contactPublic', checked === true)
                          }
                          className="mt-0.5"
                        />
                        <label htmlFor="contactPublic" className="text-sm text-foreground">
                          {t.requests.fields.contactPublic}
                          <span className="mt-1 block text-xs leading-relaxed text-muted-fg">
                            {t.requests.fields.contactPublicHint}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* --- Step 5: attachments -------------------------------- */}
                {step === 4 ? (
                  <div className="space-y-4">
                    <FileUploader
                      value={files}
                      onChange={setFiles}
                      max={6}
                      label={t.requests.steps.attachments}
                      hint={t.requests.fields.attachmentsHint}
                    />
                    <Alert tone="info" icon={Lock}>
                      {t.profile.privacyHint}
                    </Alert>
                  </div>
                ) : null}

                {/* --- Step 6: review ------------------------------------- */}
                {step === 5 ? (
                  <div className="space-y-5">
                    <h2 className="text-base font-semibold text-foreground">
                      {t.requests.steps.review}
                    </h2>

                    <dl className="divide-y divide-border rounded-[var(--radius-card)] border border-border">
                      <ReviewRow label={t.requests.category}>
                        {selectedCategory ? localizedName(selectedCategory, locale) : '—'}
                      </ReviewRow>
                      <ReviewRow label={t.requests.fields.title}>{values.title || '—'}</ReviewRow>
                      <ReviewRow label={t.requests.fields.description}>
                        <span className="line-clamp-4 whitespace-pre-line">
                          {values.description || '—'}
                        </span>
                      </ReviewRow>
                      <ReviewRow label={t.requests.urgency}>
                        {t.requests.urgencyLevels[urgency]}
                      </ReviewRow>
                      {values.quantity ? (
                        <ReviewRow label={t.requests.quantity}>{values.quantity}</ReviewRow>
                      ) : null}
                      <ReviewRow label={t.requests.location}>
                        {[
                          selectedCommune ? localizedName(selectedCommune, locale) : null,
                          selectedWilaya ? localizedName(selectedWilaya, locale) : null,
                        ]
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </ReviewRow>
                      <ReviewRow label={t.requests.fields.locationPrecision}>
                        {t.requests.precision[locationPrecision]}
                      </ReviewRow>
                      <ReviewRow label={t.requests.fields.contactMethod}>
                        {contactMethod}
                        {contactPublic ? '' : ` · ${t.requests.contactHidden}`}
                      </ReviewRow>
                      <ReviewRow label={t.requests.steps.attachments}>
                        {files.length > 0
                          ? files.map((file) => file.originalName).join(', ')
                          : t.common.none}
                      </ReviewRow>
                    </dl>

                    <Alert tone="info">{t.requests.submittedBody}</Alert>

                    {formError ? (
                      <Alert tone="danger" role="alert">
                        {formError}
                      </Alert>
                    ) : null}
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
          >
            <ArrowLeft className="rtl:rotate-180" aria-hidden="true" />
            {t.common.previous}
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              loading={formState.isSubmitting}
              onClick={() => void submit(true)}
            >
              <Save aria-hidden="true" />
              {t.common.draft}
            </Button>

            {step < stepLabels.length - 1 ? (
              <Button type="button" onClick={() => void goNext()}>
                {t.common.next}
                <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
              </Button>
            ) : (
              <Button type="submit" loading={formState.isSubmitting} size="lg">
                {t.common.submit}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 p-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}
