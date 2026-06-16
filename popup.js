/* popup.js — ler .docx -> parser -> preview por seção -> confirmar -> injetar -> resumo */

let secoesAtuais = [];

const $file = document.getElementById('file');
const $drop = document.getElementById('drop');
const $preview = document.getElementById('preview');
const $status = document.getElementById('status');
const $injetar = document.getElementById('injetar');
const $ignorar = document.getElementById('ignorarImagens');
const $dividir = document.getElementById('dividirPor');

$drop.addEventListener('dragover', (e) => e.preventDefault());
$drop.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.files[0]) processar(e.dataTransfer.files[0]);
});
$file.addEventListener('change', () => { if ($file.files[0]) processar($file.files[0]); });
$ignorar.addEventListener('change', () => { if ($file.files[0]) processar($file.files[0]); });
$dividir.addEventListener('change', () => { if ($file.files[0]) processar($file.files[0]); });

async function processar(file) {
  if (!file.name.toLowerCase().endsWith('.docx')) { $status.textContent = 'Selecione um arquivo .docx'; return; }
  $status.textContent = 'Lendo documento...';
  try {
    const buffer = await file.arrayBuffer();
    secoesAtuais = await Parser.docxParaSecoes(buffer, { ignorarImagens: $ignorar.checked, dividirPor: $dividir.value });
    renderPreview(secoesAtuais);
    $status.textContent = `${secoesAtuais.length} bloco(s) pronto(s).`;
    $injetar.disabled = secoesAtuais.length === 0;
  } catch (err) {
    console.error('[Injetor LDI] erro ao processar o .docx:', err);
    const msg = (err && err.message) ? err.message : String(err);
    $status.textContent = 'Erro ao ler o arquivo: ' + msg;
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
  if (!confirm(`Vai criar ${secoesAtuais.length} bloco(s) (um por título) no item. Continuar?`)) return;
  $injetar.disabled = true; // evita injeção duplicada por cliques repetidos
  $status.textContent = 'Injetando...';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // Garante que o content script está presente NESTA aba (não depende de F5/timing).
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    chrome.tabs.sendMessage(tab.id, { acao: 'INJETAR_SECOES', secoes: secoesAtuais }, (resp) => {
      $injetar.disabled = false;
      if (chrome.runtime.lastError) { $status.textContent = 'Falha ao falar com a página: ' + chrome.runtime.lastError.message; return; }
      if (!resp?.ok) { $status.textContent = `Falhou: ${resp?.erro || 'veja o console (F12)'}`; return; }
      const nErros = resp.erros?.length || 0;
      $status.textContent = `${resp.qtd} bloco(s) colado(s)` + (nErros ? `, ${nErros} com erro (F12).` : '. Confira e clique em Salvar.');
    });
  } catch (e) {
    $injetar.disabled = false;
    $status.textContent = 'Não consegui injetar nesta aba: ' + e.message + ' — abra o editor do LDI e tente de novo.';
  }
});
