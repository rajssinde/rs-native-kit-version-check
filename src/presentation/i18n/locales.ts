import type { LocaleCode, LocaleStrings } from './types';

const en: LocaleStrings = {
  forceUpdate: {
    title: 'Update Required',
    message: (v) => `Version ${v} is available. You must update to continue.`,
    updateButtonLabel: 'Update Now',
  },
  softUpdate: {
    title: 'Update Available',
    message: (v, notes) =>
      `Version ${v} is available.${notes ? ` ${notes}` : ''}`,
    updateButtonLabel: 'Update',
    laterButtonLabel: 'Later',
  },
  optionalBanner: {
    message: (v) => `Version ${v} is available.`,
    updateButtonLabel: 'Update',
  },
};

const es: LocaleStrings = {
  forceUpdate: {
    title: 'Actualización requerida',
    message: (v) =>
      `La versión ${v} está disponible. Debes actualizar para continuar.`,
    updateButtonLabel: 'Actualizar ahora',
  },
  softUpdate: {
    title: 'Actualización disponible',
    message: (v, notes) =>
      `La versión ${v} está disponible.${notes ? ` ${notes}` : ''}`,
    updateButtonLabel: 'Actualizar',
    laterButtonLabel: 'Más tarde',
  },
  optionalBanner: {
    message: (v) => `La versión ${v} está disponible.`,
    updateButtonLabel: 'Actualizar',
  },
};

const fr: LocaleStrings = {
  forceUpdate: {
    title: 'Mise à jour requise',
    message: (v) =>
      `La version ${v} est disponible. Vous devez effectuer la mise à jour pour continuer.`,
    updateButtonLabel: 'Mettre à jour',
  },
  softUpdate: {
    title: 'Mise à jour disponible',
    message: (v, notes) =>
      `La version ${v} est disponible.${notes ? ` ${notes}` : ''}`,
    updateButtonLabel: 'Mettre à jour',
    laterButtonLabel: 'Plus tard',
  },
  optionalBanner: {
    message: (v) => `La version ${v} est disponible.`,
    updateButtonLabel: 'Mettre à jour',
  },
};

const de: LocaleStrings = {
  forceUpdate: {
    title: 'Update erforderlich',
    message: (v) =>
      `Version ${v} ist verfügbar. Du musst aktualisieren, um fortzufahren.`,
    updateButtonLabel: 'Jetzt aktualisieren',
  },
  softUpdate: {
    title: 'Update verfügbar',
    message: (v, notes) =>
      `Version ${v} ist verfügbar.${notes ? ` ${notes}` : ''}`,
    updateButtonLabel: 'Aktualisieren',
    laterButtonLabel: 'Später',
  },
  optionalBanner: {
    message: (v) => `Version ${v} ist verfügbar.`,
    updateButtonLabel: 'Aktualisieren',
  },
};

const it: LocaleStrings = {
  forceUpdate: {
    title: 'Aggiornamento richiesto',
    message: (v) =>
      `La versione ${v} è disponibile. Devi aggiornare per continuare.`,
    updateButtonLabel: 'Aggiorna ora',
  },
  softUpdate: {
    title: 'Aggiornamento disponibile',
    message: (v, notes) =>
      `La versione ${v} è disponibile.${notes ? ` ${notes}` : ''}`,
    updateButtonLabel: 'Aggiorna',
    laterButtonLabel: 'Più tardi',
  },
  optionalBanner: {
    message: (v) => `La versione ${v} è disponibile.`,
    updateButtonLabel: 'Aggiorna',
  },
};

const pt: LocaleStrings = {
  forceUpdate: {
    title: 'Atualização necessária',
    message: (v) =>
      `A versão ${v} está disponível. Você precisa atualizar para continuar.`,
    updateButtonLabel: 'Atualizar agora',
  },
  softUpdate: {
    title: 'Atualização disponível',
    message: (v, notes) =>
      `A versão ${v} está disponível.${notes ? ` ${notes}` : ''}`,
    updateButtonLabel: 'Atualizar',
    laterButtonLabel: 'Mais tarde',
  },
  optionalBanner: {
    message: (v) => `A versão ${v} está disponível.`,
    updateButtonLabel: 'Atualizar',
  },
};

const ja: LocaleStrings = {
  forceUpdate: {
    title: '更新が必要です',
    message: (v) =>
      `バージョン${v}が利用可能です。続行するには更新してください。`,
    updateButtonLabel: '今すぐ更新',
  },
  softUpdate: {
    title: 'アップデートが利用可能です',
    message: (v, notes) => `バージョン${v}が利用可能です。${notes ?? ''}`,
    updateButtonLabel: '更新',
    laterButtonLabel: '後で',
  },
  optionalBanner: {
    message: (v) => `バージョン${v}が利用可能です。`,
    updateButtonLabel: '更新',
  },
};

