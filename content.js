/**
 * content.js — roda DENTRO da página do editor de LDI.
 * Injetado sob demanda pelo popup (chrome.scripting.executeScript) e também
 * declarado em content_scripts. Idempotente: só registra o listener uma vez.
 *
 * SEM API. Injeta seção por seção via colagem simulada (ClipboardEvent 'paste').
 * Cada tarja azul = um bloco novo: a 1ª seção vai no editor em foco; as demais
 * são criadas clicando "+ Adicionar bloco" e depois "Texto".
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

  /** O <li> VISÍVEL do menu cujo texto é exatamente "Texto". */
  function acharLiTexto() {
    return [...document.querySelectorAll('li')].find(
      (li) => (li.textContent || '').trim().toLowerCase() === TEXTO_OPCAO_TEXTO && li.offsetParent
    );
  }

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

  /**
   * Dispara uma sequência COMPLETA de eventos de mouse num elemento.
   * O menu "Texto" do LDI não responde a um .click() simples — o handler do Vue
   * exige pointerdown/mousedown/pointerup/mouseup/click no elemento interno.
   */
  function dispararMouse(el) {
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((tipo) =>
      el.dispatchEvent(new MouseEvent(tipo, { bubbles: true, cancelable: true, view: window })));
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

  /** O botão "Adicionar bloco" VISÍVEL (o último — adiciona ao fim do item). */
  function acharBotaoAdicionar() {
    const bs = [...document.querySelectorAll('button,[role="button"],a,span,div,li')]
      .filter((e) => (e.textContent || '').trim().toLowerCase() === TEXTO_BOTAO_BLOCO && e.offsetParent);
    return bs[bs.length - 1] || null;
  }

  /** Cria um bloco de texto novo (+ Adicionar bloco → Texto) e devolve o editor dele. */
  async function adicionarBlocoTexto() {
    const antes = editores().length;
    const botao = acharBotaoAdicionar();
    if (!botao) throw new Error('Botão "Adicionar bloco" não encontrado.');
    dispararMouse(botao); // sequência completa de mouse (clique simples não abre o menu)
    const li = await esperarPor(acharLiTexto, 6000).catch(() => {
      throw new Error('Opção "Texto" não apareceu após "Adicionar bloco".');
    });
    dispararMouse(li.querySelector('span') || li);
    await esperarPor(() => (editores().length > antes ? editores()[editores().length - 1] : null), 8000);
    await espera(300);
    return editores()[editores().length - 1];
  }

  /**
   * Injeta as seções: 1 bloco por tarja azul. A 1ª vai no editor em foco; as
   * demais em blocos novos. Preserva formatação (títulos, negrito, listas,
   * tabelas, imagens). Continua mesmo se uma seção falhar. Devolve { qtd, erros }.
   */
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
          await espera(500); // deixa a colagem anterior assentar antes de criar bloco
          // uma re-tentativa cobre falhas transitórias de timing após colagens grandes
          editor = await adicionarBlocoTexto().catch(async () => { await espera(900); return adicionarBlocoTexto(); });
        }
        simularColagem(editor, sec.html, sec.titulo);
        qtd++;
        console.log(`[Injetor LDI] seção ${i + 1}/${secoes.length} "${sec.titulo || '(sem título)'}" colada ✓`);
        await espera(250);
      } catch (e) {
        console.error(`[Injetor LDI] falha na seção ${i + 1}:`, e);
        erros.push({ secao: i + 1, titulo: sec.titulo, msg: e.message });
      }
    }
    alert('Injetor LDI: ' + qtd + ' bloco(s) colado(s)' +
      (erros.length ? ', ' + erros.length + ' com erro (veja o console F12).' : '. Confira e clique em Salvar.'));
    return { qtd, erros };
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
