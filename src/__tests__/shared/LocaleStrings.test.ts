import { describe, expect, it } from '@jest/globals';
import { resolveLocaleStrings } from '../../presentation/i18n/locales';

describe('resolveLocaleStrings (doc 06 §4)', () => {
  it('matches a bare language code', () => {
    expect(resolveLocaleStrings('es').forceUpdate.title).toBe(
      'Actualización requerida'
    );
  });

  it('matches the base language of a full locale tag, ignoring region/script', () => {
    expect(resolveLocaleStrings('pt-BR').forceUpdate.title).toBe(
      'Atualização necessária'
    );
    expect(resolveLocaleStrings('zh-Hans-CN').forceUpdate.title).toBe(
      '需要更新'
    );
  });

  it('is case-insensitive', () => {
    expect(resolveLocaleStrings('FR-fr').forceUpdate.title).toBe(
      'Mise à jour requise'
    );
  });

  it('falls back to English for an unsupported language', () => {
    expect(resolveLocaleStrings('xx-XX').forceUpdate.title).toBe(
      'Update Required'
    );
  });

  it('appends releaseNotes to the softUpdate message when present, and omits it when null', () => {
    const strings = resolveLocaleStrings('en').softUpdate;
    expect(strings.message('2.0.0', 'Bug fixes')).toBe(
      'Version 2.0.0 is available. Bug fixes'
    );
    expect(strings.message('2.0.0', null)).toBe('Version 2.0.0 is available.');
  });

  it('every supported locale defines all three component string bundles', () => {
    const locales = [
      'en',
      'es',
      'fr',
      'de',
      'it',
      'pt',
      'ja',
      'zh',
      'ko',
      'hi',
      'ar',
      'ru',
    ];
    for (const locale of locales) {
      const strings = resolveLocaleStrings(locale);
      expect(strings.forceUpdate.title.length).toBeGreaterThan(0);
      expect(strings.forceUpdate.message('1.0.0').length).toBeGreaterThan(0);
      expect(strings.softUpdate.title.length).toBeGreaterThan(0);
      expect(strings.softUpdate.laterButtonLabel.length).toBeGreaterThan(0);
      expect(strings.optionalBanner.message('1.0.0').length).toBeGreaterThan(0);
    }
  });
});
