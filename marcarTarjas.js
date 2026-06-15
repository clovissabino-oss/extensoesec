/**
 * marcarTarjas.js
 * No .docx do Estratégia a "tarja azul" (título de seção) é um parágrafo cujo
 * <w:pPr> tem fundo <w:shd ... w:fill="4231A4">. O documento NÃO usa estilos
 * nomeados, então o mammoth não detecta títulos sozinho. Aqui marcamos cada
 * parágrafo-tarja com <w:pStyle w:val="Heading1"/> para o mammoth emitir <h1>.
 */

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

/** Recebe o .docx (ArrayBuffer), marca as tarjas e devolve novo ArrayBuffer. */
async function marcarTarjasDocx(arrayBuffer) {
  const Zip = (typeof JSZip !== 'undefined') ? JSZip : (await import('jszip')).default;
  // Convert ArrayBuffer to a format JSZip can handle
  const data = typeof window === 'undefined' && Buffer && Buffer.isBuffer(arrayBuffer)
    ? arrayBuffer
    : Buffer.from(arrayBuffer);
  const zip = await Zip.loadAsync(data);
  const xml = await zip.file('word/document.xml').async('string');
  zip.file('word/document.xml', marcarTarjas(xml));
  return zip.generateAsync({ type: 'arraybuffer' });
}

const api = { marcarTarjas, marcarTarjasDocx };
if (typeof window !== 'undefined') { window.MarcarTarjas = api; }
if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
