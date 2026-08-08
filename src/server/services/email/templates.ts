import type { Locale } from '@prisma/client';

/**
 * Transactional email templates, in the three platform languages.
 *
 * Templates render to plain text plus a minimal, inline-styled HTML body. No
 * remote images or tracking pixels: many Algerian mail clients block them and
 * they leak reading behaviour.
 */

export type TemplateKey =
  | 'welcome'
  | 'email_verification'
  | 'password_reset'
  | 'password_changed'
  | 'organization_approved'
  | 'organization_rejected'
  | 'request_approved'
  | 'request_rejected'
  | 'campaign_update'
  | 'volunteer_accepted'
  | 'volunteer_rejected'
  | 'event_reminder'
  | 'event_registration'
  | 'donation_confirmed';

type Copy = { subject: string; heading: string; body: string[]; cta?: string };

export type TemplateVars = Record<string, string>;

function interpolate(text: string, vars: TemplateVars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

const T: Record<TemplateKey, Record<Locale, Copy>> = {
  welcome: {
    FR: {
      subject: 'Bienvenue sur Sadaqa+',
      heading: 'Bienvenue, {{firstName}}',
      body: [
        'Votre compte Sadaqa+ a été créé.',
        'Sadaqa+ met en relation les personnes qui ont besoin d’aide et celles qui sont prêtes à aider, partout en Algérie.',
      ],
      cta: 'Découvrir la plateforme',
    },
    AR: {
      subject: 'مرحبًا بك في صدقة+',
      heading: 'مرحبًا {{firstName}}',
      body: [
        'تم إنشاء حسابك في صدقة+.',
        'تربط منصة صدقة+ بين المحتاجين للمساعدة والمستعدين لتقديمها، في كامل التراب الجزائري.',
      ],
      cta: 'اكتشف المنصة',
    },
    EN: {
      subject: 'Welcome to Sadaqa+',
      heading: 'Welcome, {{firstName}}',
      body: [
        'Your Sadaqa+ account has been created.',
        'Sadaqa+ connects people who need help with people and organisations ready to help, across Algeria.',
      ],
      cta: 'Explore the platform',
    },
  },

  email_verification: {
    FR: {
      subject: 'Confirmez votre adresse e-mail',
      heading: 'Confirmez votre adresse',
      body: [
        'Pour activer votre compte Sadaqa+, confirmez votre adresse e-mail.',
        'Ce lien expire dans 24 heures. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.',
      ],
      cta: 'Confirmer mon adresse',
    },
    AR: {
      subject: 'أكّد عنوان بريدك الإلكتروني',
      heading: 'تأكيد البريد الإلكتروني',
      body: [
        'لتفعيل حسابك في صدقة+، يرجى تأكيد عنوان بريدك الإلكتروني.',
        'تنتهي صلاحية هذا الرابط خلال 24 ساعة. إذا لم تكن أنت من طلب ذلك، تجاهل هذه الرسالة.',
      ],
      cta: 'تأكيد العنوان',
    },
    EN: {
      subject: 'Confirm your email address',
      heading: 'Confirm your address',
      body: [
        'To activate your Sadaqa+ account, please confirm your email address.',
        'This link expires in 24 hours. If you did not request it, ignore this message.',
      ],
      cta: 'Confirm my address',
    },
  },

  password_reset: {
    FR: {
      subject: 'Réinitialisation de votre mot de passe',
      heading: 'Réinitialiser votre mot de passe',
      body: [
        'Une réinitialisation de mot de passe a été demandée pour ce compte.',
        'Ce lien expire dans 1 heure et ne peut servir qu’une seule fois. Si vous n’êtes pas à l’origine de cette demande, aucune action n’est nécessaire.',
      ],
      cta: 'Choisir un nouveau mot de passe',
    },
    AR: {
      subject: 'إعادة تعيين كلمة المرور',
      heading: 'إعادة تعيين كلمة المرور',
      body: [
        'تم طلب إعادة تعيين كلمة المرور لهذا الحساب.',
        'تنتهي صلاحية هذا الرابط خلال ساعة واحدة ويُستعمل مرة واحدة فقط. إذا لم تطلب ذلك، لا حاجة لأي إجراء.',
      ],
      cta: 'اختيار كلمة مرور جديدة',
    },
    EN: {
      subject: 'Reset your password',
      heading: 'Reset your password',
      body: [
        'A password reset was requested for this account.',
        'This link expires in 1 hour and can only be used once. If you did not request it, no action is needed.',
      ],
      cta: 'Choose a new password',
    },
  },

  password_changed: {
    FR: {
      subject: 'Votre mot de passe a été modifié',
      heading: 'Mot de passe modifié',
      body: [
        'Le mot de passe de votre compte Sadaqa+ vient d’être modifié et toutes vos sessions ont été déconnectées.',
        'Si vous n’êtes pas à l’origine de ce changement, réinitialisez immédiatement votre mot de passe et contactez-nous.',
      ],
    },
    AR: {
      subject: 'تم تغيير كلمة المرور',
      heading: 'تم تغيير كلمة المرور',
      body: [
        'تم تغيير كلمة مرور حسابك في صدقة+ وتم إنهاء جميع الجلسات.',
        'إذا لم تقم بذلك، أعد تعيين كلمة المرور فورًا واتصل بنا.',
      ],
    },
    EN: {
      subject: 'Your password was changed',
      heading: 'Password changed',
      body: [
        'Your Sadaqa+ password was changed and all your sessions were signed out.',
        'If this was not you, reset your password immediately and contact us.',
      ],
    },
  },

  organization_approved: {
    FR: {
      subject: 'Votre association est vérifiée',
      heading: '{{organizationName}} est vérifiée',
      body: [
        'Votre demande de partenariat a été approuvée. Votre espace association est désormais actif.',
        'Vous pouvez créer des campagnes, publier des événements et proposer des missions bénévoles.',
      ],
      cta: 'Ouvrir mon espace association',
    },
    AR: {
      subject: 'تم توثيق جمعيتكم',
      heading: 'تم توثيق {{organizationName}}',
      body: [
        'تمت الموافقة على طلب الشراكة. فضاء الجمعية الخاص بكم مفعّل الآن.',
        'يمكنكم إنشاء الحملات ونشر الفعاليات واقتراح مهام تطوعية.',
      ],
      cta: 'فتح فضاء الجمعية',
    },
    EN: {
      subject: 'Your organisation is verified',
      heading: '{{organizationName}} is verified',
      body: [
        'Your partnership application has been approved. Your organisation workspace is now active.',
        'You can create campaigns, publish events and post volunteer missions.',
      ],
      cta: 'Open my organisation workspace',
    },
  },

  organization_rejected: {
    FR: {
      subject: 'Votre demande de partenariat',
      heading: 'Demande non retenue',
      body: [
        'Après examen, votre demande de partenariat n’a pas été retenue pour le moment.',
        'Motif communiqué par l’équipe : {{reason}}',
        'Vous pouvez soumettre une nouvelle demande avec des informations complémentaires.',
      ],
    },
    AR: {
      subject: 'بخصوص طلب الشراكة',
      heading: 'لم يتم قبول الطلب',
      body: [
        'بعد الدراسة، لم يتم قبول طلب الشراكة في الوقت الحالي.',
        'السبب المقدَّم من الفريق: {{reason}}',
        'يمكنكم تقديم طلب جديد مرفق بمعلومات إضافية.',
      ],
    },
    EN: {
      subject: 'About your partnership application',
      heading: 'Application not accepted',
      body: [
        'After review, your partnership application was not accepted at this time.',
        'Reason given by the team: {{reason}}',
        'You may submit a new application with additional information.',
      ],
    },
  },

  request_approved: {
    FR: {
      subject: 'Votre demande est publiée',
      heading: 'Demande vérifiée et publiée',
      body: [
        'Votre demande « {{title}} » a été vérifiée par notre équipe et est maintenant visible publiquement.',
        'Vous recevrez une notification dès qu’une personne se manifestera pour vous aider.',
      ],
      cta: 'Voir ma demande',
    },
    AR: {
      subject: 'تم نشر طلبك',
      heading: 'تم التحقق من الطلب ونشره',
      body: [
        'تم التحقق من طلبك «{{title}}» من طرف فريقنا وهو الآن ظاهر للعموم.',
        'ستصلك إشعار بمجرد أن يتقدم شخص لمساعدتك.',
      ],
      cta: 'عرض طلبي',
    },
    EN: {
      subject: 'Your request is published',
      heading: 'Request verified and published',
      body: [
        'Your request "{{title}}" has been verified by our team and is now publicly visible.',
        'You will be notified as soon as someone offers to help.',
      ],
      cta: 'View my request',
    },
  },

  request_rejected: {
    FR: {
      subject: 'Votre demande n’a pas été publiée',
      heading: 'Demande non publiée',
      body: [
        'Votre demande « {{title}} » n’a pas pu être publiée en l’état.',
        'Motif : {{reason}}',
        'Vous pouvez la corriger et la soumettre à nouveau.',
      ],
      cta: 'Modifier ma demande',
    },
    AR: {
      subject: 'لم يتم نشر طلبك',
      heading: 'الطلب غير منشور',
      body: [
        'لم يتم نشر طلبك «{{title}}» بصيغته الحالية.',
        'السبب: {{reason}}',
        'يمكنك تعديله وإعادة إرساله.',
      ],
      cta: 'تعديل طلبي',
    },
    EN: {
      subject: 'Your request was not published',
      heading: 'Request not published',
      body: [
        'Your request "{{title}}" could not be published as submitted.',
        'Reason: {{reason}}',
        'You can correct and resubmit it.',
      ],
      cta: 'Edit my request',
    },
  },

  campaign_update: {
    FR: {
      subject: 'Nouvelle mise à jour : {{campaignTitle}}',
      heading: '{{updateTitle}}',
      body: [
        'Une campagne que vous suivez vient de publier une mise à jour.',
        '{{excerpt}}',
      ],
      cta: 'Lire la mise à jour',
    },
    AR: {
      subject: 'تحديث جديد: {{campaignTitle}}',
      heading: '{{updateTitle}}',
      body: ['نشرت حملة تتابعها تحديثًا جديدًا.', '{{excerpt}}'],
      cta: 'قراءة التحديث',
    },
    EN: {
      subject: 'New update: {{campaignTitle}}',
      heading: '{{updateTitle}}',
      body: ['A campaign you follow has posted an update.', '{{excerpt}}'],
      cta: 'Read the update',
    },
  },

  volunteer_accepted: {
    FR: {
      subject: 'Votre candidature bénévole a été acceptée',
      heading: 'Candidature acceptée',
      body: [
        'Bonne nouvelle : votre candidature pour la mission « {{missionTitle}} » a été acceptée par {{organizationName}}.',
        'Rendez-vous le {{date}} à {{location}}.',
      ],
      cta: 'Voir la mission',
    },
    AR: {
      subject: 'تم قبول ترشحك للتطوع',
      heading: 'تم قبول الترشح',
      body: [
        'خبر سار: تم قبول ترشحك لمهمة «{{missionTitle}}» من طرف {{organizationName}}.',
        'الموعد يوم {{date}} في {{location}}.',
      ],
      cta: 'عرض المهمة',
    },
    EN: {
      subject: 'Your volunteer application was accepted',
      heading: 'Application accepted',
      body: [
        'Good news: your application for "{{missionTitle}}" was accepted by {{organizationName}}.',
        'See you on {{date}} at {{location}}.',
      ],
      cta: 'View the mission',
    },
  },

  volunteer_rejected: {
    FR: {
      subject: 'Votre candidature bénévole',
      heading: 'Candidature non retenue',
      body: [
        'Votre candidature pour « {{missionTitle}} » n’a pas été retenue cette fois-ci.',
        'D’autres missions sont proposées régulièrement dans votre wilaya.',
      ],
      cta: 'Voir les missions disponibles',
    },
    AR: {
      subject: 'بخصوص ترشحك للتطوع',
      heading: 'لم يتم قبول الترشح',
      body: [
        'لم يتم قبول ترشحك لمهمة «{{missionTitle}}» هذه المرة.',
        'تُقترح مهام أخرى بانتظام في ولايتك.',
      ],
      cta: 'عرض المهام المتاحة',
    },
    EN: {
      subject: 'About your volunteer application',
      heading: 'Application not selected',
      body: [
        'Your application for "{{missionTitle}}" was not selected this time.',
        'New missions are posted regularly in your wilaya.',
      ],
      cta: 'Browse available missions',
    },
  },

  event_reminder: {
    FR: {
      subject: 'Rappel : {{eventTitle}}',
      heading: 'C’est bientôt',
      body: [
        '« {{eventTitle}} » a lieu le {{date}}.',
        'Lieu : {{location}}',
        'Présentez votre code de participation à l’entrée.',
      ],
      cta: 'Voir mon inscription',
    },
    AR: {
      subject: 'تذكير: {{eventTitle}}',
      heading: 'اقترب الموعد',
      body: [
        'يقام «{{eventTitle}}» يوم {{date}}.',
        'المكان: {{location}}',
        'قدّم رمز المشاركة عند الدخول.',
      ],
      cta: 'عرض تسجيلي',
    },
    EN: {
      subject: 'Reminder: {{eventTitle}}',
      heading: 'Coming up soon',
      body: [
        '"{{eventTitle}}" takes place on {{date}}.',
        'Location: {{location}}',
        'Show your participation code at the entrance.',
      ],
      cta: 'View my registration',
    },
  },

  event_registration: {
    FR: {
      subject: 'Inscription confirmée : {{eventTitle}}',
      heading: 'Inscription confirmée',
      body: [
        'Votre inscription à « {{eventTitle}} » est confirmée.',
        'Date : {{date}} — Lieu : {{location}}',
        'Votre code de participation : {{ticketCode}}',
      ],
      cta: 'Voir mon code',
    },
    AR: {
      subject: 'تم تأكيد التسجيل: {{eventTitle}}',
      heading: 'تم تأكيد التسجيل',
      body: [
        'تم تأكيد تسجيلك في «{{eventTitle}}».',
        'التاريخ: {{date}} — المكان: {{location}}',
        'رمز المشاركة: {{ticketCode}}',
      ],
      cta: 'عرض الرمز',
    },
    EN: {
      subject: 'Registration confirmed: {{eventTitle}}',
      heading: 'Registration confirmed',
      body: [
        'Your registration for "{{eventTitle}}" is confirmed.',
        'Date: {{date}} — Location: {{location}}',
        'Your participation code: {{ticketCode}}',
      ],
      cta: 'View my code',
    },
  },

  donation_confirmed: {
    FR: {
      subject: 'Votre don est confirmé',
      heading: 'Don confirmé',
      body: [
        'Votre don a été confirmé par le prestataire de paiement.',
        'Référence : {{reference}} — Montant : {{amount}}',
        'Votre reçu est disponible dans votre espace personnel.',
      ],
      cta: 'Voir mon reçu',
    },
    AR: {
      subject: 'تم تأكيد تبرعك',
      heading: 'تم تأكيد التبرع',
      body: [
        'تم تأكيد تبرعك من طرف مزود خدمة الدفع.',
        'المرجع: {{reference}} — المبلغ: {{amount}}',
        'الوصل متاح في فضائك الشخصي.',
      ],
      cta: 'عرض الوصل',
    },
    EN: {
      subject: 'Your donation is confirmed',
      heading: 'Donation confirmed',
      body: [
        'Your donation has been confirmed by the payment provider.',
        'Reference: {{reference}} — Amount: {{amount}}',
        'Your receipt is available in your account.',
      ],
      cta: 'View my receipt',
    },
  },
};

const FOOTER: Record<Locale, string> = {
  FR: 'Sadaqa+ — Ensemble, multiplions le bien.',
  AR: 'صدقة+ — معًا نضاعف الخير.',
  EN: 'Sadaqa+ — Together, we multiply good.',
};

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

export function renderTemplate(
  key: TemplateKey,
  locale: Locale,
  vars: TemplateVars & { actionUrl?: string },
): RenderedEmail {
  const copy = T[key][locale] ?? T[key].FR;
  const subject = interpolate(copy.subject, vars);
  const heading = interpolate(copy.heading, vars);
  const paragraphs = copy.body.map((p) => interpolate(p, vars)).filter(Boolean);
  const dir = locale === 'AR' ? 'rtl' : 'ltr';
  const cta = copy.cta && vars.actionUrl ? { label: copy.cta, url: vars.actionUrl } : null;

  const text = [
    heading,
    '',
    ...paragraphs,
    ...(cta ? ['', `${cta.label}: ${cta.url}`] : []),
    '',
    '—',
    FOOTER[locale],
  ].join('\n');

  const html = `<div dir="${dir}" style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#FBF8F2;padding:32px 16px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #E4DCCB;border-radius:16px;padding:32px">
    <div style="font-size:18px;font-weight:700;color:#00795A;margin-bottom:24px">Sadaqa<span style="color:#E8A33D">+</span></div>
    <h1 style="font-size:20px;line-height:1.4;color:#05372A;margin:0 0 16px">${escapeHtml(heading)}</h1>
    ${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.7;color:#3F4F48;margin:0 0 12px">${escapeHtml(p)}</p>`).join('\n    ')}
    ${
      cta
        ? `<p style="margin:24px 0 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#00795A;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px">${escapeHtml(cta.label)}</a></p>`
        : ''
    }
    <p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #E4DCCB;font-size:13px;color:#5B6B63">${escapeHtml(FOOTER[locale])}</p>
  </div>
</div>`;

  return { subject, text, html };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
