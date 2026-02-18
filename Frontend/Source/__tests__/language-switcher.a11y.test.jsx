import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'vitest-axe';
import LanguageSwitcher from '../Components/LanguageSwitcher';
import { LocaleProvider } from '../Context/LocaleContext';

expect.extend(toHaveNoViolations);

describe('LanguageSwitcher accessibility', () => {
  it('has no obvious accessibility violations', async () => {
    const { container } = render(
      <LocaleProvider>
        <LanguageSwitcher />
      </LocaleProvider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
