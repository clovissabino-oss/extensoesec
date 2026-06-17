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
   * @param {'titulo'|'subtitulo'} [nivel]  'subtitulo' corta em QUALQUER título
   *   (h1/h2/h3 — um bloco por seção/subtítulo, mesmo que o professor use h3);
   *   'titulo' (padrão) corta só nas seções principais (h1).
   */
  function fatiarSecoes(html, nivel) {
    const cortaEm = nivel === 'subtitulo' ? new Set(['h1', 'h2', 'h3']) : new Set(['h1']);
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

  /* ------------------------------------------------------------------------
   * estilizarTitulos: reproduz a TARJA AZUL e a CAIXA DO SUBTÍTULO do LDI.
   * No editor, faixa/subtítulo são TABELAS de uma célula (o editor preserva
   * fundo/borda em <td>, não em parágrafo — descoberto ao vivo):
   *   - <h1> (tarja) → célula com FUNDO azul #4231A4 + texto branco.
   *   - <h2> (subtítulo) → célula branca com BORDA azul + texto azul.
   * ---------------------------------------------------------------------- */
  function semTags(s) { return s.replace(/<[^>]+>/g, '').trim(); }

  function celulaTitulo(texto, bg, corTexto) {
    return '<table fullwidth="true" class="full-width-table"><tbody><tr>' +
      '<td colspan="1" rowspan="1" backgroundcolor="' + bg + '" bordercolor="#4231A4" ' +
      'style="background-color:' + bg + ';border:1px solid #4231A4;">' +
      '<h2 style="text-align: justify"><span style="color:' + corTexto + '">' + texto + '</span></h2>' +
      '</td></tr></tbody></table>';
  }

  /**
   * Marca as tabelas de CONTEÚDO como full-width (mesma classe do LDI), para
   * que ocupem a largura do bloco. Não mexe nas tabelas que já têm classe
   * (ex.: as tarjas/subtítulos criados por estilizarTitulos).
   */
  function estilizarTabelas(html) {
    return html.replace(/<table\b(?![^>]*\bclass=)([^>]*)>/gi, '<table class="full-width-table"$1>');
  }

  function estilizarTitulos(html) {
    // Passada ÚNICA (h1|h2): o String.replace não re-escaneia o <h2> que criamos
    // dentro das tabelas, evitando dupla transformação.
    return html.replace(/<(h1|h2)\b[^>]*>([\s\S]*?)<\/\1>/gi, (m, tag, inner) =>
      tag.toLowerCase() === 'h1'
        ? celulaTitulo(semTags(inner), '#4231A4', '#FFFFFF')   // tarja: fundo azul, texto branco
        : celulaTitulo(semTags(inner), '#FFFFFF', '#4231A4'));  // subtítulo: caixa branca, borda+texto azul
  }

  /**
   * agruparCaixas: junta parágrafos consecutivos <p class="caixa"> (parágrafos
   * com borda, marcados em marcarCaixas) numa TABELA de 1 célula com borda — o
   * editor do LDI preserva borda de <td>, não de parágrafo. Reproduz as "caixas"
   * de destaque do material (ex.: definições em caixa com contorno).
   */
  function agruparCaixas(html) {
    if (typeof DOMParser === 'undefined') return html;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Início de cada sequência = <p.caixa> sem um <p.caixa> imediatamente antes.
    const inicios = [...doc.querySelectorAll('p.caixa')].filter((p) => {
      const ant = p.previousElementSibling;
      return !(ant && ant.tagName === 'P' && ant.classList.contains('caixa'));
    });
    inicios.forEach((p0) => {
      const grupo = [];
      let cur = p0;
      while (cur && cur.tagName === 'P' && cur.classList.contains('caixa')) {
        grupo.push(cur);
        cur = cur.nextElementSibling;
      }
      const tabela = doc.createElement('table');
      tabela.className = 'full-width-table';
      const tbody = doc.createElement('tbody');
      const tr = doc.createElement('tr');
      const td = doc.createElement('td');
      td.setAttribute('style', 'border:1px solid #4231A4;padding:8px;');
      td.setAttribute('bordercolor', '#4231A4');
      p0.parentNode.insertBefore(tabela, p0);
      grupo.forEach((p) => {
        p.classList.remove('caixa');
        if (!p.getAttribute('class')) p.removeAttribute('class');
        td.appendChild(p);
      });
      tr.appendChild(td); tbody.appendChild(tr); tabela.appendChild(tbody);
    });
    return doc.body.innerHTML;
  }

  const api = { fatiarSecoes, estilizarTitulos, estilizarTabelas, agruparCaixas };
  if (typeof window !== 'undefined') { window.FatiarSecoes = api; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})();
