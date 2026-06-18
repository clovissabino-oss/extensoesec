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
  // Marcações (<w:highlight>): o editor do LDI NÃO tem grifo/fundo em texto
  // (comprovado ao vivo: <mark> é descartado; textStyle só aceita `color`). Por
  // isso, marcação vira COR DE FONTE (proxy) — sinaliza a ênfase do amarelo.
  // Mapa nome-da-marcação -> cor de fonte legível (laranja p/ amarelo, p/ não
  // confundir com o vermelho de notas nem o azul de ênfase). Trocar aqui se quiser.
  const MARCA_COR = {
    yellow: 'C55A11', green: '2E7D32', cyan: '00838F', magenta: 'AD1457',
    red: 'C00000', blue: '1565C0', darkyellow: '7F6000', darkgreen: '1B5E20',
    darkcyan: '00695C', darkmagenta: '6A1B9A', darkred: '8B0000', darkblue: '0D47A1'
  };
  const MARCA_PADRAO = 'C55A11';

  /** Cores de fonte distintas (hex maiúsculo) usadas no document.xml. */
  function coresDoDocumento(documentXml) {
    const achadas = [...documentXml.matchAll(/<w:color\s+w:val="([0-9A-Fa-f]{6})"/g)].map((m) => m[1].toUpperCase());
    return [...new Set(achadas)];
  }

  /** Marcações (<w:highlight>) distintas usadas, restritas às conhecidas. */
  function marcacoesDoDocumento(documentXml) {
    const achadas = [...documentXml.matchAll(/<w:highlight\s+w:val="([a-zA-Z]+)"/g)]
      .map((m) => m[1].toLowerCase()).filter((v) => MARCA_COR[v]); // só as que viram cor
    return [...new Set(achadas)];
  }

  /**
   * Injeta <w:rStyle> nos runs com cor de fonte OU marcação (highlight) e define
   * os estilos de caractere no styles.xml. Uma passada só pelo rPr: cor tem
   * prioridade (no material, texto marcado costuma não ter cor própria).
   * Devolve { doc, styles }.
   */
  function injetarEstilosCor(documentXml, stylesXml, cores, marcas) {
    marcas = marcas || [];
    const doc = documentXml.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/g, (full, inner) => {
      if (/<w:rStyle/.test(inner)) return full; // já tem estilo nomeado
      const mc = inner.match(/<w:color\s+w:val="([0-9A-Fa-f]{6})"/);
      if (mc) return '<w:rPr><w:rStyle w:val="cor' + mc[1].toUpperCase() + '"/>' + inner + '</w:rPr>';
      const mh = inner.match(/<w:highlight\s+w:val="([a-zA-Z]+)"/);
      if (mh && MARCA_COR[mh[1].toLowerCase()]) return '<w:rPr><w:rStyle w:val="marca' + mh[1].toLowerCase() + '"/>' + inner + '</w:rPr>';
      return full;
    });
    const defsCor = cores
      .map((c) => '<w:style w:type="character" w:styleId="cor' + c + '"><w:name w:val="cor-' + c + '"/><w:rPr/></w:style>')
      .join('');
    const defsMarca = marcas
      .map((m) => '<w:style w:type="character" w:styleId="marca' + m + '"><w:name w:val="marca-' + m + '"/><w:rPr/></w:style>')
      .join('');
    const styles = stylesXml.replace('</w:styles>', defsCor + defsMarca + '</w:styles>');
    return { doc, styles };
  }

  /** Entradas de styleMap do mammoth para cada cor (estilo de caractere → span). */
  function styleMapDeCores(cores) {
    return cores.map((c) => "r[style-name='cor-" + c + "'] => span.cor-" + c);
  }

  /** Entradas de styleMap para cada marcação (estilo de caractere → span colorido). */
  function styleMapDeMarcas(marcas) {
    return marcas.map((m) => "r[style-name='marca-" + m + "'] => span.marca-" + m);
  }

  /**
   * Converte as classes injetadas em estilo inline preservado na colagem:
   *  - cor-XXXXXX  -> color:#XXXXXX (cor de fonte original)
   *  - marca-NOME  -> color:#proxy  (marcação do Word vira COR DE FONTE; o editor
   *                   não suporta grifo/fundo em texto)
   */
  function inlineCores(html) {
    return html
      .replace(/class="cor-([0-9A-Fa-f]{6})"/g, (m, c) => 'style="color:#' + c + '"')
      .replace(/class="marca-([a-z]+)"/g, (m, n) => 'style="color:#' + (MARCA_COR[n] || MARCA_PADRAO) + '"');
  }

  const api = { coresDoDocumento, marcacoesDoDocumento, injetarEstilosCor, styleMapDeCores, styleMapDeMarcas, inlineCores };
  if (typeof window !== 'undefined') { window.Cores = api; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})();
