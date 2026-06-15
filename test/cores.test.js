// Preservação de cores de fonte do .docx (o mammoth as descarta).
import { describe, it, expect } from 'vitest';
import { coresDoDocumento, injetarEstilosCor, styleMapDeCores, inlineCores } from '../cores.js';

describe('coresDoDocumento', () => {
  it('lista cores distintas em maiúsculo', () => {
    const xml = '<w:color w:val="4231a4"/><w:color w:val="C00000"/><w:color w:val="4231A4"/>';
    expect(coresDoDocumento(xml)).toEqual(['4231A4', 'C00000']);
  });
});

describe('injetarEstilosCor', () => {
  it('injeta rStyle no run colorido e define o estilo em styles.xml', () => {
    const doc = '<w:r><w:rPr><w:color w:val="4231A4"/></w:rPr><w:t>x</w:t></w:r>';
    const styles = '<w:styles></w:styles>';
    const r = injetarEstilosCor(doc, styles, ['4231A4']);
    expect(r.doc).toContain('<w:rStyle w:val="cor4231A4"/>');
    expect(r.styles).toContain('w:styleId="cor4231A4"');
    expect(r.styles).toContain('<w:name w:val="cor-4231A4"/>');
  });

  it('não mexe em run sem cor', () => {
    const doc = '<w:r><w:rPr><w:b/></w:rPr><w:t>x</w:t></w:r>';
    expect(injetarEstilosCor(doc, '<w:styles></w:styles>', []).doc).not.toContain('rStyle');
  });
});

describe('styleMapDeCores', () => {
  it('gera entradas de styleMap por cor', () => {
    expect(styleMapDeCores(['4231A4'])).toEqual(["r[style-name='cor-4231A4'] => span.cor-4231A4"]);
  });
});

describe('inlineCores', () => {
  it('troca class cor-XXXXXX por style color inline', () => {
    expect(inlineCores('<span class="cor-4231A4">x</span>')).toBe('<span style="color:#4231A4">x</span>');
  });
});
