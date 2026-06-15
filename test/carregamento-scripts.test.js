// @vitest-environment node
// Regressão: os scripts do popup são <script> CLÁSSICOS e compartilham o MESMO
// escopo global da página. Se dois arquivos declararem `const` de mesmo nome no
// topo, o 2º quebra com "Identifier already declared" e o global (ex. window.Parser)
// nunca é definido — daí o erro "Parser is not defined". Este teste carrega os três
// arquivos num único contexto vm (como o Chrome faz) e exige que window.Parser exista.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

describe('carregamento dos scripts do popup (escopo global compartilhado)', () => {
  it('os scripts coexistem e definem window.Parser.docxParaSecoes', () => {
    const ctx = { window: {}, JSZip: function () {}, mammoth: {}, DOMParser: function () {}, console };
    vm.createContext(ctx);
    for (const f of ['cores.js', 'marcarTarjas.js', 'fatiarSecoes.js', 'parser.js']) {
      const codigo = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
      expect(() => vm.runInContext(codigo, ctx, { filename: f })).not.toThrow();
    }
    expect(typeof ctx.window.Cores).toBe('object');
    expect(typeof ctx.window.MarcarTarjas).toBe('object');
    expect(typeof ctx.window.FatiarSecoes).toBe('object');
    expect(typeof ctx.window.Parser?.docxParaSecoes).toBe('function');
  });
});
