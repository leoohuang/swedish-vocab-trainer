import { cleanBilingualPair } from '../shared/word-format';
import Papa from 'papaparse';
import { uid } from './model';
import type { Draft } from './model';
export const DEMO = `# 我的瑞典语课堂笔记\n\nen bok - 书，böcker\nett äpple — 苹果\näta / 吃 / åt / ätit\nvacker 美丽的\nfika：喝咖啡小憩\nen vän = 朋友\nläsa\n阅读\njobba - 工作\nlagom  恰到好处\nlängta efter / 想念；渴望\nett fönster - 窗户\nsjälvklart - 当然\n\nJag tycker om kaffe. 我喜欢咖啡。\nbehöver kolla med läraren\n`;
const chinese = /[\u3400-\u9fff]/;
const termHeader = /^(瑞典语|单词|词条|svenska|swedish|word|term)$/i;
const meaningHeader = /^(中文|释义|意思|翻译|meaning|translation|chinese|betydelse|english|英语)$/i;
function draft(
  term: string,
  meaning: string,
  note: string,
  source: string,
  location: string,
): Draft {
  if (Math.max(term.length, meaning.length, note.length, source.length, location.length) > 20000)
    throw new Error('某一行内容超过 20000 个字符，请分段后再导入。');
  term = term.replace(/^\s*(?:[-*•]|\d+[.)、])\s*/, '').trim();
  ({ term, meaning } = cleanBilingualPair(term, meaning));
  const sentence = /[.!?]$/.test(term) || term.split(/\s+/).length > 6;
  const issue = !term
    ? '缺少瑞典语词条'
    : !meaning
      ? '缺少释义，请补充'
      : chinese.test(term)
        ? '请检查词条与释义是否颠倒'
        : sentence
          ? '可能是句子，请确认是否练习'
          : '';
  return {
    id: uid(),
    term,
    meaning: meaning.trim(),
    note: note.trim(),
    source,
    location,
    selected: !issue,
    issue,
  };
}
export function parseText(text: string, origin = '粘贴笔记'): Draft[] {
  const lines = text.replace(/\r\n?/g, '\n').normalize('NFC').split('\n');
  const result: Draft[] = [];
  for (let i = 0; i < lines.length; i++) {
    const source = lines[i].trim();
    if (!source) continue;
    if (/^#/.test(source)) {
      const row = draft(source, '', '', source, `${origin} · 第 ${i + 1} 行`);
      row.issue = '标题或注释，不参与练习';
      result.push(row);
      continue;
    }
    const clean = source.replace(/^\s*(?:[-*•]|\d+[.)、])\s*/, '').replace(/^\|\s*|\s*\|$/g, '');
    if (/^[-|:\s]+$/.test(clean)) continue;
    if (clean.includes('\t') || clean.includes('|')) {
      const parts = clean.split(/\t|\s*\|\s*/).map((p) => p.trim());
      if (termHeader.test(parts[0]) && meaningHeader.test(parts[1] || '')) continue;
      result.push(
        draft(
          parts[0],
          parts[1] || '',
          parts.slice(2).join(' · '),
          source,
          `${origin} · 第 ${i + 1} 行`,
        ),
      );
      continue;
    }
    const zh = clean.search(chinese);
    const separator = /\s+(?:[-–—=]|\/)\s+|\s*[:：=]\s*|\s*\/\s*/;
    let parts = clean.split(separator).filter(Boolean);
    let term = '',
      meaning = '',
      note = '';
    if (parts.length >= 2) {
      [term, meaning] = parts;
      note = parts.slice(2).join(' · ');
    } else if (zh > 0) {
      term = clean.slice(0, zh).replace(/[\s:：,，;；—–-]+$/, '');
      meaning = clean.slice(zh);
    } else if (zh === 0) {
      result.push(draft('', clean, '', source, `${origin} · 第 ${i + 1} 行`));
      continue;
    } else {
      term = clean;
      const next = lines[i + 1]?.trim();
      if (next && chinese.test(next) && next.search(chinese) === 0) {
        meaning = next;
        i++;
      }
    }
    // Keep explicit forms as notes instead of treating them as part of the meaning.
    const forms = meaning.match(/^(.+?)[，,]\s*([A-Za-zÅÄÖåäö][A-Za-zÅÄÖåäö\s,/-]*)$/);
    if (forms) {
      meaning = forms[1];
      note = [forms[2], note].filter(Boolean).join(' · ');
    }
    result.push(
      draft(
        term,
        meaning,
        note,
        meaning && lines[i].trim() !== source ? `${source}\n${lines[i].trim()}` : source,
        `${origin} · 第 ${i + 1 - (source !== lines[i].trim() ? 1 : 0)} 行`,
      ),
    );
  }
  return result;
}
export function parseRows(rows: unknown[][], origin: string): Draft[] {
  const normalized = rows.map((row) => row.map((cell) => String(cell ?? '').trim()));
  const header = normalized[0] || [];
  const ti = header.findIndex((h) => termHeader.test(h));
  const mi = header.findIndex((h) => meaningHeader.test(h));
  if (ti >= 0 && mi >= 0)
    return normalized.slice(1).flatMap((row, i) =>
      row.every((c) => !c)
        ? []
        : [
            draft(
              row[ti] || '',
              row[mi] || '',
              row
                .filter((_, j) => j !== ti && j !== mi)
                .filter(Boolean)
                .join(' · '),
              row.join(' | '),
              `${origin} · 第 ${i + 2} 行`,
            ),
          ],
    );
  return normalized.flatMap((row, i) =>
    row.every((c) => !c)
      ? []
      : row.length >= 2
        ? [
            draft(
              row[0],
              row[1],
              row.slice(2).filter(Boolean).join(' · '),
              row.join(' | '),
              `${origin} · 第 ${i + 1} 行`,
            ),
          ]
        : parseText(row[0], `${origin} · 第 ${i + 1} 行`),
  );
}
export async function readFile(file: File): Promise<Draft[]> {
  if (file.size > 10 * 1024 * 1024) throw new Error('文件请控制在 10 MB 以内，可以拆成几份导入。');
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['txt', 'md'].includes(ext || '')) return parseText(await file.text(), file.name);
  if (ext === 'csv') {
    const csv = Papa.parse<string[]>(await file.text(), { skipEmptyLines: 'greedy' });
    if (csv.errors.length)
      throw new Error('CSV 格式无法完整读取，请检查引号与分隔符，或复制内容到文本框。');
    return parseRows(csv.data, file.name);
  }
  if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return parseText(result.value, file.name);
  }
  if (ext === 'xlsx') {
    const { default: readXlsx } = await import('read-excel-file/browser');
    const sheets = await readXlsx(file);
    const result: Draft[] = [];
    for (const sheet of sheets)
      result.push(...parseRows(sheet.data, `${file.name} / ${sheet.sheet}`));
    return result;
  }
  if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const loading = pdfjs.getDocument({ data: await file.arrayBuffer() });
    try {
      const pdf = await loading.promise;
      if (pdf.numPages > 80) throw new Error('PDF 请拆分为不超过 80 页后导入。');
      const result: Draft[] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const content = await (await pdf.getPage(p)).getTextContent();
        let text = '',
          lastY: number | undefined;
        for (const item of content.items)
          if ('str' in item) {
            const y = item.transform[5];
            if (lastY !== undefined && Math.abs(y - lastY) > 4) text += '\n';
            text += item.str + (item.hasEOL ? '\n' : ' ');
            lastY = y;
          }
        result.push(...parseText(text, `${file.name} · 第 ${p} 页`));
      }
      if (!result.length)
        throw new Error('未读到文字。这可能是扫描 PDF，当前版本请先转成文字再导入。');
      return result;
    } finally {
      await loading.destroy();
    }
  }
  throw new Error('支持 TXT、MD、CSV、XLSX、DOCX 和文字型 PDF。');
}

