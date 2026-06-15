/**
 * fatiarSecoes.js
 * Recebe o HTML produzido pelo mammoth (com <h1> nas tarjas) e devolve uma lista
 * de seções. Cada <h1> inicia uma seção; todo o conteúdo até o próximo <h1>
 * (parágrafos, subtítulos h2/h3, listas, tabelas, imagens) entra naquela seção.
 * Conteúdo antes do primeiro <h1> vira uma seção sem título.
 */

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

function fatiarSecoes(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const secoes = [];
  let atual = null;
  for (const el of Array.from(doc.body.children)) {
    const ehTarja = el.tagName.toLowerCase() === 'h1';
    if (ehTarja || !atual) {
      atual = { titulo: '', elementos: [] };
      secoes.push(atual);
      if (ehTarja) atual.titulo = el.textContent.trim();
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
