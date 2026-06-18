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
  const ESTILO_SUMARIO = /sum[aá]?rio|^toc\d?$|tableofcontents|cabealhodosumrio/i; // Sumário/índice

  /**
   * Remove os parágrafos do SUMÁRIO/índice (estilos toc/Sumário). Eles não são
   * conteúdo da aula e, se entrarem, viram blocos indevidos (#7).
   */
  function removerSumario(documentXml) {
    // 1) neutraliza a maquinaria de CAMPO do Word (o Sumário é um campo; remover
    //    só os parágrafos deixaria o campo quebrado e o mammoth quebra ao lê-lo).
    let doc = documentXml
      .replace(/<w:fldChar\b[^>]*\/>/g, '')
      .replace(/<w:fldChar\b[^>]*>[\s\S]*?<\/w:fldChar>/g, '')
      .replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/g, '')
      .replace(/<w:delInstrText\b[^>]*>[\s\S]*?<\/w:delInstrText>/g, '');
    // 2) remove os parágrafos com estilo de Sumário/índice.
    return doc.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (par) => {
      const st = par.match(/<w:pStyle\s+w:val="([^"]+)"/);
      return (st && ESTILO_SUMARIO.test(st[1])) ? '' : par;
    });
  }

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
   * Marca os parágrafos com BORDA (caixas) com o estilo nomeado "Caixa" (já
   * definido no styles.xml com w:name="Caixa"). O mammoth descarta a borda de
   * parágrafo (<w:pBdr>), então usamos o estilo como gancho: o parser mapeia
   * "Caixa" → <p class="caixa"> e depois agrupa as caixas numa tabela com borda
   * (o editor preserva borda de <td>, não de parágrafo). Não toca em tarja/subtítulo.
   */
  function marcarCaixas(documentXml, estilosTitulo) {
    const titulos = new Set(estilosTitulo || []);
    return documentXml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (par) => {
      const m = par.match(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/);
      if (!m) return par;
      const ppr = m[0];
      if (!/<w:pBdr>/.test(ppr)) return par;                 // só parágrafos com borda
      // NÃO mexe em títulos (eles também podem ter borda): estilo Heading\d, estilo
      // nomeado de título (heading/Título — resolvido pelo styles.xml) ou tarja azul.
      const st = (ppr.match(/<w:pStyle w:val="([^"]+)"/) || [])[1];
      if (st && (/^Heading\d$/i.test(st) || titulos.has(st))) return par;
      if (/<w:shd\b[^>]*w:fill="4231[aA]4"/.test(ppr)) return par; // tarja
      const novo = /<w:pStyle\b/.test(ppr)
        ? ppr.replace(/<w:pStyle w:val="[^"]*"\s*\/>/, '<w:pStyle w:val="Caixa"/>')
        : ppr.replace(/<w:pPr\b[^>]*>/, (abre) => abre + '<w:pStyle w:val="Caixa"/>');
      return par.replace(ppr, novo);
    });
  }

  /** IDs dos estilos de parágrafo cujo NOME é heading/título (styles.xml). */
  function estilosDeTitulo(stylesXml) {
    const ids = [];
    (stylesXml.match(/<w:style [^>]*w:type="paragraph"[^>]*>[\s\S]*?<\/w:style>/g) || []).forEach((s) => {
      const id = (s.match(/w:styleId="([^"]+)"/) || [])[1];
      const nome = (s.match(/<w:name w:val="([^"]+)"/) || [])[1] || '';
      if (id && /heading\s*\d|t[íi]tulo\s*\d/i.test(nome)) ids.push(id);
    });
    return ids;
  }

  /**
   * Recebe o .docx (ArrayBuffer), marca as tarjas (banners → Heading1) E injeta
   * os estilos de cor de fonte (ver cores.js). Devolve { arrayBuffer, cores }.
   */
  async function marcarTarjasDocx(arrayBuffer) {
    const Zip = (typeof JSZip !== 'undefined') ? JSZip : (await import('jszip')).default;
    const CoresMod = (typeof Cores !== 'undefined') ? Cores : require('./cores.js');
    const ImgMod = (typeof Imagens !== 'undefined') ? Imagens : require('./imagens.js');
    const TabMod = (typeof Tabelas !== 'undefined') ? Tabelas : require('./tabelas.js');
    // JSZip.loadAsync aceita ArrayBuffer nativamente no browser e no Node.
    const zip = await Zip.loadAsync(arrayBuffer);
    let doc = await zip.file('word/document.xml').async('string');
    let styles = await zip.file('word/styles.xml').async('string');

    const tamanhos = await ImgMod.mapaTamanhos(zip); // tamanho de exibição das imagens
    const tabelasCores = TabMod.extrairCoresHeader(doc); // cor do cabeçalho das tabelas (#5)
    doc = removerSumario(doc); // tira o Sumário/índice
    doc = marcarTarjas(doc); // tarjas azuis viram Heading1
    doc = marcarCaixas(doc, estilosDeTitulo(styles)); // parágrafos com borda viram "Caixa" (exceto títulos)
    const cores = CoresMod.coresDoDocumento(doc);
    const marcas = CoresMod.marcacoesDoDocumento(doc); // marcações (highlight) usadas
    const comCor = CoresMod.injetarEstilosCor(doc, styles, cores, marcas);

    zip.file('word/document.xml', comCor.doc);
    zip.file('word/styles.xml', comCor.styles);
    const out = await zip.generateAsync({ type: 'arraybuffer' });
    return { arrayBuffer: out, cores, marcas, tamanhos, tabelasCores };
  }

  const api = { marcarTarjas, marcarTarjasDocx, removerSumario, marcarCaixas };
  if (typeof window !== 'undefined') { window.MarcarTarjas = api; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})();
