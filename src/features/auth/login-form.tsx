'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SESSION_QUERY_KEY } from '@/hooks/use-session';
import { useI18n, useLocalizedHref } from '@/i18n/context';
import { ApiClientError, api } from '@/lib/api/client';
import { loginSchema, type LoginInput } from '@/validations/auth';

export function LoginForm() {
  const { t } = useI18n();
  const href = useLocalizedHref();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  /**
   * Post-login destination.
   *
   * Only same-origin relative paths are honoured — an absolute URL in
   * `?next=` would turn the login page into an open redirect.
   */
  function safeNext() {
    const next = searchParams.get('next');
    if (!next || !next.startsWith('/') || next.startsWith('//')) return href('/dashboard');
    return next;
  }

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      await api.post('/api/auth/login', values);
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      router.replace(safeNext());
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.fields) {
          for (const [field, messages] of Object.entries(error.fields)) {
            if (field in values) {
              setError(field as keyof LoginInput, { message: messages[0] });
            }
          }
        }
        setFormError(error.message);
        return;
      }
      setFormError(t.errors.genericBody);
    }
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
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          dir="ltr"
          autoFocus
          {...register('email')}
        />
      </Field>

      <Field error={errors.password?.message}>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel>{t.auth.password}</FieldLabel>
          <Link
            href={href('/auth/forgot-password')}
            className="text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t.auth.forgotPassword}
          </Link>
        </div>
        <Input type="password" autoComplete="current-password" dir="ltr" {...register('password')} />
      </Field>

      <Button type="submit" block size="lg" loading={isSubmitting} loadingLabel={t.common.loading}>
        {t.nav.login}
      </Button>
    </form>
  );
}
