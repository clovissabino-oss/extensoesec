/* popup.js — orquestra: ler arquivo -> parsear -> preview -> enviar p/ content script */

let blocosAtuais = [];

const $file = document.getElementById('file');
const $drop = document.getElementById('drop');
const $preview = document.getElementById('preview');
const $status = document.getElementById('status');
const $injetar = document.getElementById('injetar');

$drop.addEventListener('dragover', (e) => { e.preventDefault(); });
$drop.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.files[0]) processar(e.dataTransfer.files[0]);
});
$file.addEventListener('change', () => { if ($file.files[0]) processar($file.files[0]); });

async function processar(file) {
  if (!file.name.endsWith('.docx')) { $status.textContent = 'Selecione um .docx'; return; }
  $status.textContent = 'Lendo documento...';
  try {
    const buffer = await file.arrayBuffer();
    blocosAtuais = await Parser.docxParaBlocos(buffer);
    renderPreview(blocosAtuais);
    $status.textContent = `${blocosAtuais.length} blocos prontos.`;
    $injetar.disabled = blocosAtuais.length === 0;
  } catch (err) {
    console.error(err);
    $status.textContent = 'Erro ao ler o arquivo.';
  }
}

function renderPreview(blocos) {
  $preview.innerHTML = '';
  blocos.forEach((b) => {
    const div = document.createElement('div');
    div.className = 'bloco';
    const label = b.tipo === 'titulo' ? `título h${b.nivel}` : b.tipo;
    div.innerHTML = `<span class="tag">${label}</span>${(b.texto || b.tipo).slice(0, 80)}`;
    $preview.appendChild(div);
  });
}

$injetar.addEventListener('click', async () => {
  $status.textContent = 'Injetando...';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { acao: 'INJETAR_BLOCOS', blocos: blocosAtuais }, (resp) => {
    $status.textContent = resp?.ok ? `Injetados ${resp.qtd} blocos.` : 'Falhou — veja o console da página (F12).';
  });
});
