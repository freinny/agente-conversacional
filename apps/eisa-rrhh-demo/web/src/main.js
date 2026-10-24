import './styles.css';
import { renderMarkdown } from './markdown.js';
const $ = (id) => document.getElementById(id);
let busy = false, active = false, generation = 0;
async function api(path, body) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.endsWith('/login')) showAgent(false);
    throw new Error(data.detail || 'No se pudo completar la solicitud.');
  }
  return data;
}
function showAgent(signedIn) {
  active = signedIn;
  $('login-view').hidden = signedIn; $('agent-view').hidden = !signedIn; $('logout').hidden = !signedIn;
  if (!signedIn) {
    generation += 1;
    document.querySelectorAll('.message:not(:first-child)').forEach((m) => m.remove());
    $('sql-code').textContent = '-- Inicia sesión para consultar indicadores.';
    $('sql-status').textContent = 'EN ESPERA DE UNA PREGUNTA';
    $('sql-meta').textContent = 'Solo SELECT · vistas Gold · máximo 50 filas';
    $('copy-sql').disabled = true; $('username').focus();
  } else $('message').focus();
}
function addMessage(text, role, markdown = false) {
  const article = document.createElement('article'); article.className = `message ${role}`;
  const label = document.createElement('span'); label.className = 'message-label'; label.textContent = role === 'user' ? 'TÚ' : 'DATA ASSISTANT'; article.append(label);
  const content = document.createElement('div');
  if (markdown) content.innerHTML = renderMarkdown(text); else content.textContent = text;
  article.append(content); $('messages').append(article); article.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return article;
}
async function loadQuestions() {
  const data = await api('/api/demo/questions'); $('questions').replaceChildren();
  data.questions.forEach((question, index) => {
    const button = document.createElement('button'); button.className = 'question';
    const number = document.createElement('span'); number.textContent = String(index + 1).padStart(2, '0');
    const label = document.createElement('span'); label.textContent = question; button.append(number, label);
    button.addEventListener('click', () => { if (!busy) { $('message').value = question; $('chat-form').requestSubmit(); } }); $('questions').append(button);
  });
}
$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true; $('login-error').textContent = '';
  try { await api('/api/auth/login', { username: $('username').value, password: $('password').value }); $('password').value = ''; showAgent(true); await loadQuestions(); }
  catch (error) { $('login-error').textContent = error.message; } finally { button.disabled = false; }
});
$('logout').addEventListener('click', async () => { try { await api('/api/auth/logout', {}); showAgent(false); } catch (error) { addMessage(error.message, 'assistant'); } });
$('chat-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const question = $('message').value.trim(); if (!question || busy || !active) return;
  const requestGeneration = generation; busy = true; $('send').disabled = true;
  document.querySelectorAll('.question').forEach((b) => { b.disabled = true; }); addMessage(question, 'user'); $('message').value = '';
  const loading = addMessage('Preparando la consulta y verificando los indicadores…', 'assistant'); loading.classList.add('loading');
  $('sql-status').textContent = 'GENERANDO Y VALIDANDO…'; $('sql-code').textContent = '-- Esperando SQL validado por Python…'; $('copy-sql').disabled = true;
  try {
    const data = await api('/api/chat', { message: question }); if (!active || generation !== requestGeneration) return;
    loading.remove(); const article = addMessage(data.answer_markdown, 'assistant', true);
    const source = document.createElement('small'); source.className = 'answer-source'; source.textContent = `Fuente: Gold sintética (SQLite) · ${data.row_count} filas · ${data.elapsed_ms} ms`; article.append(source);
    if (data.validated === true) {
      $('sql-code').textContent = data.generated_sql; $('sql-status').textContent = '● VALIDADA Y EJECUTADA';
      $('sql-meta').textContent = `${data.row_count} filas · ${data.elapsed_ms} ms · Traza ${data.trace_id}`; $('copy-sql').disabled = false;
      const details = document.createElement('details'), summary = document.createElement('summary'), pre = document.createElement('pre');
      summary.textContent = 'Ver SQL generado'; pre.textContent = data.generated_sql; details.append(summary, pre); article.append(details);
    }
  } catch (error) {
    loading.remove(); if (active && generation === requestGeneration) { addMessage(error.message, 'assistant'); $('sql-status').textContent = 'CONSULTA NO EJECUTADA'; $('sql-code').textContent = '-- No hay SQL validado para esta solicitud.'; }
  } finally { busy = false; $('send').disabled = false; document.querySelectorAll('.question').forEach((b) => { b.disabled = false; }); if (active) $('message').focus(); }
});
$('message').addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); $('chat-form').requestSubmit(); } });
$('copy-sql').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('sql-code').textContent); $('copy-sql').textContent = 'Copiado'; } catch { $('copy-sql').textContent = 'Selecciona el SQL'; }
  setTimeout(() => { $('copy-sql').textContent = 'Copiar'; }, 1800);
});
try { await api('/api/auth/me'); showAgent(true); await loadQuestions(); } catch { showAgent(false); }
