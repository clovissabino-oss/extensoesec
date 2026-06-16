// test/fatiarSecoes.test.js
import { describe, it, expect } from 'vitest';
import { fatiarSecoes } from '../fatiarSecoes.js';

const html =
  '<h1>Apresentação</h1>' +
  '<p>Olá <strong>pessoal</strong></p>' +
  '<p><img src="data:image/png;base64,AAAA"></p>' +
  '<h1>Noções basilares</h1>' +
  '<h2>Conceito</h2>' +
  '<ul><li>a</li></ul>' +
  '<table><tr><td>x</td></tr></table>';

describe('fatiarSecoes', () => {
  it('cria uma seção por <h1> (padrão: dividir por título)', () => {
    const s = fatiarSecoes(html);
    expect(s).toHaveLength(2);
    expect(s[0].titulo).toBe('Apresentação');
    expect(s[1].titulo).toBe('Noções basilares');
  });

  it('no modo subtítulo, também corta nos <h2>', () => {
    const s = fatiarSecoes(html, 'subtitulo');
    expect(s).toHaveLength(3); // Apresentação | Noções basilares | Conceito
    expect(s.map((x) => x.titulo)).toEqual(['Apresentação', 'Noções basilares', 'Conceito']);
    expect(s[2].html).toContain('<ul><li>a</li></ul>'); // conteúdo do subtítulo fica no bloco dele
  });

  it('inclui o título e o conteúdo no html da seção', () => {
    const s = fatiarSecoes(html);
    expect(s[0].html).toContain('<h1>Apresentação</h1>');
    expect(s[0].html).toContain('<strong>pessoal</strong>');
    expect(s[1].html).toContain('<h2>Conceito</h2>');
  });

  it('conta parágrafos, imagens, listas e tabelas', () => {
    const s = fatiarSecoes(html);
    expect(s[0].resumo).toEqual({ paragrafos: 2, imagens: 1, listas: 0, tabelas: 0 });
    expect(s[1].resumo).toEqual({ paragrafos: 0, imagens: 0, listas: 1, tabelas: 1 });
  });

  it('conteúdo antes do primeiro h1 vira uma seção sem título', () => {
    const s = fatiarSecoes('<p>intro</p><h1>T</h1><p>x</p>');
    expect(s).toHaveLength(2);
    expect(s[0].titulo).toBe('');
    expect(s[0].html).toContain('<p>intro</p>');
  });
});
