/**
 * parser.js
 * Orquestra: .docx -> (marca tarjas) -> mammoth (HTML) -> fatia em seções.
 * Cada seção vira um bloco no editor de LDI. Funciona 100% offline (só o .docx).
 *
 * No browser, depende dos globais: MarcarTarjas, FatiarSecoes, mammoth.
 */

/** Remove imagens do HTML (usado quando a pessoa marca "ignorar imagens"). */
function removerImagens(html) {
  return html.replace(/<img\b[^>]*>/gi, '');
}

const Parser = {
  /**
   * @param {ArrayBuffer} arrayBuffer  conteúdo bruto do .docx
   * @param {{ ignorarImagens?: boolean }} [opts]
   * @returns {Promise<Array<{titulo:string, html:string, resumo:object}>>}
   */
  async docxParaSecoes(arrayBuffer, opts = {}) {
    const marcado = await MarcarTarjas.marcarTarjasDocx(arrayBuffer);
    const { value: html } = await mammoth.convertToHtml(
      { arrayBuffer: marcado },
      {
        styleMap: [
          "p[style-name='heading 1'] => h1:fresh",
          "p[style-name='heading 2'] => h2:fresh",
          "p[style-name='heading 3'] => h3:fresh"
        ]
      }
    );
    let secoes = FatiarSecoes.fatiarSecoes(html);
    if (opts.ignorarImagens) {
      secoes = secoes.map((s) => ({
        ...s,
        html: removerImagens(s.html),
        resumo: { ...s.resumo, imagens: 0 }
      }));
    }
    return secoes;
  }
};

const api = { Parser, removerImagens };
if (typeof window !== 'undefined') { window.Parser = Parser; }
if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
