/**
 * content.js — roda DENTRO da página do editor de LDI.
 * SEM API. Dirige o editor pela própria sessão logada, como se você colasse conteúdo.
 *
 * Técnica principal: SIMULAR COLAGEM (paste).
 * O editor é ProseMirror/TipTap. Ele ignora innerHTML direto (tem estado próprio),
 * mas escuta o evento "paste". Então montamos o HTML dos blocos e disparamos um
 * ClipboardEvent('paste') com esse HTML — o ProseMirror parseia para os nós dele.
 * Preserva títulos, parágrafos, negrito, listas e tabelas.
 */

console.log('[Injetor LDI] Content script inicializado.');

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.acao !== 'INJETAR_BLOCOS') return;
  injetar(msg.blocos)
    .then((qtd) => sendResponse({ ok: true, qtd }))
    .catch((e) => { console.error('[Injetor LDI]', e); sendResponse({ ok: false, erro: e.message }); });
  return true; // resposta assíncrona
});

async function injetar(blocos) {
  const editor = acharEditorFocado();
  if (!editor) {
    throw new Error('Editor não encontrado. Clique dentro do bloco de texto do item antes de injetar.');
  }

  // Monta um único fragmento HTML com todos os blocos e cola de uma vez.
  // (MVP. Para separar em blocos distintos do LDI, ver "PRÓXIMOS PASSOS" abaixo.)
  const html = blocos.map((b) => b.html).join('\n');
  const texto = blocos.map((b) => b.texto || '').join('\n\n');

  simularColagem(editor, html, texto);
  console.log(`[Injetor LDI] ${blocos.length} blocos colados no editor.`);
  return blocos.length;
}

/* -------------------------------------------------------------------------
 * Núcleo: simular colagem de HTML no ProseMirror/TipTap
 * ----------------------------------------------------------------------- */
function simularColagem(alvo, html, texto) {
  alvo.focus();
  const dt = new DataTransfer();
  dt.setData('text/html', html);
  dt.setData('text/plain', texto);
  const evt = new ClipboardEvent('paste', {
    clipboardData: dt,
    bubbles: true,
    cancelable: true
  });
  alvo.dispatchEvent(evt);
}

/* -------------------------------------------------------------------------
 * Localiza o editor. Prioriza o que está em foco; senão, o primeiro da página.
 * AJUSTAR o seletor depois de inspecionar 1 bloco no DevTools (aba Elementos).
 * ----------------------------------------------------------------------- */
function acharEditorFocado() {
  return (
    document.querySelector('.ProseMirror-focused') ||
    (document.activeElement?.closest?.('.ProseMirror, [contenteditable="true"]')) ||
    document.querySelector('.ProseMirror, [contenteditable="true"]')
  );
}

/* =========================================================================
 * PRÓXIMOS PASSOS (V2) — quando você me mandar a estrutura de 1 bloco:
 *
 * 1) BLOCO A BLOCO (em vez de colar tudo junto):
 *    - achar o botão "Adicionar bloco" (capturar seletor)
 *    - para cada bloco do docx: clicar -> esperar renderizar -> colar no novo editor
 *    - usar esperarPor() abaixo para sincronizar com a renderização do Vue
 *
 * 2) REORDENAR ("posicionado (Nx↑)"):
 *    - achar o botão "subir" de cada item (capturar seletor)
 *    - clicar N vezes até a posição correta (foi exatamente o que o original fez)
 * ======================================================================= */

// utilitário para sincronizar com renderização assíncrona do Vue
function esperarPor(seletor, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const achado = document.querySelector(seletor);
    if (achado) return resolve(achado);
    const obs = new MutationObserver(() => {
      const el = document.querySelector(seletor);
      if (el) { obs.disconnect(); resolve(el); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); reject(new Error('timeout: ' + seletor)); }, timeout);
  });
}
