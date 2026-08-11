import { describe, expect, it } from '@jest/globals';
import { getThemePalette } from '../../presentation/theme/palettes';
import {
  insetBorder,
  raisedBorder,
  raisedSurface,
} from '../../presentation/theme/styleHelpers';

describe('getThemePalette', () => {
  it('returns the exact pre-theming claymorphism colors for default/light, so existing consumers see no visual change', () => {
    const palette = getThemePalette('default', 'light');

    expect(palette.neumorphic).toBe(true);
    expect(palette.surface).toBe('#FFEBD3');
    expect(palette.surfaceRecessed).toBe('#F3DAB9');
    expect(palette.text).toBe('#4A362B');
    expect(palette.textMuted).toBe('#9C8570');
    expect(palette.primary).toBe('#FFB6A6');
    expect(palette.primaryPressed).toBe('#F29A87');
    expect(palette.secondary).toBe('#9BCEC1');
    expect(palette.info).toBe('#67A2C5');
  });

  it('every non-default theme renders flat (non-neumorphic)', () => {
    expect(getThemePalette('appleStyle', 'light').neumorphic).toBe(false);
    expect(getThemePalette('material3', 'light').neumorphic).toBe(false);
    expect(getThemePalette('minimal', 'light').neumorphic).toBe(false);
  });

  it('resolves a distinct palette per (theme, scheme) pair', () => {
    const light = getThemePalette('appleStyle', 'light');
    const dark = getThemePalette('appleStyle', 'dark');

    expect(light.scheme).toBe('light');
    expect(dark.scheme).toBe('dark');
    expect(light.surface).not.toBe(dark.surface);
  });
});

describe('theme style helpers', () => {
  it('raisedSurface uses the per-element shadow color under a neumorphic theme, and the shared card shadow otherwise', () => {
    const neumorphic = getThemePalette('default', 'light');
    const flat = getThemePalette('material3', 'light');

    const neumorphicStyle = raisedSurface(
      neumorphic,
      neumorphic.primary,
      neumorphic.primaryShadow
    );
    const flatStyle = raisedSurface(flat, flat.primary, flat.primaryShadow);

    expect(neumorphicStyle.backgroundColor).toBe(neumorphic.primary);
    expect(flatStyle.backgroundColor).toBe(flat.primary);
    expect((neumorphicStyle as { shadowColor?: string }).shadowColor).toBe(
      neumorphic.primaryShadow
    );
    expect((flatStyle as { shadowColor?: string }).shadowColor).toBe(
      flat.cardShadow
    );
  });

  it('insetBorder only adds the double-border technique for neumorphic themes', () => {
    const neumorphicStyle = insetBorder(getThemePalette('default', 'light'));
    const flatStyle = insetBorder(getThemePalette('minimal', 'light'));

    expect(neumorphicStyle).toHaveProperty('borderTopColor');
    expect(flatStyle).not.toHaveProperty('borderTopColor');
  });

  it("raisedBorder mirrors insetBorder's neumorphic gate for the embossed (outer) direction", () => {
    const neumorphicStyle = raisedBorder(
      getThemePalette('default', 'light'),
      '#000000'
    );
    const flatStyle = raisedBorder(
      getThemePalette('minimal', 'light'),
      '#000000'
    );

    expect(neumorphicStyle).toHaveProperty('borderTopColor');
    expect(flatStyle).not.toHaveProperty('borderTopColor');
  });
});
