// test/notas.test.js
import { describe, it, expect } from 'vitest';
import { extrairNotas, anexarNotas } from '../notas.js';

const CORPO =
  '<p>Texto<sup><a href="#footnote-0" id="footnote-ref-0">[1]</a></sup> e mais' +
  '<sup><a href="#footnote-1" id="footnote-ref-1">[2]</a></sup>.</p>' +
  '<ol><li id="footnote-0"><p> STF, ADI 123. <a href="#footnote-ref-0">↑</a></p></li>' +
  '<li id="footnote-1"><p> Súmula 456. <a href="#footnote-ref-1">↑</a></p></li></ol>';

describe('extrairNotas', () => {
  it('remove a <ol> final e mapeia id->texto (sem a seta de volta)', () => {
    const { html, notas } = extrairNotas(CORPO);
    expect(html).not.toContain('<ol>');
    expect(html).not.toContain('<li id="footnote-');
    expect(html).toContain('href="#footnote-0"'); // chamada no corpo permanece
    expect(notas['0']).toBe('STF, ADI 123.');
    expect(notas['1']).toBe('Súmula 456.');
  });

  it('devolve html intacto quando não há notas', () => {
    const out = extrairNotas('<p>sem notas</p>');
    expect(out.html).toBe('<p>sem notas</p>');
    expect(out.notas).toEqual({});
  });
});

describe('anexarNotas', () => {
  it('anexa só as notas referenciadas, na ordem, com o rótulo do corpo', () => {
    const { notas } = extrairNotas(CORPO);
    const secao = '<p>cita<sup><a href="#footnote-1" id="footnote-ref-1">[2]</a></sup>.</p>';
    const out = anexarNotas(secao, notas);
    expect(out).toContain('<strong>Notas</strong>');
    expect(out).toContain('<sup>[2]</sup> Súmula 456.');
    expect(out).not.toContain('STF, ADI 123.'); // nota 0 não é citada nesta seção
  });

  it('não anexa nada quando a seção não cita notas', () => {
    const { notas } = extrairNotas(CORPO);
    expect(anexarNotas('<p>nada aqui</p>', notas)).toBe('<p>nada aqui</p>');
  });
});
