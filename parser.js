/**
 * parser.js
 * Converte o HTML semântico produzido pelo mammoth em uma lista de "blocos"
 * normalizados — o formato intermediário que o content.js vai injetar no LDI.
 *
 * Este é o coração da ferramenta e a parte que NÃO depende de engenharia reversa:
 * funciona 100% offline, só com o .docx. Ajuste o mapeamento conforme as regras
 * que você quiser (qual estilo do Word vira qual tipo de bloco).
 */

const Parser = {
  /**
   * @param {ArrayBuffer} arrayBuffer  conteúdo bruto do .docx
   * @returns {Promise<Array<Bloco>>}
   */
  async docxParaBlocos(arrayBuffer) {
    // 1) docx -> HTML semântico. O styleMap permite mapear estilos customizados
    //    do Word (ex.: "Destaque Estratégia") para marcações próprias.
    const { value: html } = await mammoth.convertToHtml(
      { arrayBuffer },
      {
        styleMap: [
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh"
        ]
      }
    );

    // 2) HTML -> árvore -> lista de blocos
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const blocos = [];

    for (const el of doc.body.children) {
      const tag = el.tagName.toLowerCase();

      if (/^h[1-6]$/.test(tag)) {
        blocos.push({
          tipo: 'titulo',
          nivel: Number(tag[1]),          // H1 normalmente = nome do item; H2/H3 = subtítulo dentro do item
          texto: el.textContent.trim(),
          html: el.outerHTML
        });
      } else if (tag === 'p' && el.textContent.trim()) {
        blocos.push({ tipo: 'texto', html: el.innerHTML, texto: el.textContent.trim() });
      } else if (tag === 'ul' || tag === 'ol') {
        blocos.push({ tipo: 'lista', ordenada: tag === 'ol', html: el.outerHTML });
      } else if (tag === 'table') {
        blocos.push({ tipo: 'tabela', html: el.outerHTML });
      } else if (el.querySelector('img')) {
        const img = el.querySelector('img');
        blocos.push({ tipo: 'imagem', src: img.src, html: el.outerHTML });
      }
    }
    return blocos;
  }
};

// disponibiliza para popup.js e content.js
if (typeof window !== 'undefined') window.Parser = Parser;
