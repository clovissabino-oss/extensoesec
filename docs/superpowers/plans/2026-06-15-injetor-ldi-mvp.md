# Injetor LDI (MVP bloco-a-bloco) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma extensão MV3 que importa um `.docx` de aula do Estratégia e injeta o conteúdo no editor de LDI, criando **um bloco de texto novo a cada tarja azul** e preservando formatação e imagens, via `paste` simulado — sem API.

**Architecture:** O parser marca cada parágrafo-tarja (`<w:shd w:fill="4231A4">`) como `Heading1` dentro do `.docx`, deixa o `mammoth` converter para HTML (emitindo `<h1>` nas tarjas), e fatia o HTML em seções por `<h1>`. O `content.js` injeta seção por seção no editor ProseMirror/TipTap simulando colagem, clicando "Adicionar bloco" (achado pelo texto) entre as seções. O `popup.js` orquestra: upload → preview → confirmação → injeção → resumo.

**Tech Stack:** JavaScript vanilla, Manifest V3, mammoth.js (browser), JSZip (browser + node). Testes: Vitest + jsdom (lógica pura do parser e helpers), validação manual no navegador (integração com o editor real).

**Spec:** `docs/superpowers/specs/2026-06-15-injetor-ldi-mvp-design.md`

---

## Estrutura de arquivos

```
injetor-ldi/
├── manifest.json          # MV3 (já existe) — revisar host_permissions
├── popup.html             # UI (já existe) — adicionar checkbox + contadores
├── popup.js               # orquestra (já existe) — preview por seção, confirmar, resumo
├── parser.js              # orquestrador (já existe) — refatorar p/ usar os 2 módulos abaixo
├── marcarTarjas.js        # NOVO — marca parágrafos-tarja como Heading1 no docx
├── fatiarSecoes.js        # NOVO — HTML do mammoth → seções por <h1>
├── content.js             # injeção (já existe) — reescrever p/ bloco-a-bloco
├── vendor/
│   ├── mammoth.browser.min.js   # já existe
│   └── jszip.min.js             # NOVO — vendorizar
├── COMO-USAR.md           # NOVO — guia da equipe de cadastro
├── package.json           # NOVO — devDeps de teste
├── vitest.config.js       # NOVO
├── test/
│   ├── setup.js                 # NOVO — expõe JSZip global p/ jsdom
│   ├── marcarTarjas.test.js     # NOVO
│   ├── fatiarSecoes.test.js     # NOVO
│   └── acharBotaoPorTexto.test.js # NOVO
└── Aula modelo (1).docx   # fixture real (já existe)
```

Padrão de export dual em todo arquivo de lógica (funciona como `<script>` no browser e como módulo nos testes):

```js
if (typeof window !== 'undefined') { window.NomeDoModulo = api; }
if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
```

O `package.json` **não** terá `"type": "module"` → os fontes são CommonJS para os testes e scripts simples para o browser. Os arquivos de teste usam `import` (o Vitest transforma).

---

## Task 0: Setup do ambiente de testes

**Files:**
- Create: `injetor-ldi/package.json`
- Create: `injetor-ldi/vitest.config.js`
- Create: `injetor-ldi/test/setup.js`
- Create: `injetor-ldi/vendor/jszip.min.js`

- [ ] **Step 0: Inicializar o repositório git** (a pasta ainda não é um repo)

