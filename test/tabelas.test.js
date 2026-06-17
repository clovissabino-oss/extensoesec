// test/tabelas.test.js  (ambiente jsdom — aplicarCorTabela usa DOMParser)
import { describe, it, expect } from 'vitest';
import { extrairCoresHeader, aplicarCorTabela, corEscura } from '../tabelas.js';

describe('extrairCoresHeader', () => {
  it('extrai o fill da 1ª linha (cabeçalho) de cada tabela', () => {
    const xml =
      '<w:tbl><w:tr>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:fill="002060"/></w:tcPr><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:fill="002060"/></w:tcPr><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc>' +
      '</w:tr><w:tr><w:tc><w:p><w:r><w:t>c</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
    expect(extrairCoresHeader(xml)).toEqual([['002060', '002060']]);
  });

  it('retorna null para tabela sem cor no cabeçalho', () => {
    const xml = '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>x</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
    expect(extrairCoresHeader(xml)).toEqual([null]);
  });

  it('ignora fundo branco/auto', () => {
    const xml = '<w:tbl><w:tr><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/></w:tcPr><w:p/></w:tc></w:tr></w:tbl>';
    expect(extrairCoresHeader(xml)).toEqual([null]);
  });
});

describe('aplicarCorTabela', () => {
  it('colore a 1ª linha com a cor do docx e texto branco se fundo escuro', () => {
    const html = '<table><tr><td><p>CLASSE</p></td><td><p>ATRIBUIÇÕES</p></td></tr><tr><td>x</td><td>y</td></tr></table>';
    const out = aplicarCorTabela(html, [['002060', '002060']]);
    expect(out).toContain('backgroundcolor="#002060"');
    expect(out.toLowerCase()).toContain('background-color: rgb(0, 32, 96)');
    expect(out.toLowerCase()).toContain('color: rgb(255, 255, 255)'); // texto branco
    expect(out).toContain('>x<'); // corpo intacto
  });

  it('não altera tabela sem cor (null)', () => {
    const html = '<table><tr><td>a</td></tr></table>';
    expect(aplicarCorTabela(html, [null])).not.toContain('backgroundcolor');
  });

  it('mantém o html quando não há cores', () => {
    expect(aplicarCorTabela('<p>oi</p>', [])).toBe('<p>oi</p>');
  });
});

describe('corEscura', () => {
  it('detecta fundo escuro (azul-marinho) e claro (amarelo)', () => {
    expect(corEscura('002060')).toBe(true);
    expect(corEscura('FFFF00')).toBe(false);
  });
});
