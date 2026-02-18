import en from '../i18n/en.json';
import ar from '../i18n/ar.json';

const flattenKeys = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([key, value]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return flattenKeys(value, next);
    }
    return [next];
  });

describe('translation dictionaries', () => {
  it('keeps Arabic and English dictionaries in sync', () => {
    const enKeys = flattenKeys(en).sort();
    const arKeys = flattenKeys(ar).sort();
    expect(arKeys).toEqual(enKeys);
  });
});