Run:
```bash
cd "injetor-ldi"
git init
git config user.name "Clovis Sabino" && git config user.email "limajrsab@gmail.com"
```
Expected: `Initialized empty Git repository`. (Se já houver `.git`, este passo é no-op.)

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "injetor-ldi",
  "version": "0.2.0",
  "private": true,
  "description": "Injetor LDI — importa .docx para o editor de Livro Digital Interativo do Estratégia.",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^3.2.4",
    "jsdom": "^25.0.1",
    "jszip": "^3.10.1",
    "mammoth": "^1.8.0"
  }
}
```

- [ ] **Step 2: Instalar dependências**

Run: `cd "injetor-ldi" && npm install`
Expected: cria `node_modules/` e `package-lock.json`, sem erros.

- [ ] **Step 3: Criar `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.js']
  }
});
```

- [ ] **Step 4: Criar `test/setup.js`** (expõe JSZip como global, como no browser)

```js
import JSZip from 'jszip';
globalThis.JSZip = JSZip;
```

- [ ] **Step 5: Vendorizar JSZip para o browser**

Run: `cd "injetor-ldi" && node -e "const fs=require('fs');fs.copyFileSync(require.resolve('jszip/dist/jszip.min.js'),'vendor/jszip.min.js');console.log('ok')"`
Expected: imprime `ok` e cria `vendor/jszip.min.js`.

- [ ] **Step 6: Commit**

```bash
cd "injetor-ldi"
printf "node_modules/\n" > .gitignore
git add package.json package-lock.json vitest.config.js test/setup.js vendor/jszip.min.js .gitignore
git commit -m "chore: setup vitest + jszip para testes do injetor"
```

---

## Task 1: `marcarTarjas.js` — marcar tarjas azuis como Heading1

**Files:**
- Create: `injetor-ldi/marcarTarjas.js`
- Test: `injetor-ldi/test/marcarTarjas.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
// test/marcarTarjas.test.js
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import { marcarTarjas, marcarTarjasDocx } from '../marcarTarjas.js';

describe('marcarTarjas (string)', () => {
  it('injeta pStyle Heading1 num parágrafo com fundo 4231A4', () => {
    const xml =
      '<w:p><w:pPr><w:shd w:val="clear" w:fill="4231A4"/></w:pPr>' +
      '<w:r><w:t>Titulo</w:t></w:r></w:p>';
    const out = marcarTarjas(xml);
    expect(out).toContain('<w:pStyle w:val="Heading1"/>');
    // pStyle deve vir logo após a abertura do pPr
    expect(out.indexOf('<w:pStyle')).toBeLessThan(out.indexOf('<w:shd'));
  });

  it('NÃO marca parágrafo onde 4231A4 é só cor de borda', () => {
    const xml =
      '<w:p><w:pPr><w:pBdr><w:left w:color="4231A4"/></w:pBdr></w:pPr>' +
      '<w:r><w:t>Texto</w:t></w:r></w:p>';
    expect(marcarTarjas(xml)).not.toContain('<w:pStyle');
  });
});

