// test/parser.test.js
import { describe, it, expect } from 'vitest';
import { removerImagens } from '../parser.js';

describe('removerImagens', () => {
  it('remove tags <img> do html', () => {
    const html = '<p>a</p><p><img src="data:image/png;base64,AAAA"></p>';
    expect(removerImagens(html)).toBe('<p>a</p><p></p>');
  });
  it('mantém o html quando não há imagem', () => {
    expect(removerImagens('<p>a</p>')).toBe('<p>a</p>');
  });
});
