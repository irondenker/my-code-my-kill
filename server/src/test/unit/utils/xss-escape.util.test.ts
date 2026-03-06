import assert from 'node:assert/strict';
import test from 'node:test';
import type { XssSideOptions } from '../../../config/lab-options.js';
import { createXssEscaper } from '../../../utils/xss-escape.util.js';

function makeOptions(overrides: Partial<XssSideOptions> = {}): XssSideOptions {
  return {
    sanitizeEnabled: true,
    defaultRuleToggles: {
      ampersand: true,
      lessThan: true,
      greaterThan: true,
      doubleQuote: true,
      singleQuote: true,
      backtick: true,
    },
    customRules: [],
    ...overrides,
  };
}

test('createXssEscaper applies enabled default escape rules', () => {
  const escapeForXss = createXssEscaper(makeOptions());

  assert.equal(
    escapeForXss(`<a href="x" onclick='y'>\`&</a>`),
    '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&#96;&amp;&lt;/a&gt;'
  );
});

test('createXssEscaper lets custom rules override default from token', () => {
  const escapeForXss = createXssEscaper(
    makeOptions({
      customRules: [{ from: '<', to: '[LT]' }],
    })
  );

  assert.equal(escapeForXss('<x>'), '[LT]x&gt;');
});

test('createXssEscaper matches longer custom pattern first', () => {
  const escapeForXss = createXssEscaper(
    makeOptions({
      customRules: [
        { from: '<', to: 'S' },
        { from: '<<', to: 'D' },
      ],
    })
  );

  assert.equal(escapeForXss('<<'), 'D');
});

test('createXssEscaper returns plain string when no rules are enabled', () => {
  const escapeForXss = createXssEscaper(
    makeOptions({
      defaultRuleToggles: {
        ampersand: false,
        lessThan: false,
        greaterThan: false,
        doubleQuote: false,
        singleQuote: false,
        backtick: false,
      },
    })
  );

  assert.equal(escapeForXss('a < b'), 'a < b');
  assert.equal(escapeForXss(null), '');
  assert.equal(escapeForXss(undefined), '');
  assert.equal(escapeForXss(123), '123');
});
