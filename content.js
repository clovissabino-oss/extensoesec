/**
 * content.js — roda DENTRO da página do editor de LDI.
 * Injetado sob demanda pelo popup (chrome.scripting.executeScript) e também
 * declarado em content_scripts. Idempotente: só registra o listener uma vez.
 *
 * SEM API. Injeta seção por seção via colagem simulada (ClipboardEvent 'paste').
 * Cada seção = um bloco. A 1ª vai no editor em foco; as demais são criadas
 * clicando "+ Adicionar bloco" e depois "TEXTO" (o + abre um menu de tipos).
 */
(function () {
  const TEXTO_BOTAO_BLOCO = 'adicionar bloco';
  const TEXTO_OPCAO_TEXTO = 'texto';
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Acha um elemento clicável por texto. exato=true exige igualdade; senão, inclui. */
  function acharPorTexto(alvo, exato) {
    const t = String(alvo).trim().toLowerCase();
    const cands = document.querySelectorAll('button,[role="button"],a,span,div,li');
    let melhor = null;
    for (const el of cands) {
      const txt = (el.textContent || '').trim().toLowerCase();
      const bate = exato ? txt === t : txt.includes(t);
      if (bate && (!melhor || (el.textContent || '').length < (melhor.textContent || '').length)) melhor = el;
    }
    return melhor;
  }

  /** Compat. com os testes: busca por inclusão. */
  function acharBotaoPorTexto(texto) { return acharPorTexto(texto, false); }

  function editores() {
    return document.querySelectorAll('.ProseMirror,[contenteditable="true"]');
  }

  /** Editor em foco; senão, o primeiro da página. */
  function acharEditorFocado() {
    return (
      document.querySelector('.ProseMirror-focused') ||
      (document.activeElement && document.activeElement.closest && document.activeElement.closest('.ProseMirror,[contenteditable="true"]')) ||
      document.querySelector('.ProseMirror,[contenteditable="true"]')
    );
  }

  /** Espera algo aparecer (sincroniza com a renderização do Vue). */
  function esperarPor(fn, timeout = 6000) {
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
    // O ProseMirror precisa de uma SELEÇÃO válida no documento para colar; só
    // focar não basta (gera "nodeSize of undefined"). Posiciona o cursor dentro.
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(alvo);
      range.collapse(true); // cursor no início do conteúdo do editor
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* sem seleção: segue mesmo assim */ }
    const dt = new DataTransfer();
    dt.setData('text/html', html);
    dt.setData('text/plain', texto || '');
    alvo.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }

  /**
   * Injeta a aula no bloco em foco, em UMA colagem (MVP confiável).
   * As tarjas azuis viram títulos (<h1>) dentro do bloco. A separação em um
   * bloco distinto por tarja fica para a V2 — depende de automatizar o menu
   * "+ Adicionar bloco" → "Texto" da plataforma, que não responde a um clique
   * simples (ver acharPorTexto/esperarPor, mantidos para esse trabalho futuro).
   * Devolve { qtd, erros }.
   */
  async function injetarSecoes(secoes) {
    const editor = acharEditorFocado();
    if (!editor) {
      throw new Error('Editor não encontrado. Clique dentro do bloco de texto do item antes de injetar.');
    }
    const html = secoes.map((s) => s.html).join('\n');
    const texto = secoes.map((s) => s.titulo).filter(Boolean).join('\n');
    simularColagem(editor, html, texto);
    console.log(`[Injetor LDI] ${secoes.length} seção(ões) coladas no bloco em foco.`);
    alert('Injetor LDI: conteúdo colado no bloco. Confira e clique em Salvar.');
    return { qtd: secoes.length, erros: [] };
  }

  // Exports para os testes (Node/Vitest).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { acharBotaoPorTexto, acharEditorFocado, esperarPor, simularColagem, injetarSecoes };
  }

  // Listener — registrado UMA vez por aba (idempotente p/ re-injeção via executeScript).
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    if (!window.__INJETOR_LDI_CARREGADO__) {
      window.__INJETOR_LDI_CARREGADO__ = true;
      console.log('[Injetor LDI] Content script inicializado.');
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg.acao !== 'INJETAR_SECOES') return;
        injetarSecoes(msg.secoes)
          .then((r) => sendResponse({ ok: true, qtd: r.qtd, erros: r.erros }))
          .catch((e) => sendResponse({ ok: false, erro: e.message }));
        return true;
      });
    }
  }
})();
