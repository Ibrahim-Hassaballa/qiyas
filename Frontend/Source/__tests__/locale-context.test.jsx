import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleProvider, useLocale } from '../Context/LocaleContext';

const LocaleProbe = () => {
  const { locale, setLocale, dir, t, formatNumber, formatDate } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="dir">{dir}</span>
      <span data-testid="translated">{t('language.label')}</span>
      <span data-testid="number">{formatNumber(123456)}</span>
      <span data-testid="date">{formatDate('2026-02-15T00:00:00.000Z')}</span>
      <button onClick={() => setLocale('ar')}>set-ar</button>
      <button onClick={() => setLocale('en')}>set-en</button>
    </div>
  );
};

describe('LocaleProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
  });

  it('updates lang/dir and persists locale', () => {
    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>
    );

    fireEvent.click(screen.getByText('set-ar'));

    expect(screen.getByTestId('locale')).toHaveTextContent('ar');
    expect(screen.getByTestId('dir')).toHaveTextContent('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem('locale')).toBe('ar');
    expect(screen.getByTestId('translated')).toHaveTextContent('اللغة');
  });

  it('formats numerals in Arabic locale and Western numerals in English locale', () => {
    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>
    );

    fireEvent.click(screen.getByText('set-ar'));
    const arabicNumber = screen.getByTestId('number').textContent;
    expect(arabicNumber).toMatch(/[\u0660-\u0669]/);

    fireEvent.click(screen.getByText('set-en'));
    expect(screen.getByTestId('number')).toHaveTextContent('123,456');
  });
});
