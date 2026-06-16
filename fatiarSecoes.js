/**
 * fatiarSecoes.js
 * Recebe o HTML produzido pelo mammoth (com <h1> nas tarjas) e devolve uma lista
 * de seções. Cada <h1> inicia uma seção; todo o conteúdo até o próximo <h1>
 * (parágrafos, subtítulos h2/h3, listas, tabelas, imagens) entra naquela seção.
 * Conteúdo antes do primeiro <h1> vira uma seção sem título.
 *
 * Envolto em IIFE para não vazar declarações no escopo global compartilhado dos
 * <script> clássicos da página.
 */
(function () {
  function contar(elementos) {
    let paragrafos = 0, imagens = 0, listas = 0, tabelas = 0;
    for (const el of elementos) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'p') paragrafos++;
      if (tag === 'ul' || tag === 'ol') listas++;
      if (tag === 'table') tabelas++;
      imagens += el.querySelectorAll('img').length + (tag === 'img' ? 1 : 0);
    }
    return { paragrafos, imagens, listas, tabelas };
  }

  /**
   * @param {string} html
   * @param {'titulo'|'subtitulo'} [nivel]  'subtitulo' corta também nos <h2>
   *   (um bloco por subtítulo); 'titulo' (padrão) corta só nas tarjas (<h1>).
   */
  function fatiarSecoes(html, nivel) {
    const cortaEm = nivel === 'subtitulo' ? new Set(['h1', 'h2']) : new Set(['h1']);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const secoes = [];
    let atual = null;
    for (const el of Array.from(doc.body.children)) {
      const corta = cortaEm.has(el.tagName.toLowerCase());
      if (corta || !atual) {
        atual = { titulo: '', elementos: [] };
        secoes.push(atual);
        if (corta) atual.titulo = el.textContent.trim();
      }
      atual.elementos.push(el);
    }
    return secoes.map((s) => ({
      titulo: s.titulo,
      html: s.elementos.map((e) => e.outerHTML).join('\n'),
      resumo: contar(s.elementos)
    }));
  }

  const api = { fatiarSecoes };
  if (typeof window !== 'undefined') { window.FatiarSecoes = api; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})();
