// Preservação de cores de fonte do .docx (o mammoth as descarta).
import { describe, it, expect } from 'vitest';
import { coresDoDocumento, marcacoesDoDocumento, injetarEstilosCor, styleMapDeCores, styleMapDeMarcas, inlineCores } from '../cores.js';

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

describe('marcações (highlight)', () => {
  it('marcacoesDoDocumento lista marcações conhecidas (ignora branco)', () => {
    const xml = '<w:highlight w:val="yellow"/><w:highlight w:val="white"/><w:highlight w:val="yellow"/>';
    expect(marcacoesDoDocumento(xml)).toEqual(['yellow']);
  });

  it('injeta rStyle de marcação no run com highlight (sem cor)', () => {
    const doc = '<w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t>x</w:t></w:r>';
    const r = injetarEstilosCor(doc, '<w:styles></w:styles>', [], ['yellow']);
    expect(r.doc).toContain('<w:rStyle w:val="marcayellow"/>');
    expect(r.styles).toContain('<w:name w:val="marca-yellow"/>');
  });

  it('cor tem prioridade sobre marcação no mesmo run', () => {
    const doc = '<w:r><w:rPr><w:color w:val="C00000"/><w:highlight w:val="yellow"/></w:rPr><w:t>x</w:t></w:r>';
    const r = injetarEstilosCor(doc, '<w:styles></w:styles>', ['C00000'], ['yellow']);
    expect(r.doc).toContain('<w:rStyle w:val="corC00000"/>');
    expect(r.doc).not.toContain('marcayellow');
  });

  it('styleMapDeMarcas mapeia para <mark>', () => {
    expect(styleMapDeMarcas(['yellow'])).toEqual(["r[style-name='marca-yellow'] => mark.marca-yellow"]);
  });
});

describe('inlineCores', () => {
  it('troca class cor-XXXXXX por style color inline', () => {
    expect(inlineCores('<span class="cor-4231A4">x</span>')).toBe('<span style="color:#4231A4">x</span>');
  });

  it('troca class marca-yellow por background-color (mark)', () => {
    expect(inlineCores('<mark class="marca-yellow">x</mark>')).toBe('<mark style="background-color:#FFFF00">x</mark>');
  });
});
