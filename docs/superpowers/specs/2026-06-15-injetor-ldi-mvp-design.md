# Spec — Injetor LDI (MVP bloco-a-bloco)

> Data: 2026-06-15
> Stack: Extensão de navegador Manifest V3 + mammoth.js. Sem API: dirige o editor pela sessão logada.
> Objetivo de entrega: extensão funcional para a **equipe de cadastro** importar `.docx` de aulas do Estratégia para os blocos do editor de Livro Digital Interativo (LDI), preservando formatação e imagens, com **um bloco de texto novo a cada tarja azul**.

## 1. Objetivo

Eliminar a digitação manual bloco a bloco no editor de LDI. A pessoa sobe um `.docx` de aula, revê um preview e injeta o conteúdo no item aberto do editor. Cada **tarja azul** (título de seção da aula) vira um **bloco de texto novo**; todo o conteúdo entre tarjas (parágrafos, subtítulos, negrito, listas, tabelas e imagens/esquemas) entra no bloco daquela seção, com a formatação preservada.

Escopo desta entrega (MVP): **apenas injeção**. Fora de escopo: reordenação de capítulos/itens (o `cap.X posicionado (Nx↑)` do 2º vídeo) — fica para uma V2.

## 2. Recon confirmado (fatos que fundamentam o design)

Inspeção do arquivo real `Aula modelo (1).docx`:

- **Tarja azul = parágrafo com fundo `<w:shd w:fill="4231A4">`** no `w:pPr`. Sinal cirúrgico: nesta aula há exatamente 2 (`"Apresentação"` e `"Noções basilares da Constituição e os Princípios Fundamentais"`), com **0 falsos positivos** — apesar de a cor `4231a4` aparecer ~2533× em bordas e fontes (essas usam `w:color`, não `w:shd w:fill`).
- **Subtítulos não têm fundo azul** (ex.: `"Conceito de Constituição"`) → **não** quebram bloco; ficam dentro do bloco como título secundário.
- **Sem estilos nomeados no corpo** (`pStyle` = 0): é tudo formatação direta. Consequência: o `mammoth` sozinho não detecta os títulos — o parser precisa **marcar** as tarjas antes de converter.
- **20 imagens** embutidas como arquivos reais (PNG/JPG em `word/media`). O `mammoth` as entrega como `data:` URI (base64), preserváveis na colagem.

## 3. Arquitetura e fluxo

```
popup.html/js  →  UI: subir .docx, preview por seção, confirmar, injetar, resumo
   │  (lê arquivo → parser → envia seções via chrome.tabs.sendMessage)
parser.js      →  docx → SEÇÕES normalizadas (marca tarjas → mammoth → fatia por <h1>)
   │
content.js     →  roda na página do editor; injeção bloco-a-bloco via paste simulado;
                  log por seção; devolve {ok, qtd, erros} ao popup
```

Sem backend, sem API. A "auth" é a sessão já logada no navegador. `host_permissions` restrito aos domínios do Estratégia (nada de `<all_urls>`).

## 4. `parser.js` — fatiar por tarja azul

1. **Marcar tarjas:** ler `word/document.xml` do `.docx`; para cada parágrafo cujo `w:pPr` contenha `<w:shd ... w:fill="4231A4">` (case-insensitive), injetar `<w:pStyle w:val="Heading1"/>` no `w:pPr` (o `styles.xml` já define `Heading1` com nome "heading 1"). Reescrever o zip em memória.
2. **Converter:** `mammoth.convertToHtml` com `styleMap` mapeando `p[style-name='heading 1'] => h1:fresh` (e Heading 2/3 → h2/h3 para subtítulos). Imagens via conversor padrão (`data:` base64) — com opção de descartar.
3. **Fatiar:** percorrer o HTML resultante; cada `<h1>` (tarja) inicia uma **seção**. Conteúdo até a próxima `<h1>` entra na seção corrente.
   - Conteúdo antes da 1ª tarja (caso exista) → vai para a 1ª seção (colada no bloco em foco).
4. **Saída:** `Array<Secao>` onde `Secao = { titulo: string, html: string, resumo: { paragrafos, imagens, listas, tabelas } }`.

