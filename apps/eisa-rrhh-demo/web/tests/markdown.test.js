import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderMarkdown } from '../src/markdown.js';
test('Markdown retains tables and removes executable and unsafe HTML', () => {
  const window = new JSDOM('').window;
  const html = renderMarkdown('**22**\n\n| Indicador | Valor |\n| --- | --- |\n| Dotación | 22 |\n\n<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">peligro</a><svg onload=alert(1) />', window);
  assert.match(html, /<strong>22<\/strong>/);
  assert.match(html, /<table>/);
  assert.doesNotMatch(html, /<script|onerror|javascript:|<svg|<img|<a\b/);
});