describe('marcarTarjasDocx + mammoth (fixture real)', () => {
  it('produz exatamente 2 <h1> com os títulos das tarjas', async () => {
    const buf = fs.readFileSync(path.join(__dirname, '..', 'Aula modelo (1).docx'));
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const marcado = await marcarTarjasDocx(ab);
    // NOTA: o mammoth no Node exige { buffer: Buffer }, não { arrayBuffer }.
    // No browser, parser.js usa { arrayBuffer } com o mammoth.browser — correto lá.
    const { value: html } = await mammoth.convertToHtml({ buffer: Buffer.from(marcado) });
    const h1s = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
    expect(h1s).toHaveLength(2);
    expect(h1s[0]).toContain('Apresentação');
    expect(h1s[1]).toContain('Noções basilares da Constituição');
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd "injetor-ldi" && npx vitest run test/marcarTarjas.test.js`
Expected: FAIL — `Failed to resolve import '../marcarTarjas.js'`.

- [ ] **Step 3: Implementar `marcarTarjas.js`**

```js
/**
 * marcarTarjas.js
 * No .docx do Estratégia a "tarja azul" (título de seção) é um parágrafo cujo
 * <w:pPr> tem fundo <w:shd ... w:fill="4231A4">. O documento NÃO usa estilos
 * nomeados, então o mammoth não detecta títulos sozinho. Aqui marcamos cada
 * parágrafo-tarja com <w:pStyle w:val="Heading1"/> para o mammoth emitir <h1>.
 */

const FILL_TARJA = /<w:shd\b[^>]*w:fill="4231[aA]4"/;

/** Marca o document.xml (string). Pura e testável. */
function marcarTarjas(documentXml) {
  return documentXml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (par) => {
    const ppr = par.match(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/);
    if (!ppr) return par;
    const bloco = ppr[0];
    if (!FILL_TARJA.test(bloco)) return par;       // fundo azul só conta no pPr
    if (/<w:pStyle\b/.test(bloco)) return par;      // não duplica estilo
    const novo = bloco.replace(/<w:pPr\b[^>]*>/, (abre) => abre + '<w:pStyle w:val="Heading1"/>');
    return par.replace(bloco, novo);
  });
}

/** Recebe o .docx (ArrayBuffer), marca as tarjas e devolve novo ArrayBuffer. */
async function marcarTarjasDocx(arrayBuffer) {
  const Zip = (typeof JSZip !== 'undefined') ? JSZip : (await import('jszip')).default;
  const zip = await Zip.loadAsync(arrayBuffer);
  const xml = await zip.file('word/document.xml').async('string');
  zip.file('word/document.xml', marcarTarjas(xml));
  return zip.generateAsync({ type: 'arraybuffer' });
}

const api = { marcarTarjas, marcarTarjasDocx };
if (typeof window !== 'undefined') { window.MarcarTarjas = api; }
if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd "injetor-ldi" && npx vitest run test/marcarTarjas.test.js`
Expected: PASS (4 asserts). Se `toHaveLength(2)` falhar, o número impresso revela quantas tarjas o mammoth detectou — ajuste de detecção antes de seguir.

- [ ] **Step 5: Commit**

```bash
cd "injetor-ldi"
git add marcarTarjas.js test/marcarTarjas.test.js
git commit -m "feat: marcarTarjas detecta tarja azul (shd fill 4231A4) como Heading1"
```

---

## Task 2: `fatiarSecoes.js` — HTML → seções por `<h1>`

**Files:**
- Create: `injetor-ldi/fatiarSecoes.js`
- Test: `injetor-ldi/test/fatiarSecoes.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
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
  it('cria uma seção por <h1>', () => {
    const s = fatiarSecoes(html);
    expect(s).toHaveLength(2);
    expect(s[0].titulo).toBe('Apresentação');
    expect(s[1].titulo).toBe('Noções basilares');
  });

  it('inclui o título e o conteúdo no html da seção', () => {
    const s = fatiarSecoes(html);
    expect(s[0].html).toContain('<h1>Apresentação</h1>');
    expect(s[0].html).toContain('<strong>pessoal</strong>');
    expect(s[1].html).toContain('<h2>Conceito</h2>'); // subtítulo fica DENTRO do bloco
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
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd "injetor-ldi" && npx vitest run test/fatiarSecoes.test.js`
Expected: FAIL — `Failed to resolve import '../fatiarSecoes.js'`.

- [ ] **Step 3: Implementar `fatiarSecoes.js`**

```js
/**
 * fatiarSecoes.js
 * Recebe o HTML produzido pelo mammoth (com <h1> nas tarjas) e devolve uma lista
 * de seções. Cada <h1> inicia uma seção; todo o conteúdo até o próximo <h1>
 * (parágrafos, subtítulos h2/h3, listas, tabelas, imagens) entra naquela seção.
 * Conteúdo antes do primeiro <h1> vira uma seção sem título.
 */

function contar(elementos) {
  let paragrafos = 0, imagens = 0, listas = 0, tabelas = 0;
  for (const el of elementos) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'p') paragrafos++;
    if (tag === 'ul' || tag === 'ol') listas++;
    if (tag === 'table') tabelas++;
    imagens += el.querySelectorAll('img').length + (tag === 'img' ? 1 : 0);
  }
  return { paragrafos, imagens, listas, tabelas };
}

function fatiarSecoes(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const secoes = [];
  let atual = null;
  for (const el of Array.from(doc.body.children)) {
    const ehTarja = el.tagName.toLowerCase() === 'h1';
    if (ehTarja || !atual) {
      atual = { titulo: '', elementos: [] };
      secoes.push(atual);
      if (ehTarja) atual.titulo = el.textContent.trim();
    }
    atual.elementos.push(el);
  }
  return secoes.map((s) => ({
    titulo: s.titulo,
    html: s.elementos.map((e) => e.outerHTML).join('\n'),
    resumo: contar(s.elementos)
  }));
}

const api = { fatiarSecoes };
if (typeof window !== 'undefined') { window.FatiarSecoes = api; }
if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd "injetor-ldi" && npx vitest run test/fatiarSecoes.test.js`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
cd "injetor-ldi"
git add fatiarSecoes.js test/fatiarSecoes.test.js
git commit -m "feat: fatiarSecoes divide o HTML em blocos por tarja (<h1>)"
```

---

## Task 3: Refatorar `parser.js` — orquestrar marcação → mammoth → fatiamento

**Files:**
- Modify: `injetor-ldi/parser.js` (substituir conteúdo)
- Test: estende `injetor-ldi/test/marcarTarjas.test.js` não é necessário; cobertura via Task 1/2. Adicionar teste de `removerImagens`.
- Test: `injetor-ldi/test/parser.test.js` (NOVO)

- [ ] **Step 1: Escrever o teste que falha**

```js
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
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd "injetor-ldi" && npx vitest run test/parser.test.js`
Expected: FAIL — `removerImagens` não existe.

- [ ] **Step 3: Reescrever `parser.js`**

```js
/**
 * parser.js
 * Orquestra: .docx -> (marca tarjas) -> mammoth (HTML) -> fatia em seções.
 * Cada seção vira um bloco no editor de LDI. Funciona 100% offline (só o .docx).
 *
 * No browser, depende dos globais: MarcarTarjas, FatiarSecoes, mammoth.
 */

/** Remove imagens do HTML (usado quando a pessoa marca "ignorar imagens"). */
function removerImagens(html) {
  return html.replace(/<img\b[^>]*>/gi, '');
}

const Parser = {
  /**
   * @param {ArrayBuffer} arrayBuffer  conteúdo bruto do .docx
   * @param {{ ignorarImagens?: boolean }} [opts]
   * @returns {Promise<Array<{titulo:string, html:string, resumo:object}>>}
   */
  async docxParaSecoes(arrayBuffer, opts = {}) {
    const marcado = await MarcarTarjas.marcarTarjasDocx(arrayBuffer);
    const { value: html } = await mammoth.convertToHtml(
      { arrayBuffer: marcado },
      {
        styleMap: [
          "p[style-name='heading 1'] => h1:fresh",
          "p[style-name='heading 2'] => h2:fresh",
          "p[style-name='heading 3'] => h3:fresh"
        ]
      }
    );
    let secoes = FatiarSecoes.fatiarSecoes(html);
    if (opts.ignorarImagens) {
      secoes = secoes.map((s) => ({
        ...s,
        html: removerImagens(s.html),
        resumo: { ...s.resumo, imagens: 0 }
      }));
    }
    return secoes;
  }
};

const api = { Parser, removerImagens };
if (typeof window !== 'undefined') { window.Parser = Parser; }
if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd "injetor-ldi" && npx vitest run test/parser.test.js`
Expected: PASS (2 testes).

- [ ] **Step 5: Rodar a suíte toda**

Run: `cd "injetor-ldi" && npm test`
Expected: PASS em todos os arquivos (marcarTarjas, fatiarSecoes, parser).

- [ ] **Step 6: Commit**

```bash
cd "injetor-ldi"
git add parser.js test/parser.test.js
git commit -m "refactor: parser orquestra marcação de tarjas, mammoth e fatiamento"
```

---

## Task 4: Reescrever `content.js` — injeção bloco-a-bloco

**Files:**
- Modify: `injetor-ldi/content.js` (substituir conteúdo)
- Test: `injetor-ldi/test/acharBotaoPorTexto.test.js`

- [ ] **Step 1: Escrever o teste que falha (helper puro de DOM)**

```js
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
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd "injetor-ldi" && npx vitest run test/acharBotaoPorTexto.test.js`
Expected: FAIL — `acharBotaoPorTexto` não exportado (ou `chrome is not defined` se o listener não estiver guardado — o Step 3 trata os dois).

- [ ] **Step 3: Reescrever `content.js`**

```js
/**
 * content.js — roda DENTRO da página do editor de LDI.
 * SEM API. Injeta seção por seção via colagem simulada (ClipboardEvent 'paste').
 * Cada seção = um bloco. A 1ª vai no editor em foco; as demais, em "Adicionar bloco".
 */

const TEXTO_BOTAO_BLOCO = 'adicionar bloco';

/** Acha um elemento clicável cujo texto contém `texto` (case-insensitive). */
function acharBotaoPorTexto(texto) {
  const alvo = texto.trim().toLowerCase();
  const cands = document.querySelectorAll('button,[role="button"],a,span,div');
  let melhor = null;
  for (const el of cands) {
    const t = (el.textContent || '').trim().toLowerCase();
    if (t.includes(alvo)) {
      // prefere o menor (mais específico) que ainda contém o texto
      if (!melhor || (el.textContent || '').length < (melhor.textContent || '').length) melhor = el;
    }
  }
  return melhor;
}

/** Editor em foco; senão, o primeiro da página. */
function acharEditorFocado() {
  return (
    document.querySelector('.ProseMirror-focused') ||
    document.activeElement?.closest?.('.ProseMirror,[contenteditable="true"]') ||
    document.querySelector('.ProseMirror,[contenteditable="true"]')
  );
}

/** Espera um elemento aparecer (sincroniza com a renderização do Vue). */
function esperarPor(fn, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const achado = fn();
    if (achado) return resolve(achado);
    const obs = new MutationObserver(() => {
      const el = fn();
      if (el) { obs.disconnect(); resolve(el); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); reject(new Error('timeout')); }, timeout);
  });
}

/** Simula colagem de HTML no ProseMirror/TipTap. */
function simularColagem(alvo, html, texto) {
  alvo.focus();
  const dt = new DataTransfer();
  dt.setData('text/html', html);
  dt.setData('text/plain', texto || '');
  alvo.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Injeta as seções, uma por bloco. Devolve { qtd, erros }. */
async function injetarSecoes(secoes) {
  const editorInicial = acharEditorFocado();
  if (!editorInicial) {
    throw new Error('Editor não encontrado. Clique dentro do bloco de texto do item antes de injetar.');
  }
  const erros = [];
  let qtd = 0;
  for (let i = 0; i < secoes.length; i++) {
    const sec = secoes[i];
    try {
      let editor;
      if (i === 0) {
        editor = editorInicial;
      } else {
        const botao = acharBotaoPorTexto(TEXTO_BOTAO_BLOCO);
        if (!botao) throw new Error('Botão "Adicionar bloco" não encontrado.');
        const antes = document.querySelectorAll('.ProseMirror,[contenteditable="true"]').length;
        botao.click();
        await esperarPor(() => {
          const eds = document.querySelectorAll('.ProseMirror,[contenteditable="true"]');
          return eds.length > antes ? eds[eds.length - 1] : null;
        });
        await espera(150); // deixa o editor montar
        const eds = document.querySelectorAll('.ProseMirror,[contenteditable="true"]');
        editor = eds[eds.length - 1];
      }
      simularColagem(editor, sec.html, sec.titulo);
      qtd++;
      console.log(`[Injetor LDI] seção ${i + 1}/${secoes.length} "${sec.titulo || '(sem título)'}" colada ✓`);
      await espera(120);
    } catch (e) {
      console.error(`[Injetor LDI] falha na seção ${i + 1}:`, e);
      erros.push({ secao: i + 1, titulo: sec.titulo, msg: e.message });
    }
  }
  alert('Injetado! Confira e clique em Salvar.');
  return { qtd, erros };
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  console.log('[Injetor LDI] Content script inicializado.');
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.acao !== 'INJETAR_SECOES') return;
    injetarSecoes(msg.secoes)
      .then(({ qtd, erros }) => sendResponse({ ok: true, qtd, erros }))
      .catch((e) => sendResponse({ ok: false, erro: e.message }));
    return true; // resposta assíncrona
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { acharBotaoPorTexto, acharEditorFocado, esperarPor, simularColagem, injetarSecoes };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd "injetor-ldi" && npx vitest run test/acharBotaoPorTexto.test.js`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
cd "injetor-ldi"
git add content.js test/acharBotaoPorTexto.test.js
git commit -m "feat: content.js injeta seção por seção (bloco-a-bloco) via paste simulado"
```

---

## Task 5: `popup.html` + `popup.js` — preview por seção, opções, confirmação, resumo

**Files:**
- Modify: `injetor-ldi/popup.html`
- Modify: `injetor-ldi/popup.js`

- [ ] **Step 1: Atualizar `popup.html`** (adicionar checkbox de imagens e carregar os novos scripts)

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <style>
    :root { --roxo: #4231a4; }
    body { width: 380px; font-family: system-ui, sans-serif; margin: 0; padding: 16px; color: #1a1a2e; }
    h1 { font-size: 15px; margin: 0 0 12px; }
    .drop { border: 2px dashed #cbd5e1; border-radius: 10px; padding: 18px; text-align: center; font-size: 13px; color: #64748b; cursor: pointer; }
    .drop:hover { border-color: var(--roxo); color: var(--roxo); }
    label.opt { display: flex; gap: 6px; align-items: center; font-size: 12px; color: #334155; margin-top: 10px; }
    button { width: 100%; margin-top: 10px; padding: 10px; border: 0; border-radius: 8px; background: var(--roxo); color: #fff; font-weight: 600; cursor: pointer; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    #preview { margin-top: 12px; max-height: 240px; overflow: auto; font-size: 12px; border-top: 1px solid #eee; padding-top: 8px; }
    .bloco { padding: 6px 8px; margin: 4px 0; border-radius: 6px; background: #f3f1fb; }
    .tag { display: inline-block; font-size: 10px; font-weight: 700; color: var(--roxo); text-transform: uppercase; margin-right: 6px; }
    .meta { color: #64748b; }
    #status { font-size: 12px; color: #64748b; margin-top: 8px; min-height: 16px; }
  </style>
</head>
<body>
  <h1>Injetor LDI — importar .docx</h1>
  <label class="drop" id="drop">
    Clique ou arraste o arquivo .docx aqui
    <input id="file" type="file" accept=".docx" hidden />
  </label>
  <label class="opt"><input type="checkbox" id="ignorarImagens" /> Ignorar imagens (colar só o texto)</label>
  <div id="status"></div>
  <div id="preview"></div>
  <button id="injetar" disabled>Injetar no item atual</button>

  <script src="vendor/jszip.min.js"></script>
  <script src="vendor/mammoth.browser.min.js"></script>
  <script src="marcarTarjas.js"></script>
  <script src="fatiarSecoes.js"></script>
  <script src="parser.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Reescrever `popup.js`**

```js
/* popup.js — ler .docx -> parser -> preview por seção -> confirmar -> injetar -> resumo */

let secoesAtuais = [];

const $file = document.getElementById('file');
const $drop = document.getElementById('drop');
const $preview = document.getElementById('preview');
const $status = document.getElementById('status');
const $injetar = document.getElementById('injetar');
const $ignorar = document.getElementById('ignorarImagens');

$drop.addEventListener('dragover', (e) => e.preventDefault());
$drop.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.files[0]) processar(e.dataTransfer.files[0]);
});
$file.addEventListener('change', () => { if ($file.files[0]) processar($file.files[0]); });
$ignorar.addEventListener('change', () => { if ($file.files[0]) processar($file.files[0]); });