## 5. `content.js` — injeção bloco-a-bloco

Técnica: **simular colagem** (`ClipboardEvent('paste')`) — o editor é ProseMirror/TipTap; ignora `innerHTML`, mas escuta `paste` e parseia para os nós dele, preservando títulos, negrito, listas, tabelas e imagens.

Para cada seção, na ordem:
1. **1ª seção:** cola no editor **em foco** (onde a pessoa clicou). Se nenhum bloco estiver focado, erro claro: *"Clique dentro do bloco de texto do item antes de injetar."*
2. **Seções seguintes:** localizar o botão **"Adicionar bloco"** *pelo texto visível* (varredura por `textContent`, robusto a mudança de classes CSS) → clicar → aguardar o novo editor renderizar (`MutationObserver`, util `esperarPor`) → focar o editor recém-criado (último `.ProseMirror`/`[contenteditable]`) → colar.
3. **Log por seção:** `console.log('[Injetor LDI] seção i/N "titulo" colada ✓')`; acumular erros sem abortar o lote.
4. **Fim:** `alert('Injetado! Confira e clique em Salvar.')` e devolver `{ ok, qtd, erros }`.

Funções auxiliares: `acharEditorFocado()`, `acharBotaoPorTexto(texto)`, `esperarPor(seletor, timeout)`, `simularColagem(alvo, html, texto)`.

## 6. `popup.html/js` — UI e segurança

- Subir `.docx` (clique ou arrastar) → parser → **preview por seção** mostrando: nº de blocos e, por bloco, o título da tarja + contagem (`12 parágrafos, 3 imagens, 1 tabela`).
- Checkbox **"ignorar imagens"** (padrão: desmarcado = mantém imagens).
- Botão **"Injetar"** → **confirmação explícita** (`Vai colar N blocos no item em foco. Continuar?`) porque escreve em conteúdo de produção.
- **Resumo final:** `5 blocos colados, 0 erros.` (ou lista de erros por seção).

## 7. Formatação e imagens

- Mantém HTML rico na colagem: `h1/h2/h3`, `strong`, `em`, `ul/ol`, `table`, `a`, `img`.
- Imagens como `data:` base64 por padrão (comprovado funcionar no Vídeo 1).
- **Risco conhecido:** se o backend exigir upload de mídia, imagens base64 podem não persistir após "Salvar". Mitigação: checkbox "ignorar imagens" + instrução de **testar primeiro num item descartável**. Caso o risco se confirme, V2 trata upload via endpoint de mídia.

## 8. Distribuição e guia

- Entrega: pasta `injetor-ldi/` (ou `.zip`).
- `COMO-USAR.md` curto para a equipe de cadastro: instalar via `chrome://extensions` → Modo desenvolvedor → "Carregar sem compactação"; abrir o item no editor; clicar no bloco; abrir o popup; subir `.docx`; conferir preview; Injetar; conferir e Salvar. Com aviso destacado: **testar primeiro num item de teste**.
- `manifest.json`: `host_permissions` só para `*.estrategia.com` / `*.estrategiaconcursos.com.br`.

## 9. Critérios de sucesso

- [ ] Subir `Aula modelo (1).docx` no popup gera preview com **2 seções** (Apresentação; Noções basilares…), cada uma com a contagem correta de parágrafos/imagens.
- [ ] Injeção cria 1 bloco para a 1ª tarja (no foco) e clica "Adicionar bloco" para a 2ª, colando o conteúdo certo em cada um.
- [ ] Negrito, listas, tabelas e imagens aparecem no editor após a colagem.
- [ ] Erro claro quando nenhum bloco está em foco.
- [ ] Resumo final reporta nº de blocos e erros.
- [ ] `host_permissions` restrito aos domínios do Estratégia.

## 10. Riscos e cuidados

- Escreve em **conteúdo de produção** → sempre preview + confirmação + testar em item descartável; alinhar com TI (Diogo) antes de uso em massa.
- Seletor de "Adicionar bloco" por texto pode precisar de ajuste se o rótulo mudar; é o ponto mais provável de manutenção.
- Persistência de imagens base64 após Salvar é o maior risco funcional — validar cedo num item de teste.
