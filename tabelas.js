/**
 * tabelas.js
 * Preserva a COR do cabeçalho das tabelas (o mammoth descarta o shd das células).
 *
 * As tabelas do material têm a cor só na 1ª linha (cabeçalho). Como há mescla
 * vertical (vMerge) que faz o nº de <td> do mammoth diferir do nº de <w:tc> do
 * docx, NÃO dá para casar célula a célula globalmente — mas dá para casar
 * tabela↔tabela por ordem (mammoth preserva a ordem) e colorir a 1ª linha.
 *
 * Envolto em IIFE (escopo global compartilhado dos <script> da página).
 */
(function () {
  /** Fundo escuro? (decide texto branco vs preto) — luminância < 140. */
  function corEscura(hex) {
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
  }

  /** Por tabela (em ordem) os fills das células da 1ª linha, ou null se não há cor. */
  function extrairCoresHeader(documentXml) {
    const tbls = documentXml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || [];
    return tbls.map((tb) => {
      const tr = tb.match(/<w:tr\b[\s\S]*?<\/w:tr>/);
      if (!tr) return null;
      const tcs = tr[0].match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [];
      const fills = tcs.map((tc) => {
        const pr = tc.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/);
        const m = pr && pr[0].match(/<w:shd[^>]*w:fill="([0-9A-Fa-f]{6})"/);
        const f = m ? m[1].toUpperCase() : null;
        return (f && f !== 'FFFFFF' && f !== 'AUTO') ? f : null;
      });
      return fills.some(Boolean) ? fills : null;
    });
  }

  /** Aplica a cor do cabeçalho (do docx) na 1ª linha de cada tabela do HTML. */
  function aplicarCorTabela(html, coresPorTabela) {
    if (!coresPorTabela || !coresPorTabela.length || typeof DOMParser === 'undefined') return html;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    [...doc.querySelectorAll('table')].forEach((tab, i) => {
      const fills = coresPorTabela[i];
      if (!fills) return;
      const tr = tab.querySelector('tr');
      if (!tr) return;
      [...tr.children].forEach((td, j) => {
        const fill = fills[j];
        if (!fill) return;
        const estilo = (td.getAttribute('style') || '').replace(/;?\s*background-color:[^;]*/gi, '');
        td.setAttribute('backgroundcolor', '#' + fill);
        td.setAttribute('style', (estilo + ';background-color:#' + fill).replace(/^;+/, ''));
        if (corEscura(fill)) {
          td.querySelectorAll('[style*="color"]').forEach((e) => { e.style.color = '#FFFFFF'; });
          td.style.color = '#FFFFFF'; // texto branco sobre fundo escuro
        }
      });
    });
    return doc.body.innerHTML;
  }

  const api = { extrairCoresHeader, aplicarCorTabela, corEscura };
  if (typeof window !== 'undefined') { window.Tabelas = api; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})();
