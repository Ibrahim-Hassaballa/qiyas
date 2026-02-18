const RTL_CHAR_REGEX = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
const LTR_CHAR_REGEX = /[A-Za-z\u00C0-\u02AF]/;

export const getTextDirection = (text) => {
  if (!text || typeof text !== 'string') return 'auto';

  let rtlCount = 0;
  let ltrCount = 0;

  for (const char of text) {
    if (RTL_CHAR_REGEX.test(char)) rtlCount++;
    else if (LTR_CHAR_REGEX.test(char)) ltrCount++;
  }

  if (rtlCount === 0 && ltrCount === 0) return 'auto';
  return rtlCount >= ltrCount ? 'rtl' : 'ltr';
};
