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
    // NOTE: mammoth in Node requires { buffer: Buffer }, not { arrayBuffer }.
    const { value: html } = await mammoth.convertToHtml({ buffer: Buffer.from(marcado) });
    const h1s = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
    expect(h1s).toHaveLength(2);
    expect(h1s[0]).toContain('Apresentação');
    expect(h1s[1]).toContain('Noções basilares da Constituição');
  });
});
