/**
 * content.js — roda DENTRO da página do editor de LDI.
 * SEM API. Injeta seção por seção via colagem simulada (ClipboardEvent 'paste').
 * Cada seção = um bloco. A 1ª vai no editor em foco; as demais, em "Adicionar bloco".
 */

const TEXTO_BOTAO_BLOCO = 'adicionar bloco';

/** Acha um elemento clicável cujo texto contém `texto` (case-insensitive). */
function acharBotaoPorTexto(texto) {
  const alvo = texto.trim().toLowerCase();
  const cands = document.querySelectorAll('button,[role="button"],a,span,div');
  let melhor = null;
  for (const el of cands) {
    const t = (el.textContent || '').trim().toLowerCase();
    if (t.includes(alvo)) {
      if (!melhor || (el.textContent || '').length < (melhor.textContent || '').length) melhor = el;
    }
  }
  return melhor;
}

/** Editor em foco; senão, o primeiro da página. */
function acharEditorFocado() {
  return (
    document.querySelector('.ProseMirror-focused') ||
    document.activeElement?.closest?.('.ProseMirror,[contenteditable="true"]') ||
    document.querySelector('.ProseMirror,[contenteditable="true"]')
  );
}

/** Espera um elemento aparecer (sincroniza com a renderização do Vue). */
function esperarPor(fn, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const achado = fn();
    if (achado) return resolve(achado);
    const obs = new MutationObserver(() => {
      const el = fn();
      if (el) { obs.disconnect(); resolve(el); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); reject(new Error('timeout')); }, timeout);
  });
}

/** Simula colagem de HTML no ProseMirror/TipTap. */
function simularColagem(alvo, html, texto) {
  alvo.focus();
  const dt = new DataTransfer();
  dt.setData('text/html', html);
  dt.setData('text/plain', texto || '');
  alvo.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Injeta as seções, uma por bloco. Devolve { qtd, erros }. */
async function injetarSecoes(secoes) {
  const editorInicial = acharEditorFocado();
  if (!editorInicial) {
    throw new Error('Editor não encontrado. Clique dentro do bloco de texto do item antes de injetar.');
  }
  const erros = [];
  let qtd = 0;
  for (let i = 0; i < secoes.length; i++) {
    const sec = secoes[i];
    try {
      let editor;
      if (i === 0) {
        editor = editorInicial;
      } else {
        const botao = acharBotaoPorTexto(TEXTO_BOTAO_BLOCO);
        if (!botao) throw new Error('Botão "Adicionar bloco" não encontrado.');
        const antes = document.querySelectorAll('.ProseMirror,[contenteditable="true"]').length;
        botao.click();
        await esperarPor(() => {
          const eds = document.querySelectorAll('.ProseMirror,[contenteditable="true"]');
          return eds.length > antes ? eds[eds.length - 1] : null;
        });
        await espera(150);
        const eds = document.querySelectorAll('.ProseMirror,[contenteditable="true"]');
        editor = eds[eds.length - 1];
      }
      simularColagem(editor, sec.html, sec.titulo);
      qtd++;
      console.log(`[Injetor LDI] seção ${i + 1}/${secoes.length} "${sec.titulo || '(sem título)'}" colada ✓`);
      await espera(120);
    } catch (e) {
      console.error(`[Injetor LDI] falha na seção ${i + 1}:`, e);
      erros.push({ secao: i + 1, titulo: sec.titulo, msg: e.message });
    }
  }
  alert('Injetado! Confira e clique em Salvar.');
  return { qtd, erros };
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  console.log('[Injetor LDI] Content script inicializado.');
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.acao !== 'INJETAR_SECOES') return;
    injetarSecoes(msg.secoes)
      .then(({ qtd, erros }) => sendResponse({ ok: true, qtd, erros }))
      .catch((e) => sendResponse({ ok: false, erro: e.message }));
    return true;
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { acharBotaoPorTexto, acharEditorFocado, esperarPor, simularColagem, injetarSecoes };
}
