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
     * @param {{ ignorarImagens?: boolean, dividirPor?: 'titulo'|'subtitulo' }} [opts]
     * @returns {Promise<Array<{titulo:string, html:string, resumo:object}>>}
     */
    async docxParaSecoes(arrayBuffer, opts = {}) {
      const { arrayBuffer: marcado, cores, tamanhos, tabelasCores } = await MarcarTarjas.marcarTarjasDocx(arrayBuffer);
      // Exclui o branco (#FFFFFF): só faz sentido sobre a faixa azul (que o editor
      // não aceita colar com fundo), senão vira texto branco invisível. Assim o
      // título da tarja fica na cor padrão (visível). A faixa azul é tema da V2.
      const coresVisiveis = cores.filter((c) => c !== 'FFFFFF');
      const styleMap = [
        "p[style-name='heading 1'] => h1:fresh",
        "p[style-name='heading 2'] => h2:fresh",
        "p[style-name='heading 3'] => h3:fresh",
        "p[style-name='Caixa'] => p.caixa:fresh" // parágrafos com borda (caixas) → agrupados depois
      ].concat(Cores.styleMapDeCores(coresVisiveis)); // preserva as cores de fonte
      const { value: html, messages } = await mammoth.convertToHtml({ arrayBuffer: marcado }, { styleMap });
      // Surface mammoth warnings (estilos não mapeados etc.) para diagnóstico.
      (messages || []).filter((m) => m.type !== 'debug').forEach((m) => console.warn('[mammoth]', m.message));
      // inlineCores: cores de fonte; aplicarTamanhos: marca o tamanho de exibição;
      // redimensionarImagens: redesenha os bytes nesse tamanho (o editor ignora
      // width/height ao colar, então corrige de fato as imagens/corujas gigantes).
      let base = Imagens.aplicarTamanhos(Cores.inlineCores(html), tamanhos);
      base = await Imagens.redimensionarImagens(base, tamanhos);
      // estilizarTabelas: tabelas full-width; aplicarCorTabela: cor do cabeçalho (#5)
      // — ANTES de agruparCaixas, para o índice das tabelas casar com o do .docx.
      const comCor = Tabelas.aplicarCorTabela(FatiarSecoes.estilizarTabelas(base), tabelasCores);
      // agruparCaixas: parágrafos com borda viram tabela de 1 célula com borda.
      const corpo = FatiarSecoes.agruparCaixas(comCor);
      // Tira a <ol> de notas do fim ANTES de fatiar/sanitizar (a sanitização
      // desembrulha as âncoras e apagaria as chamadas das notas).
      const { html: corpoSemNotas, notas } = Notas.extrairNotas(corpo);
      let secoes = FatiarSecoes.fatiarSecoes(corpoSemNotas, opts.dividirPor);
      // Por seção: anexa as notas referenciadas (#9), sanitiza e reproduz a tarja
      // azul (fundo) e a caixa do subtítulo (tabela de 1 célula).
      secoes = secoes.map((s) => ({
        ...s,
        html: FatiarSecoes.estilizarTitulos(sanitizarHtml(Notas.anexarNotas(s.html, notas)))
      }));
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
