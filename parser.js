/**
 * parser.js
 * Orquestra: .docx -> (marca tarjas) -> mammoth (HTML) -> fatia em seções.
 * Cada seção vira um bloco no editor de LDI. Funciona 100% offline (só o .docx).
 *
 * No browser, depende dos globais: MarcarTarjas, FatiarSecoes, mammoth.
 * Envolto em IIFE para não vazar declarações no escopo global compartilhado dos
 * <script> clássicos da página.
 */
(function () {
  /** Remove imagens do HTML (usado quando a pessoa marca "ignorar imagens"). */
  function removerImagens(html) {
    return html.replace(/<img\b[^>]*>/gi, '');
  }

  /**
   * Sanitiza o HTML para o editor do LDI (ProseMirror/TipTap).
   *
   * Causa-raiz confirmada no editor real: ÂNCORAS VAZIAS (ex.:
   * <a id="_heading=..."></a> — marcadores de cabeçalho do Word/Google Docs,
   * presentes em TODO título) criam uma marca de link sem conteúdo que quebra o
   * ProseMirror ("Cannot read properties of undefined (reading 'nodeSize')").
   *
   * Aqui DESEMBRULHAMOS todas as âncoras: a vazia some (o vilão), e as com texto
   * (notas de rodapé, links) viram texto puro — perdem só a "clicabilidade", que
   * de todo modo não é confiável dentro do LDI. Preservamos <sup>/<sub> para não
   * estragar expoentes/índices (m², H₂O) de outras matérias.
   */
  function sanitizarHtml(html) {
    return html.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');
  }

  const Parser = {
    /**
     * @param {ArrayBuffer} arrayBuffer  conteúdo bruto do .docx
     * @param {{ ignorarImagens?: boolean }} [opts]
     * @returns {Promise<Array<{titulo:string, html:string, resumo:object}>>}
     */
    async docxParaSecoes(arrayBuffer, opts = {}) {
      const marcado = await MarcarTarjas.marcarTarjasDocx(arrayBuffer);
      const { value: html, messages } = await mammoth.convertToHtml(
        { arrayBuffer: marcado },
        {
          styleMap: [
            "p[style-name='heading 1'] => h1:fresh",
            "p[style-name='heading 2'] => h2:fresh",
            "p[style-name='heading 3'] => h3:fresh"
          ]
        }
      );
      // Surface mammoth warnings (estilos não mapeados etc.) para diagnóstico.
      (messages || []).filter((m) => m.type !== 'debug').forEach((m) => console.warn('[mammoth]', m.message));
      let secoes = FatiarSecoes.fatiarSecoes(sanitizarHtml(html));
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

  const api = { Parser, removerImagens, sanitizarHtml };
  if (typeof window !== 'undefined') { window.Parser = Parser; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})();