const zh: LocaleStrings = {
  forceUpdate: {
    title: '需要更新',
    message: (v) => `新版本 ${v} 已发布，请更新后继续使用。`,
    updateButtonLabel: '立即更新',
  },
  softUpdate: {
    title: '有可用更新',
    message: (v, notes) => `新版本 ${v} 已发布。${notes ?? ''}`,
    updateButtonLabel: '更新',
    laterButtonLabel: '以后再说',
  },
  optionalBanner: {
    message: (v) => `新版本 ${v} 已发布。`,
    updateButtonLabel: '更新',
  },
};

const ko: LocaleStrings = {
  forceUpdate: {
    title: '업데이트 필요',
    message: (v) =>
      `버전 ${v}을(를) 사용할 수 있습니다. 계속하려면 업데이트해야 합니다.`,
    updateButtonLabel: '지금 업데이트',
  },
  softUpdate: {
    title: '업데이트 사용 가능',
    message: (v, notes) =>
      `버전 ${v}을(를) 사용할 수 있습니다.${notes ? ` ${notes}` : ''}`,
    updateButtonLabel: '업데이트',
    laterButtonLabel: '나중에',
  },
  optionalBanner: {
    message: (v) => `버전 ${v}을(를) 사용할 수 있습니다.`,
    updateButtonLabel: '업데이트',
  },
};

const hi: LocaleStrings = {
  forceUpdate: {
    title: 'अपडेट आवश्यक है',
    message: (v) =>
      `संस्करण ${v} उपलब्ध है। जारी रखने के लिए आपको अपडेट करना होगा।`,
    updateButtonLabel: 'अभी अपडेट करें',
  },
  softUpdate: {
    title: 'अपडेट उपलब्ध है',
    message: (v, notes) => `संस्करण ${v} उपलब्ध है।${notes ? ` ${notes}` : ''}`,
    updateButtonLabel: 'अपडेट करें',
    laterButtonLabel: 'बाद में',
  },
  optionalBanner: {
    message: (v) => `संस्करण ${v} उपलब्ध है।`,
    updateButtonLabel: 'अपडेट करें',
  },
};

/** Text only — this library doesn't flip flexDirection/textAlign for RTL layout, see README. */
const ar: LocaleStrings = {
  forceUpdate: {
    title: 'التحديث مطلوب',
    message: (v) => `الإصدار ${v} متاح. يجب عليك التحديث للمتابعة.`,
    updateButtonLabel: 'تحديث الآن',
  },
  softUpdate: {
    title: 'التحديث متاح',
    message: (v, notes) => `الإصدار ${v} متاح.${notes ? ` ${notes}` : ''}`,
    updateButtonLabel: 'تحديث',
    laterButtonLabel: 'لاحقًا',
  },
  optionalBanner: {
    message: (v) => `الإصدار ${v} متاح.`,
    updateButtonLabel: 'تحديث',
  },
};

const ru: LocaleStrings = {
  forceUpdate: {
    title: 'Требуется обновление',
    message: (v) =>
      `Доступна версия ${v}. Чтобы продолжить, необходимо обновить приложение.`,
    updateButtonLabel: 'Обновить сейчас',
  },
  softUpdate: {
    title: 'Доступно обновление',
    message: (v, notes) => `Доступна версия ${v}.${notes ? ` ${notes}` : ''}`,
    updateButtonLabel: 'Обновить',
    laterButtonLabel: 'Позже',
  },
  optionalBanner: {
    message: (v) => `Доступна версия ${v}.`,
    updateButtonLabel: 'Обновить',
  },
};

const LOCALE_STRINGS: Record<LocaleCode, LocaleStrings> = {
  en,
  es,
  fr,
  de,
  it,
  pt,
  ja,
  zh,
  ko,
  hi,
  ar,
  ru,
};

function baseLanguage(rawLocale: string): string {
  return rawLocale.split(/[-_]/)[0]?.toLowerCase() ?? 'en';
}

/** rawLocale can be a full tag ('pt-BR', 'zh-Hans-CN') or a bare language code ('pt') — only the base language is matched. Falls back to 'en' when unsupported. */
export function resolveLocaleStrings(rawLocale: string): LocaleStrings {
  const code = baseLanguage(rawLocale) as LocaleCode;
  return LOCALE_STRINGS[code] ?? en;
}
