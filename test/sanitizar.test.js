// Regressão da causa-raiz do bug "nodeSize": âncoras vazias (marcadores de
// cabeçalho do Word/GDocs) quebram o ProseMirror do LDI. Todas as âncoras são
// desembrulhadas (a vazia some; as com texto viram texto). sup/sub preservados.
import { describe, it, expect } from 'vitest';
import { sanitizarHtml } from '../parser.js';

describe('sanitizarHtml', () => {
  it('remove âncora vazia dentro de um título (o vilão do nodeSize)', () => {
    const html = '<h1><a id="_heading=h.30j0zll"></a><strong>Apresentação</strong></h1>';
    expect(sanitizarHtml(html)).toBe('<h1><strong>Apresentação</strong></h1>');
  });

  it('desembrulha link com texto (mantém o texto, perde só o <a>)', () => {
    const html = '<p>veja <a href="https://x.com">este link</a> aqui</p>';
    expect(sanitizarHtml(html)).toBe('<p>veja este link aqui</p>');
  });

  it('desembrulha a âncora da nota de rodapé mas preserva o <sup>', () => {
    const html = '<p>ENAP<sup><sup><a href="#footnote-0" id="footnote-ref-0">[1]</a></sup></sup>.</p>';
    expect(sanitizarHtml(html)).toBe('<p>ENAP<sup><sup>[1]</sup></sup>.</p>');
  });

  it('preserva expoentes <sup> e índices <sub>', () => {
    expect(sanitizarHtml('<p>H<sub>2</sub>O e x<sup>2</sup></p>')).toBe('<p>H<sub>2</sub>O e x<sup>2</sup></p>');
  });

  it('mantém o html quando não há âncora', () => {
    expect(sanitizarHtml('<p>texto <strong>forte</strong></p>')).toBe('<p>texto <strong>forte</strong></p>');
  });
});
