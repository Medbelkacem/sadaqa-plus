'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useI18n, useLocalizedHref } from '@/i18n/context';
import { ApiClientError, api } from '@/lib/api/client';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from '@/validations/auth';

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const [sent, setSent] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    setFormError(null);
    try {
      await api.post('/api/auth/forgot-password', values);
      setSent(true);
    } catch (error) {
      // A rate-limit response is worth surfacing; everything else resolves to
      // the same neutral confirmation so account existence stays hidden.
      if (error instanceof ApiClientError && error.code === 'RATE_LIMITED') {
        setFormError(t.errors.rateLimited);
        return;
      }
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div
          className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary-soft-fg"
          aria-hidden="true"
        >
          <MailCheck className="size-6" />
        </div>
        <p className="text-sm leading-relaxed text-muted-fg">
          {t.auth.forgotPasswordSubtitle}
        </p>
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

      <Field error={errors.email?.message}>
        <FieldLabel>{t.auth.email}</FieldLabel>
        <Input type="email" autoComplete="email" dir="ltr" autoFocus {...register('email')} />
      </Field>

      <Button type="submit" block size="lg" loading={isSubmitting} loadingLabel={t.common.loading}>
        {t.auth.sendResetLink}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const { t } = useI18n();
  const href = useLocalizedHref();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  async function onSubmit(values: ResetPasswordInput) {
    setFormError(null);
    try {
      await api.post('/api/auth/reset-password', { ...values, token });
      router.replace(`${href('/auth/login')}?reset=1`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.fields) {
          for (const [field, messages] of Object.entries(error.fields)) {
            setError(field as keyof ResetPasswordInput, { message: messages[0] });
          }
        }
        setFormError(error.message);
        return;
      }
      setFormError(t.errors.genericBody);
    }
  }

  if (!token) {
    return (
      <Alert tone="danger" role="alert">
        {t.auth.verifyEmailFailed}
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError ? (
        <Alert tone="danger" role="alert">
          {formError}
        </Alert>
      ) : null}

      <input type="hidden" {...register('token')} value={token} readOnly />

      <Field error={errors.password?.message} hint={t.auth.passwordHint}>
        <FieldLabel>{t.auth.newPassword}</FieldLabel>
        <Input
          type="password"
          autoComplete="new-password"
          dir="ltr"
          autoFocus
          {...register('password')}
        />
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

      <Button type="submit" block size="lg" loading={isSubmitting} loadingLabel={t.common.loading}>
        {t.common.confirm}
      </Button>
    </form>
  );
}
