/**
 * marcarTarjas.js
 * No .docx do Estratégia a "tarja azul" (título de seção) é um parágrafo cujo
 * <w:pPr> tem fundo <w:shd ... w:fill="4231A4">. O documento NÃO usa estilos
 * nomeados, então o mammoth não detecta títulos sozinho. Aqui marcamos cada
 * parágrafo-tarja com <w:pStyle w:val="Heading1"/> para o mammoth emitir <h1>.
 *
 * Envolto em IIFE: como vários <script> clássicos compartilham o escopo global
 * da página, declarações `const` de topo colidiriam entre os arquivos.
 */
(function () {
  const FILL_TARJA = /<w:shd\b[^>]*w:fill="4231[aA]4"/;       // tarja azul (fundo) = título principal
  const SZ_SUBTITULO = /<w:sz w:val="32"\s*\/>/;             // 16pt = subtítulo do material

  /**
   * Marca o document.xml (string). Pura e testável.
   * - Tarja azul (fundo #4231A4) → Heading1 (vira <h1>: título principal/seção).
   * - Subtítulo (fonte 16pt = sz 32)  → Heading2 (vira <h2>: ex. "Conceito de Constituição").
   */
  function marcarTarjas(documentXml) {
    return documentXml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (par) => {
      const m = par.match(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/);
      if (!m) return par;
      const ppr = m[0];
      if (/<w:pStyle\b/.test(ppr)) return par; // já tem estilo nomeado
      let estilo = null;
      if (FILL_TARJA.test(ppr)) estilo = 'Heading1';
      else if (SZ_SUBTITULO.test(par)) estilo = 'Heading2';
      if (!estilo) return par;
      const novo = ppr.replace(/<w:pPr\b[^>]*>/, (abre) => abre + '<w:pStyle w:val="' + estilo + '"/>');
      return par.replace(ppr, novo);
    });
  }

  /**
   * Recebe o .docx (ArrayBuffer), marca as tarjas (banners → Heading1) E injeta
   * os estilos de cor de fonte (ver cores.js). Devolve { arrayBuffer, cores }.
   */
  async function marcarTarjasDocx(arrayBuffer) {
    const Zip = (typeof JSZip !== 'undefined') ? JSZip : (await import('jszip')).default;
    const CoresMod = (typeof Cores !== 'undefined') ? Cores : require('./cores.js');
    const ImgMod = (typeof Imagens !== 'undefined') ? Imagens : require('./imagens.js');
    // JSZip.loadAsync aceita ArrayBuffer nativamente no browser e no Node.
    const zip = await Zip.loadAsync(arrayBuffer);
    let doc = await zip.file('word/document.xml').async('string');
    let styles = await zip.file('word/styles.xml').async('string');

    const tamanhos = await ImgMod.mapaTamanhos(zip); // tamanho de exibição das imagens
    doc = marcarTarjas(doc); // tarjas azuis viram Heading1
    const cores = CoresMod.coresDoDocumento(doc);
    const comCor = CoresMod.injetarEstilosCor(doc, styles, cores);

    zip.file('word/document.xml', comCor.doc);
    zip.file('word/styles.xml', comCor.styles);
    const out = await zip.generateAsync({ type: 'arraybuffer' });
    return { arrayBuffer: out, cores, tamanhos };
  }

  const api = { marcarTarjas, marcarTarjasDocx };
  if (typeof window !== 'undefined') { window.MarcarTarjas = api; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})();
