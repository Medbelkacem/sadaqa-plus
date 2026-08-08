'use client';

import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/misc';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n/context';
import { toDbLocale } from '@/i18n/config';
import { ApiClientError, api } from '@/lib/api/client';
import {
  registerSchema,
  type RegisterFormValues,
  type RegisterInput,
} from '@/validations/auth';

export function RegisterForm() {
  const { t, locale } = useI18n();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues, unknown, RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { locale: toDbLocale(locale) },
  });

  // `useWatch` is subscription-based, so React Compiler can memoize this
  // component; the `watch()` helper cannot be memoized safely.
  const acceptTerms = useWatch({ control, name: 'acceptTerms' });

  async function onSubmit(values: RegisterInput) {
    setFormError(null);
    try {
      await api.post('/api/auth/register', { ...values, locale: toDbLocale(locale) });
      setSubmitted(true);
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.fields) {
          for (const [field, messages] of Object.entries(error.fields)) {
            setError(field as keyof RegisterFormValues, { message: messages[0] });
          }
        }
        setFormError(error.message);
        return;
      }
      setFormError(t.errors.genericBody);
    }
  }

  // The confirmation screen is identical whether or not the address was
  // already registered, so it cannot be used to enumerate accounts.
  if (submitted) {
    return (
      <div className="space-y-4 text-center">
        <div
          className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary-soft-fg"
          aria-hidden="true"
        >
          <MailCheck className="size-6" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">{t.auth.verifyEmailTitle}</h2>
        <p className="text-sm leading-relaxed text-muted-fg">{t.auth.verifyEmailPending}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError ? (
        <Alert tone="danger" role="alert">
          {formError}
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field error={errors.firstName?.message}>
          <FieldLabel>{t.auth.firstName}</FieldLabel>
          <Input autoComplete="given-name" autoFocus {...register('firstName')} />
        </Field>
        <Field error={errors.lastName?.message}>
          <FieldLabel>{t.auth.lastName}</FieldLabel>
          <Input autoComplete="family-name" {...register('lastName')} />
        </Field>
      </div>

      <Field error={errors.email?.message}>
        <FieldLabel>{t.auth.email}</FieldLabel>
        <Input type="email" autoComplete="email" inputMode="email" dir="ltr" {...register('email')} />
      </Field>

      <Field error={errors.password?.message} hint={t.auth.passwordHint}>
        <FieldLabel>{t.auth.password}</FieldLabel>
        <Input type="password" autoComplete="new-password" dir="ltr" {...register('password')} />
      </Field>

      <Field error={errors.confirmPassword?.message}>
        <FieldLabel>{t.auth.confirmPassword}</FieldLabel>
        <Input
          type="password"
          autoComplete="new-password"
          dir="ltr"
          {...register('confirmPassword')}
        />
      </Field>

      <Field error={errors.acceptTerms?.message}>
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="acceptTerms"
            checked={acceptTerms === true}
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

      <Button type="submit" block size="lg" loading={isSubmitting} loadingLabel={t.common.loading}>
        {t.nav.register}
      </Button>
    </form>
  );
}
