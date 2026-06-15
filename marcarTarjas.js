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
  const FILL_TARJA = /<w:shd\b[^>]*w:fill="4231[aA]4"/;

  /** Marca o document.xml (string). Pura e testável. */
  function marcarTarjas(documentXml) {
    return documentXml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (par) => {
      const ppr = par.match(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/);
      if (!ppr) return par;
      const bloco = ppr[0];
      if (!FILL_TARJA.test(bloco)) return par;
      if (/<w:pStyle\b/.test(bloco)) return par;
      const novo = bloco.replace(/<w:pPr\b[^>]*>/, (abre) => abre + '<w:pStyle w:val="Heading1"/>');
      return par.replace(bloco, novo);
    });
  }

  /**
   * Recebe o .docx (ArrayBuffer), marca as tarjas (banners → Heading1) E injeta
   * os estilos de cor de fonte (ver cores.js). Devolve { arrayBuffer, cores }.
   */
  async function marcarTarjasDocx(arrayBuffer) {
    const Zip = (typeof JSZip !== 'undefined') ? JSZip : (await import('jszip')).default;
    const CoresMod = (typeof Cores !== 'undefined') ? Cores : require('./cores.js');
    // JSZip.loadAsync aceita ArrayBuffer nativamente no browser e no Node.
    const zip = await Zip.loadAsync(arrayBuffer);
    let doc = await zip.file('word/document.xml').async('string');
    let styles = await zip.file('word/styles.xml').async('string');

    doc = marcarTarjas(doc); // tarjas azuis viram Heading1
    const cores = CoresMod.coresDoDocumento(doc);
    const comCor = CoresMod.injetarEstilosCor(doc, styles, cores);

    zip.file('word/document.xml', comCor.doc);
    zip.file('word/styles.xml', comCor.styles);
    const out = await zip.generateAsync({ type: 'arraybuffer' });
    return { arrayBuffer: out, cores };
  }

  const api = { marcarTarjas, marcarTarjasDocx };
  if (typeof window !== 'undefined') { window.MarcarTarjas = api; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})();
