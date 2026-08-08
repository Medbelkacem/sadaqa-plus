'use client';

import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';

import { FileUploader, type UploadedFile } from '@/components/upload/file-uploader';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/misc';
import { useI18n } from '@/i18n/context';
import { localizedName } from '@/i18n/format';
import { ApiClientError, api } from '@/lib/api/client';
import type { WilayaOption } from '@/server/services/reference.service';
import { partnerApplicationSchema } from '@/validations/organization';
import type { z } from 'zod';

type FormValues = z.input<typeof partnerApplicationSchema>;
type SubmitValues = z.output<typeof partnerApplicationSchema>;

export function PartnerApplicationForm({ wilayas }: { wilayas: WilayaOption[] }) {
  const { t, locale } = useI18n();
  const [documents, setDocuments] = React.useState<UploadedFile[]>([]);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, SubmitValues>({
    resolver: zodResolver(partnerApplicationSchema),
  });

  // Subscription-based watch keeps this component memoizable.
  const accepted = useWatch({ control, name: 'acceptTerms' });

  async function onSubmit(values: SubmitValues) {
    setFormError(null);
    try {
      await api.post('/api/organizations/apply', {
        ...values,
        documentIds: documents.map((document) => document.id),
      });
      setSubmitted(true);
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.fields) {
          for (const [field, messages] of Object.entries(error.fields)) {
            setError(field as keyof FormValues, { message: messages[0] });
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
          <h2 className="text-xl font-semibold text-foreground">
            {t.organizations.applicationSubmitted}
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-fg">
            {t.organizations.applicationSubmittedBody}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {formError ? (
        <Alert tone="danger" role="alert">
          {formError}
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid gap-5 pt-6">
          <Field error={errors.organizationName?.message}>
            <FieldLabel>{t.organizations.legalName}</FieldLabel>
            <Input maxLength={160} {...register('organizationName')} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field error={errors.contactPersonName?.message}>
              <FieldLabel>{t.organizations.contactPerson}</FieldLabel>
              <Input maxLength={120} {...register('contactPersonName')} />
            </Field>

            <Field error={errors.wilayaId?.message}>
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
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field error={errors.contactEmail?.message}>
              <FieldLabel>{t.auth.email}</FieldLabel>
              <Input type="email" dir="ltr" {...register('contactEmail')} />
            </Field>

            <Field error={errors.contactPhone?.message}>
              <FieldLabel>{t.common.phone}</FieldLabel>
              <Input type="tel" dir="ltr" placeholder="05 55 12 34 56" {...register('contactPhone')} />
            </Field>
          </div>

          <Field error={errors.areaOfWork?.message}>
            <FieldLabel>{t.organizations.areaOfWork}</FieldLabel>
            <Input maxLength={160} {...register('areaOfWork')} />
          </Field>

          <Field error={errors.description?.message}>
            <FieldLabel>{t.requests.fields.description}</FieldLabel>
            <Textarea rows={7} maxLength={3000} {...register('description')} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field error={errors.website?.message}>
              <FieldLabel optional={t.common.optional}>{t.organizations.website}</FieldLabel>
              <Input type="url" dir="ltr" placeholder="https://" {...register('website')} />
            </Field>

            <Field error={errors.registrationNumber?.message}>
              <FieldLabel optional={t.common.optional}>
                {t.organizations.registrationNumber}
              </FieldLabel>
              <Input maxLength={80} {...register('registrationNumber')} />
            </Field>
          </div>

          <Field error={errors.socialLinks?.message}>
            <FieldLabel optional={t.common.optional}>{t.organizations.socialLinks}</FieldLabel>
            <Textarea rows={2} maxLength={600} {...register('socialLinks')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <FileUploader
            value={documents}
            onChange={setDocuments}
            max={6}
            label={t.organizations.documents}
            hint={t.organizations.documentsHint}
          />
        </CardContent>
      </Card>

      <Field error={errors.acceptTerms?.message}>
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="acceptTerms"
            checked={accepted === true}
            onCheckedChange={(checked) =>
              setValue('acceptTerms', checked === true ? true : (undefined as never), {
                shouldValidate: true,
              })
            }
            className="mt-0.5"
          />
          <label htmlFor="acceptTerms" className="text-sm leading-relaxed text-muted-fg">
            {t.auth.acceptTerms}
          </label>
        </div>
      </Field>

      <Button type="submit" size="lg" loading={isSubmitting} loadingLabel={t.common.submitting}>
        {t.common.submit}
      </Button>
    </form>
  );
}
