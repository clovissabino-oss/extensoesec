// test/acharBotaoPorTexto.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { acharBotaoPorTexto } from '../content.js';

beforeEach(() => { document.body.innerHTML = ''; });

describe('acharBotaoPorTexto', () => {
  it('acha o elemento cujo texto contém o alvo (case-insensitive)', () => {
    document.body.innerHTML =
      '<button>Salvar</button><div role="button">＋ Adicionar bloco</div>';
    const el = acharBotaoPorTexto('adicionar bloco');
    expect(el).not.toBeNull();
    expect(el.textContent.toLowerCase()).toContain('adicionar bloco');
  });

  it('retorna null quando não há correspondência', () => {
    document.body.innerHTML = '<button>Salvar</button>';
    expect(acharBotaoPorTexto('adicionar bloco')).toBeNull();
  });
});
