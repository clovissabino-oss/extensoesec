// Preservação do tamanho de exibição das imagens (corrige "corujas/imagens grandes").
import { describe, it, expect } from 'vitest';
import { aplicarTamanhos } from '../imagens.js';

describe('aplicarTamanhos', () => {
  const mapa = { AAAA: { w: 79, h: 88 } };

  it('aplica width/height (px) na imagem cujo base64 está no mapa', () => {
    const out = aplicarTamanhos('<p><img src="data:image/png;base64,AAAA"></p>', mapa);
    expect(out).toContain('width="79"');
    expect(out).toContain('height="88"');
    expect(out).toContain('width:79px;height:88px');
  });

  it('não altera imagem fora do mapa', () => {
    const html = '<p><img src="data:image/png;base64,ZZZZ"></p>';
    expect(aplicarTamanhos(html, mapa)).toBe(html);
  });

  it('substitui width/height antigos pelos corretos', () => {
    const out = aplicarTamanhos('<img width="500" height="600" src="data:image/png;base64,AAAA">', mapa);
    expect(out).not.toContain('500');
    expect(out).toContain('width="79"');
  });

  it('sem mapa, não altera nada', () => {
    const html = '<img src="data:image/png;base64,AAAA">';
    expect(aplicarTamanhos(html, null)).toBe(html);
  });
});
