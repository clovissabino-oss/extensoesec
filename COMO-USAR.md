# Injetor LDI — Como usar (equipe de cadastro)

Importa o conteúdo de um `.docx` de aula para o editor de Livro Digital
Interativo, preservando formatação e imagens. **Cada tarja azul** da aula vira
**um bloco novo** (o 1º vai no bloco em foco; os demais são criados automaticamente).

## Instalar (uma vez)
1. Baixe a pasta do injetor (no GitHub: **Code → Download ZIP**) e descompacte.
2. Abra `chrome://extensions`.
3. Ative o **Modo desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e selecione a pasta `injetor-ldi`.

## Usar
1. Abra o **item** da aula no editor do LDI (admin.estrategia.com).
2. **Clique dentro do bloco de texto** do item (é onde o conteúdo será colado).
3. Clique no ícone do **Injetor LDI** na barra do Chrome.
4. **Suba o `.docx`** (clique ou arraste). Confira o **preview**: ele lista as
   seções e quantos parágrafos/imagens/listas/tabelas cada uma tem.
5. Escolha em **"Dividir blocos por"**: **Subtítulo** (um bloco por subtítulo —
   "Conceito de…", "Sentidos de…") ou **Título/tarja azul** (um bloco por seção).
6. (Opcional) Marque **"Ignorar imagens"** se quiser colar só o texto.
6. Clique **Injetar** e confirme.
7. Confira o conteúdo e clique em **Salvar** no editor.

## ⚠️ Importante
- **Use um item NOVO/limpo para cada aula.** A ferramenta escreve em conteúdo de
  produção; e colar por cima de um item já preenchido pode dar erro.
- Depois de Salvar, **recarregue a página e confira se as imagens persistiram**.
  Se sumirem, refaça marcando "Ignorar imagens" e suba as imagens manualmente.
- Se aparecer "Editor não encontrado", você esqueceu de clicar dentro do bloco (passo 2).