// Preserve continuous text before AI extraction; do not run the vocabulary heuristics first.
export function materialBlocks(
  text: string,
  origin = '粘贴材料',
): import('../shared/ai').SourceBlock[] {
  const normalized = text.replace(/\r\n?/g, '\n').normalize('NFC');
  if (!normalized.trim()) throw new Error('没有读到内容，请检查文件或粘贴文字。');
  if (normalized.length > 30000) throw new Error('每次 AI 整理最多 30000 字符，请将材料分段导入。');
  const blocks: import('../shared/ai').SourceBlock[] = [];
  let offset = 0;
  while (offset < normalized.length) {
    let end = Math.min(offset + 4500, normalized.length);
    if (end < normalized.length) {
      const last = normalized.lastIndexOf('\n', end);
      const space = normalized.lastIndexOf(' ', end);
      if (last > offset + 2000) end = last + 1;
      else if (space > offset + 2000) end = space + 1;
    }
    const value = normalized.slice(offset, end);
    if (value.trim())
      blocks.push({
        id: `b${blocks.length + 1}`,
        text: value,
        location: `${origin} · 片段 ${blocks.length + 1}`.slice(0, 300),
      });
    offset = end;
  }
  return blocks;
}
export async function readMaterial(file: File): Promise<import('../shared/ai').SourceBlock[]> {
  if (file.size > 10 * 1024 * 1024) throw new Error('文件请控制在 10 MB 以内，可以拆成几份导入。');
  const ext = file.name.split('.').pop()?.toLowerCase();
  let sections: { text: string; location: string }[] = [];
  if (['txt', 'md'].includes(ext || ''))
    sections = [{ text: await file.text(), location: file.name }];
  else if (ext === 'csv') {
    const csv = Papa.parse<string[]>(await file.text(), { skipEmptyLines: 'greedy' });
    if (csv.errors.length) throw new Error('CSV 格式不完整，请检查引号，或直接粘贴材料。');
    sections = [{ text: csv.data.map((row) => row.join('\t')).join('\n'), location: file.name }];
  } else if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    sections = [{ text: result.value, location: file.name }];
  } else if (ext === 'xlsx') {
    const { default: readXlsx } = await import('read-excel-file/browser');
    for (const sheet of await readXlsx(file))
      sections.push({
        text: sheet.data.map((row) => row.map((c) => String(c ?? '')).join('\t')).join('\n'),
        location: `${file.name} / ${sheet.sheet}`,
      });
  } else if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = (
      await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    ).default;
    const loading = pdfjs.getDocument({ data: await file.arrayBuffer() });
    try {
      const pdf = await loading.promise;
      if (pdf.numPages > 80) throw new Error('PDF 请拆分为不超过 80 页后导入。');
      for (let p = 1; p <= pdf.numPages; p++) {
        const content = await (await pdf.getPage(p)).getTextContent();
        let text = '',
          lastY: number | undefined;
        for (const item of content.items)
          if ('str' in item) {
            const y = item.transform[5];
            if (lastY !== undefined && Math.abs(y - lastY) > 4) text += '\n';
            text += item.str + (item.hasEOL ? '\n' : ' ');
            lastY = y;
          }
        if (text.trim()) sections.push({ text, location: `${file.name} · 第 ${p} 页` });
      }
    } finally {
      await loading.destroy();
    }
    if (!sections.length)
      throw new Error('未读到文字。这可能是扫描 PDF，当前版本请先转成文字再导入。');
  } else throw new Error('支持 TXT、MD、CSV、XLSX、DOCX 和文字型 PDF。');
  if (sections.reduce((a, s) => a + s.text.length, 0) > 30000)
    throw new Error('每次 AI 整理最多 30000 字符，请将材料分段导入。');
  const blocks = sections
    .filter((s) => s.text.trim())
    .flatMap((s) => materialBlocks(s.text, s.location));
  if (!blocks.length) throw new Error('没有读到内容，请检查文件。');
  return blocks.map((b, i) => ({ ...b, id: `b${i + 1}` }));
}