async function processar(file) {
  if (!file.name.toLowerCase().endsWith('.docx')) { $status.textContent = 'Selecione um arquivo .docx'; return; }
  $status.textContent = 'Lendo documento...';
  try {
    const buffer = await file.arrayBuffer();
    secoesAtuais = await Parser.docxParaSecoes(buffer, { ignorarImagens: $ignorar.checked });
    renderPreview(secoesAtuais);
    $status.textContent = `${secoesAtuais.length} bloco(s) pronto(s).`;
    $injetar.disabled = secoesAtuais.length === 0;
  } catch (err) {
    console.error(err);
    $status.textContent = 'Erro ao ler o arquivo.';
  }
}

function renderPreview(secoes) {
  $preview.innerHTML = '';
  secoes.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'bloco';
    const r = s.resumo;
    const partes = [];
    if (r.paragrafos) partes.push(`${r.paragrafos} parágrafos`);
    if (r.imagens) partes.push(`${r.imagens} imagens`);
    if (r.listas) partes.push(`${r.listas} listas`);
    if (r.tabelas) partes.push(`${r.tabelas} tabelas`);
    div.innerHTML =
      `<span class="tag">Bloco ${i + 1}</span>${s.titulo || '(sem título)'}` +
      `<br><span class="meta">${partes.join(' · ') || 'vazio'}</span>`;
    $preview.appendChild(div);
  });
}

