import createDOMPurify from 'dompurify';
import { marked } from 'marked';
export function renderMarkdown(markdown, targetWindow = window) {
  return createDOMPurify(targetWindow).sanitize(marked.parse(markdown, { async: false, breaks: true }), {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote'],
    ALLOWED_ATTR: [],
  });
}
