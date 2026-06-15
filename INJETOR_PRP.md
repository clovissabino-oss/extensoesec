# PRP — Injetor LDI (importador de .docx para o editor de Livro Digital Interativo)

> Documento de planejamento para conduzir a construção no Claude Code.
> Stack do app: **extensão de navegador (Manifest V3)** + **mammoth.js**. Não é projeto Lovable — exige rodar código dentro da página do editor, o que só uma extensão (ou bookmarklet) faz.

## 1. Objetivo

Importar conteúdo de um arquivo **.docx** e reproduzi-lo automaticamente nos **blocos de texto** dos itens do editor de LDI do Estratégia, eliminando a digitação manual bloco a bloco. Opcionalmente, reordenar capítulos/itens (o injetor original já fazia isso — os logs `cap.X posicionado (Nx↑)`).

## 2. Como o injetor original funciona (reconstruído dos vídeos)

É uma **extensão de navegador com content script** (o log `Content Script: Initializing` confirma). O fluxo é:

1. **Lê o .docx no navegador** e converte em estrutura semântica (títulos, parágrafos, imagens, tabelas).
2. **Mapeia** essa estrutura para o modelo de blocos do LDI.
3. **Escreve** os blocos dentro do item aberto no editor.
4. **Reordena** capítulos/itens no fim (a automação que aparece no console do 2º vídeo).

Plataforma-alvo: SPA em **Vue + Vite**, ícones RemixIcon, drag-and-drop com **vuedraggable/Sortable**, IDs em **UUID + team_id** (multi-tenant). Editor de texto rico no padrão **TipTap/ProseMirror**.

## 3. Como injetar — SEM API

Não há chave/API interna. O injetor roda na **sua própria sessão logada** e dirige o editor pelo front-end, como se você colasse conteúdo. Toda a "auth" é o seu navegador já autenticado.

Técnica principal: **simular colagem (paste)**. O editor é ProseMirror/TipTap — ele ignora `innerHTML` direto (tem estado próprio), mas escuta o evento `paste`. Montamos o HTML dos blocos e disparamos um `ClipboardEvent('paste')`; o ProseMirror parseia para os nós dele, preservando títulos, parágrafos, negrito, listas e tabelas.

Vantagens: zero engenharia reversa de endpoint, não quebra com mudança de backend, usa o próprio fluxo de salvar do editor.

## 4. Reconhecimento (bem mais leve agora)

O MVP (colar tudo num bloco em foco) **não precisa de recon nenhum** — já funciona. O recon só é necessário para a V2 (separar em blocos distintos + reordenar). Abrir o editor → DevTools → aba **Elementos**, e capturar:

- [ ] Seletor do **editor de texto** (provável `.ProseMirror`) — confirmar.
- [ ] Seletor do botão **"Adicionar bloco"**.
- [ ] Seletor do botão **"subir"** de um item (para replicar o `posicionado (Nx↑)`).
- [ ] Como os blocos de um item se aninham no DOM (tirar um print do HTML de 1 bloco).

> Entregue ao Claude Code o **HTML de 1 bloco** (botão direito → "Copiar elemento" no DevTools) — com isso ele implementa a V2 inteira.

## 5. Regras de mapeamento docx → bloco (ajustável)

- `H1` → nome do item **ou** título de seção (decidir).
- `H2` / `H3` → bloco de subtítulo dentro do item.
- parágrafo (`<p>`) → bloco de texto (preserva `<strong>`, `<em>`, links).
- `<ul>`/`<ol>` → bloco de lista.
- `<table>` → bloco de tabela.
- imagem → bloco de imagem (atenção: imagem vem em base64; talvez precise subir via endpoint de upload antes — verificar no recon).

## 6. Esqueleto entregue (ponto de partida)

```
injetor-ldi/
├── manifest.json        # MV3 — AJUSTAR host_permissions com o domínio real
├── popup.html           # UI de upload + preview dos blocos
├── popup.js             # lê arquivo, parseia, dispara injeção
├── parser.js            # docx -> blocos normalizados (PRONTO, testado)
├── content.js           # injeção — Estratégia A (API) e B (DOM) como stubs
└── vendor/
    └── mammoth.browser.min.js
```

Já funciona: upload do .docx → parsing → preview dos blocos. Falta: preencher a injeção após o recon.

## 7. Fases de construção (sugestão para o Claude Code)

1. **Validar parsing** — carregar a extensão (chrome://extensions → modo dev → "carregar sem compactação"), abrir o popup, subir um .docx e conferir o preview. *(já funciona com o esqueleto)*
2. **Injeção MVP** — clicar dentro do bloco de texto do item, clicar "Injetar"; o conteúdo é colado via `paste` simulado. *(já implementado no `content.js`)*
3. **Recon leve** — capturar os seletores da seção 4 (HTML de 1 bloco, botão "Adicionar bloco", botão "subir").
4. **Bloco a bloco** — separar o docx em blocos distintos do LDI (adicionar bloco → esperar render → colar).
5. **Reordenação** — replicar o `posicionado (Nx↑)` clicando "subir" N vezes.
6. **Robustez** — dry-run (preview antes de gravar), tratamento de erro, log por bloco.

## 8. Cuidados práticos

- A ferramenta **escreve no sistema de conteúdo de produção**. Vale alinhar com o Diogo (TI) antes de rodar em massa, e sempre testar em um item descartável primeiro.
- `host_permissions` deve apontar **só** para o domínio do admin do LDI — nada de `<all_urls>`.
- Comece sempre com **dry-run** (só preview) antes de habilitar a gravação.

## 9. Prompt inicial para o Claude Code

> "Tenho um esqueleto de extensão MV3 (`injetor-ldi/`) que lê um .docx com mammoth, gera blocos normalizados e os injeta no editor de LDI do Estratégia (Vue+Vite, ProseMirror/TipTap) **sem API**, via simulação de `paste`. O MVP (colar tudo num bloco em foco) já funciona. Quero a V2: separar em blocos distintos e reordenar capítulos. Vou colar o HTML de 1 bloco do editor [colar do DevTools]. Implemente o fluxo bloco-a-bloco (adicionar bloco → esperar render → colar) e a reordenação clicando 'subir' N vezes, com dry-run e log por bloco."
