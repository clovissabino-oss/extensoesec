/**
 * cores.js
 * Preserva as CORES DE FONTE do .docx (o mammoth as descarta por padrão).
 *
 * O .docx do Estratégia usa cor direta (azul-roxo #4231A4 de ênfase, vermelho
 * #C00000 de nota, branco nas tarjas etc.). Técnica:
 *  1) injetar um estilo de caractere (<w:rStyle>) em cada run colorido e definir
 *     esses estilos no styles.xml — assim o mammoth os mapeia;
 *  2) styleMap manda cada estilo virar <span class="cor-XXXXXX">;
 *  3) pós-processo troca a classe por style="color:#XXXXXX" — que o editor do
 *     LDI preserva ao colar (validado ao vivo).
 *
 * Envolto em IIFE (scripts clássicos compartilham o escopo global da página).
 */
(function () {
  /** Cores de fonte distintas (hex maiúsculo) usadas no document.xml. */
  function coresDoDocumento(documentXml) {
    const achadas = [...documentXml.matchAll(/<w:color\s+w:val="([0-9A-Fa-f]{6})"/g)].map((m) => m[1].toUpperCase());
    return [...new Set(achadas)];
  }

  /**
   * Injeta <w:rStyle w:val="corXXXXXX"> nos runs com cor direta e define os
   * estilos de caractere no styles.xml. Devolve { doc, styles }.
   */
  function injetarEstilosCor(documentXml, stylesXml, cores) {
    const doc = documentXml.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/g, (full, inner) => {
      const m = inner.match(/<w:color\s+w:val="([0-9A-Fa-f]{6})"/);
      if (!m || /<w:rStyle/.test(inner)) return full; // sem cor, ou já tem estilo: deixa como está
      return '<w:rPr><w:rStyle w:val="cor' + m[1].toUpperCase() + '"/>' + inner + '</w:rPr>';
    });
    const defs = cores
      .map((c) => '<w:style w:type="character" w:styleId="cor' + c + '"><w:name w:val="cor-' + c + '"/><w:rPr/></w:style>')
      .join('');
    const styles = stylesXml.replace('</w:styles>', defs + '</w:styles>');
    return { doc, styles };
  }

  /** Entradas de styleMap do mammoth para cada cor (estilo de caractere → span). */
  function styleMapDeCores(cores) {
    return cores.map((c) => "r[style-name='cor-" + c + "'] => span.cor-" + c);
  }

  /** Converte as classes cor-XXXXXX em estilo inline color (preservado na colagem). */
  function inlineCores(html) {
    return html.replace(/class="cor-([0-9A-Fa-f]{6})"/g, (m, c) => 'style="color:#' + c + '"');
  }

  const api = { coresDoDocumento, injetarEstilosCor, styleMapDeCores, inlineCores };
  if (typeof window !== 'undefined') { window.Cores = api; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})();
