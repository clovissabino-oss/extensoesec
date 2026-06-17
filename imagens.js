/**
 * imagens.js
 * Preserva o TAMANHO de exibição das imagens (o mammoth as solta sem dimensão,
 * então saem no tamanho natural do PNG — grandes; as corujas-mascote ficavam
 * enormes). O .docx guarda o tamanho pretendido em <wp:extent cx cy> (EMU).
 *
 * Casa cada imagem do mammoth com o .docx pelo CONTEÚDO (base64) — robusto mesmo
 * quando o mammoth descarta algumas imagens. 1 px = 9525 EMU (96 dpi).
 *
 * Envolto em IIFE (escopo global compartilhado dos <script> da página).
 */
(function () {
  const EMU_POR_PX = 9525;

  /** Lê o .docx (zip JSZip já carregado) e devolve um mapa base64 -> { w, h } em px. */
  async function mapaTamanhos(zip) {
    const mapa = {};
    try {
      const doc = await zip.file('word/document.xml').async('string');
      const relsFile = zip.file('word/_rels/document.xml.rels');
      const rels = relsFile ? await relsFile.async('string') : '';
      const relMap = {};
      for (const m of rels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
        relMap[m[1]] = m[2].replace(/^\//, '').replace(/^word\//, '');
      }
      const drawings = doc.match(/<w:drawing>[\s\S]*?<\/w:drawing>/g) || [];
      for (const dr of drawings) {
        const ext = dr.match(/<wp:extent\s+cx="(\d+)"\s+cy="(\d+)"/);
        const blip = dr.match(/<a:blip[^>]*r:embed="([^"]+)"/);
        if (!ext || !blip) continue;
        const alvo = relMap[blip[1]];
        if (!alvo) continue;
        const mf = zip.file('word/' + alvo) || zip.file(alvo);
        if (!mf) continue;
        const b64 = await mf.async('base64');
        mapa[b64] = { w: Math.round(+ext[1] / EMU_POR_PX), h: Math.round(+ext[2] / EMU_POR_PX) };
      }
    } catch (e) { /* sem tamanhos: segue sem alterar imagens */ }
    return mapa;
  }

  /** Aplica width/height (px) em cada <img> cujo base64 está no mapa. */
  function aplicarTamanhos(html, mapa) {
    if (!mapa) return html;
    return html.replace(/<img\b[^>]*?src="data:[^;"]*;base64,([^"]+)"[^>]*>/gi, (tag, b64) => {
      const sz = mapa[b64];
      if (!sz || !sz.w) return tag;
      const limpo = tag.replace(/\s(?:width|height|style)="[^"]*"/gi, '');
      return limpo.replace(/<img\b/i, `<img width="${sz.w}" height="${sz.h}" style="width:${sz.w}px;height:${sz.h}px"`);
    });
  }

  /**
   * Redimensiona os BYTES de cada imagem para o tamanho de exibição.
   *
   * Motivo: o editor do LDI DESCARTA width/height ao colar e usa a resolução
   * nativa do PNG (enorme — corujas/figuras gigantes). Aqui redesenhamos cada
   * <img> num <canvas> no tamanho de exibição (lido de width/height), de modo
   * que o tamanho "nativo" passe a ser o correto — e o editor o respeite.
   * Só roda no navegador (precisa de canvas); no Node devolve o html intacto.
   * @param {string} html
   * @returns {Promise<string>}
   */
  async function redimensionarImagens(html) {
    if (typeof document === 'undefined' || !document.createElement) return html;
    try {
      const teste = document.createElement('canvas');
      if (!teste.getContext || !teste.getContext('2d')) return html; // canvas indisponível
    } catch (e) { return html; } // jsdom sem o pacote canvas lança aqui
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const imgs = [...doc.querySelectorAll('img[width][height]')];
    await Promise.all(imgs.map((img) => redimensionarUma(img)));
    return doc.body.innerHTML;
  }

  /** Redesenha uma imagem (data URL) no tamanho de exibição. Falha → mantém. */
  function redimensionarUma(img) {
    return new Promise((resolve) => {
      const w = parseInt(img.getAttribute('width'), 10);
      const h = parseInt(img.getAttribute('height'), 10);
      const src = img.getAttribute('src') || '';
      if (!w || !h || !/^data:image\//i.test(src)) return resolve();
      const im = new Image();
      im.onload = () => {
        try {
          if (im.naturalWidth > w || im.naturalHeight > h) { // só REDUZ (nunca amplia)
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(im, 0, 0, w, h);
            const tipo = /^data:image\/png/i.test(src) ? 'image/png' : 'image/jpeg';
            img.setAttribute('src', canvas.toDataURL(tipo, 0.92));
          }
        } catch (e) { /* mantém o original */ }
        resolve();
      };
      im.onerror = () => resolve();
      im.src = src;
    });
  }

  const api = { mapaTamanhos, aplicarTamanhos, redimensionarImagens };
  if (typeof window !== 'undefined') { window.Imagens = api; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})();