$injetar.addEventListener('click', async () => {
  if (!confirm(`Vai colar ${secoesAtuais.length} bloco(s) no item em foco. Continuar?`)) return;
  $status.textContent = 'Injetando...';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { acao: 'INJETAR_SECOES', secoes: secoesAtuais }, (resp) => {
    if (chrome.runtime.lastError) { $status.textContent = 'Abra o editor do LDI na aba ativa e tente de novo.'; return; }
    if (!resp?.ok) { $status.textContent = `Falhou: ${resp?.erro || 'veja o console (F12)'}`; return; }
    const nErros = resp.erros?.length || 0;
    $status.textContent = `${resp.qtd} bloco(s) colado(s), ${nErros} erro(s).` + (nErros ? ' Veja o console (F12).' : '');
  });
});
```

- [ ] **Step 3: Verificação manual no navegador** (integração real — não há como automatizar contra o editor autenticado)

```
1. cd injetor-ldi && npm test   → tudo verde
2. chrome://extensions → Modo desenvolvedor → "Carregar sem compactação" → pasta injetor-ldi
3. Abrir um ITEM DE TESTE descartável no editor de LDI (admin.estrategia.com)
4. Clicar dentro do bloco de texto do item
5. Abrir o popup → subir "Aula modelo (1).docx"
   ✔ Preview mostra 2 blocos: "Apresentação" e "Noções basilares..." com contagens
