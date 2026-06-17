/**
 * notas.js
 * Reposiciona as NOTAS DE RODAPÉ por seção (#9).
 *
 * O mammoth joga TODAS as notas numa única <ol> no fim do documento; com o
 * fatiamento, essa lista inteira cai no último bloco (longe das chamadas). Aqui:
 *  1) extrairNotas: remove a <ol> final e monta o mapa {id: textoDaNota};
 *  2) anexarNotas: em cada seção, acha as chamadas (<a href="#footnote-N">) e
 *     anexa ao fim só as notas referenciadas naquela seção.
 *
 * Roda ANTES da sanitização (que desembrulha as âncoras e apagaria as chamadas).
 * Envolto em IIFE (escopo global compartilhado dos <script> da página).
 */
(function () {
  /** Remove a <ol> final de notas e devolve { html, notas:{id:texto} }. */
  function extrairNotas(html) {
    // Última <ol> do documento que contém itens de nota (id="footnote-N").
    const m = html.match(/<ol[^>]*>(?:(?!<\/ol>)[\s\S])*?id="footnote-\d+"[\s\S]*?<\/ol>\s*$/i);
    if (!m) return { html, notas: {} };
    const ol = m[0];
    const notas = {};
    const lis = ol.match(/<li id="footnote-(\d+)">([\s\S]*?)<\/li>/g) || [];
    lis.forEach((li) => {
      const mm = li.match(/<li id="footnote-(\d+)">([\s\S]*?)<\/li>/);
      let texto = mm[2]
        .replace(/<a\b[^>]*href="#footnote-ref-\d+"[^>]*>[\s\S]*?<\/a>/gi, '') // tira a seta "↑"
        .replace(/^\s*<p>\s*/, '')
        .replace(/\s*<\/p>\s*$/, '')
        .trim();
      notas[mm[1]] = texto;
    });
    return { html: html.replace(ol, ''), notas };
  }

  /** Anexa ao fim da seção as notas referenciadas nela (preserva a ordem/rótulo). */
  function anexarNotas(html, notas) {
    if (!notas || !Object.keys(notas).length) return html;
    const refs = [...html.matchAll(/href="#footnote-(\d+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    const vistos = new Set();
    const itens = [];
    refs.forEach((m) => {
      const id = m[1];
      if (vistos.has(id) || notas[id] == null) return;
      vistos.add(id);
      const rotulo = m[2].replace(/<[^>]+>/g, '').trim() || ('[' + (Number(id) + 1) + ']');
      itens.push('<p><sup>' + rotulo + '</sup> ' + notas[id] + '</p>');
    });
    if (!itens.length) return html;
    return html + '<p><strong>Notas</strong></p>' + itens.join('');
  }

  const api = { extrairNotas, anexarNotas };
  if (typeof window !== 'undefined') { window.Notas = api; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})();