6. Clicar "Injetar" → confirmar
   ✔ Alerta "Injetado! Confira e clique em Salvar."
   ✔ Bloco 1 no item em foco; bloco 2 criado via "Adicionar bloco"
   ✔ Negrito, listas, tabelas e imagens presentes
7. Marcar "Ignorar imagens" e repetir → blocos sem imagens
8. Clicar dentro de NENHUM bloco e injetar → erro claro pedindo para focar o bloco
9. Salvar no editor; recarregar a página
   ✔ Conteúdo persistiu. ATENÇÃO: confirmar se as IMAGENS persistiram (maior risco).
```

- [ ] **Step 4: Commit**

```bash
cd "injetor-ldi"
git add popup.html popup.js
git commit -m "feat: popup com preview por bloco, ignorar imagens, confirmação e resumo"
```

---

## Task 6: Manifest, guia da equipe e distribuição no GitHub

**Files:**
- Modify: `injetor-ldi/manifest.json`
- Create: `injetor-ldi/COMO-USAR.md`

- [ ] **Step 1: Atualizar `manifest.json`** (versão; host restrito; o conteúdo já injeta apenas via mensagem do popup)

```json
{
  "manifest_version": 3,
  "name": "Injetor LDI — Estratégia",
  "version": "0.2.0",
  "description": "Importa um .docx de aula para os blocos do editor de Livro Digital Interativo, um bloco por tarja azul.",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": [
    "https://*.estrategia.com/*",
    "https://*.estrategiaconcursos.com.br/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Injetor LDI"
  },
  "content_scripts": [
    {
      "matches": [
        "https://*.estrategia.com/*",
        "https://*.estrategiaconcursos.com.br/*"
      ],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

- [ ] **Step 2: Criar `COMO-USAR.md`**

```markdown
# Injetor LDI — Como usar (equipe de cadastro)

Importa o conteúdo de um `.docx` de aula para os blocos do editor de Livro
Digital Interativo. **Cada tarja azul** da aula vira **um bloco de texto novo**.

## Instalar (uma vez)
1. Baixe a pasta do injetor (no GitHub: **Code → Download ZIP**) e descompacte.
2. Abra `chrome://extensions`.
3. Ative o **Modo desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e selecione a pasta `injetor-ldi`.

## Usar
1. Abra o **item** da aula no editor do LDI (admin.estrategia.com).
2. **Clique dentro do bloco de texto** do item (é onde o 1º bloco será colado).
3. Clique no ícone do **Injetor LDI** na barra do Chrome.
4. **Suba o `.docx`** (clique ou arraste). Confira o **preview**: ele lista os
   blocos e quantos parágrafos/imagens/listas/tabelas cada um tem.
5. (Opcional) Marque **"Ignorar imagens"** se quiser colar só o texto.
6. Clique **Injetar** e confirme.
7. Confira o conteúdo e clique em **Salvar** no editor.

## ⚠️ Importante
- **Teste primeiro num item descartável.** A ferramenta escreve em conteúdo de produção.
- Depois de Salvar, **recarregue a página e confira se as imagens persistiram**.
  Se sumirem, refaça marcando "Ignorar imagens" e suba as imagens manualmente.
- Se aparecer "Editor não encontrado", você esqueceu de clicar dentro do bloco (passo 2).
```

- [ ] **Step 3: Commit**

```bash
cd "injetor-ldi"
git add manifest.json COMO-USAR.md
git commit -m "docs: manifest 0.2.0 + guia COMO-USAR para a equipe de cadastro"
```

- [ ] **Step 4: Publicar no GitHub** (CHECKPOINT — precisa das credenciais do usuário)

```bash
cd "injetor-ldi"
git branch -M main
git remote add origin https://github.com/clovissabino-oss/extensoesec.git
git push -u origin main
```

Se o push pedir autenticação: o usuário deve concluir o login do GitHub (token/credential
manager). Confirmar com o usuário antes de executar este passo — não publicar sem o ok dele.
Verificar depois: o repositório mostra a pasta com `manifest.json`, e **Code → Download ZIP**
entrega a extensão pronta para a equipe.

---

## Notas de manutenção
- **Ponto mais provável de ajuste:** o rótulo do botão "Adicionar bloco" (`TEXTO_BOTAO_BLOCO`
  em `content.js`). Se a plataforma mudar o texto, ajuste essa constante.
- **Maior risco funcional:** persistência das imagens base64 após Salvar. Validar cedo (Task 5, passo 9).
- **Seletor do editor:** `.ProseMirror` / `[contenteditable="true"]`. Se a plataforma trocar o editor, revisar `acharEditorFocado`.
```
