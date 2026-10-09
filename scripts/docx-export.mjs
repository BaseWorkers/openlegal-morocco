const encoder = new TextEncoder();
const markdownEntities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

function plainInlineText(text) {
  return text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 ($2)').replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/`([^`\n]+)`/g, '$1').replace(/\\([\\`*_{}\[\]()#+\-.!|])/g, '$1').replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (entity) => markdownEntities[entity]);
}

function xmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}

function inlineRuns(text, rtl) {
  const output = [];
  const tokenPattern = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
  let cursor = 0;
  for (const match of text.matchAll(tokenPattern)) {
    if (match.index > cursor) output.push(run(text.slice(cursor, match.index), rtl));
    const token = match[0];
    output.push(run(token.startsWith('**') ? token.slice(2, -2) : token.slice(1, -1), rtl, token.startsWith('**')));
    cursor = match.index + token.length;
  }
  if (cursor < text.length) output.push(run(text.slice(cursor), rtl));
  return output.join('') || run('', rtl);
}

function run(text, rtl, bold = false) {
  const clean = plainInlineText(text);
  return `<w:r><w:rPr>${bold ? '<w:b/><w:bCs/>' : ''}${rtl ? '<w:rtl/>' : ''}<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:lang w:val="en-US" w:bidi="ar"/></w:rPr><w:t xml:space="preserve">${xmlEscape(clean)}</w:t></w:r>`;
}

function tableCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function isTableDivider(line) {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseBlocks(markdown) {
  const lines = markdown.split(/\r?\n/).filter((line) => !/^<!-- section: [a-z0-9-]+ -->$/.test(line.trim()));
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) { blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] }); index += 1; continue; }
    if (/^\s*[-*_]{3,}\s*$/.test(line)) { blocks.push({ type: 'rule' }); index += 1; continue; }
    const listItem = /^\s*(?:([-*+])\s+|(\d+)\.\s+)(.*)$/.exec(line);
    if (listItem) {
      const ordered = Boolean(listItem[2]);
      while (index < lines.length) {
        const item = /^\s*(?:([-*+])\s+|(\d+)\.\s+)(.*)$/.exec(lines[index]);
        if (!item || Boolean(item[2]) !== ordered) break;
        blocks.push({ type: 'list', ordered, text: item[3] });
        index += 1;
      }
      continue;
    }
    if (line.includes('|') && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const headers = tableCells(line);
      const rows = [headers];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) { rows.push(tableCells(lines[index])); index += 1; }
      blocks.push({ type: 'table', rows });
      continue;
    }
    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s+/.test(lines[index]) && !/^\s*(?:[-*+]\s+|\d+\.\s+)/.test(lines[index]) && !(lines[index].includes('|') && index + 1 < lines.length && isTableDivider(lines[index + 1])) && !/^\s*[-*_]{3,}\s*$/.test(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }
  return blocks;
}

function paragraph(text, rtl, style = '', numbering = '') {
  const pPr = `${style ? `<w:pStyle w:val="${style}"/>` : ''}${rtl ? '<w:bidi/>' : ''}${numbering ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numbering}"/></w:numPr>` : ''}`;
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${inlineRuns(text, rtl)}</w:p>`;
}

function renderTable(rows, rtl) {
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  const cell = (text, heading = false) => `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr>${rtl ? '<w:bidi/>' : ''}</w:pPr>${inlineRuns(text, rtl, heading)}</w:p></w:tc>`;
  const grid = Array.from({ length: columnCount }, () => '<w:gridCol w:w="2400"/>').join('');
  const tableRows = rows.map((row, rowIndex) => `<w:tr>${Array.from({ length: columnCount }, (_item, cellIndex) => cell(row[cellIndex] ?? '', rowIndex === 0)).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${rtl ? '<w:bidiVisual/>' : ''}<w:tblBorders><w:top w:val="single" w:sz="4" w:color="9AAAB5"/><w:left w:val="single" w:sz="4" w:color="9AAAB5"/><w:bottom w:val="single" w:sz="4" w:color="9AAAB5"/><w:right w:val="single" w:sz="4" w:color="9AAAB5"/><w:insideH w:val="single" w:sz="4" w:color="9AAAB5"/><w:insideV w:val="single" w:sz="4" w:color="9AAAB5"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${tableRows}</w:tbl>`;
}

export function createDocxXmlParts(template, language, markdown) {
  const rtl = language === 'ar';
  const title = template.metadata.title[language];
  const blocks = parseBlocks(markdown);
  const body = blocks.map((block) => {
    if (block.type === 'heading') return paragraph(block.text, rtl, `Heading${Math.min(block.level, 3)}`);
    if (block.type === 'list') return paragraph(block.text, rtl, '', block.ordered ? '2' : '1');
    if (block.type === 'table') return renderTable(block.rows, rtl);
    if (block.type === 'rule') return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:color="9AAAB5"/></w:pBdr></w:pPr><w:r><w:t> </w:t></w:r></w:p>';
    return paragraph(block.text, rtl);
  }).join('');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>${rtl ? '<w:bidi/>' : ''}</w:sectPr></w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US" w:bidi="ar"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${[1, 2, 3].map((level) => `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${level === 1 ? 360 : 240}" w:after="120"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="${level === 1 ? 32 : level === 2 ? 28 : 24}"/><w:szCs w:val="${level === 1 ? 32 : level === 2 ? 28 : 24}"/></w:rPr></w:style>`).join('')}</w:styles>`;
  const listAlignment = rtl ? 'right' : 'left';
  const listIndent = rtl ? '<w:ind w:right="720" w:hanging="360"/>' : '<w:ind w:left="720" w:hanging="360"/>';
  const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="${listAlignment}"/><w:pPr>${listIndent}</w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="${listAlignment}"/><w:pPr>${listIndent}</w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pStyle w:val="Footer"/>${rtl ? '<w:bidi/>' : ''}</w:pPr><w:r><w:rPr>${rtl ? '<w:rtl/>' : ''}<w:color w:val="526474"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${xmlEscape(`OpenLegal · ${template.metadata.id} · v${template.metadata.version} · ${language}`)}</w:t></w:r></w:p></w:ftr>`;
  const footerStyle = '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/></w:style>';
  const finalStylesXml = stylesXml.replace('</w:styles>', `${footerStyle}</w:styles>`);
  const contentTypesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
  const rootRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';
  const documentRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>';
  return {
    '[Content_Types].xml': contentTypesXml,
    '_rels/.rels': rootRelsXml,
    'word/document.xml': documentXml,
    'word/styles.xml': finalStylesXml,
    'word/numbering.xml': numberingXml,
    'word/footer1.xml': footerXml,
    'word/_rels/document.xml.rels': documentRelsXml,
    'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xmlEscape(title)}</dc:title><dc:creator>OpenLegal</dc:creator></cp:coreProperties>`
  };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const checksum = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); localView.setUint16(4, 20, true); localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true); localView.setUint16(10, 0, true); localView.setUint16(12, 0x21, true);
    localView.setUint32(14, checksum, true); localView.setUint32(18, data.length, true); localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true); localView.setUint16(28, 0, true);
    local.set(nameBytes, 30); local.set(data, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true); centralView.setUint16(4, 20, true); centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true); centralView.setUint16(10, 0, true); centralView.setUint16(12, 0, true); centralView.setUint16(14, 0x21, true);
    centralView.setUint32(16, checksum, true); centralView.setUint32(20, data.length, true); centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true); centralView.setUint16(30, 0, true); centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true); centralView.setUint16(36, 0, true); centralView.setUint32(38, 0, true); centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46); centralParts.push(central);
    offset += local.length;
  }
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, centralParts.length, true); endView.setUint16(10, centralParts.length, true);
  endView.setUint32(12, centralSize, true); endView.setUint32(16, offset, true); endView.setUint16(20, 0, true);
  const output = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const part of localParts) { output.set(part, cursor); cursor += part.length; }
  for (const part of centralParts) { output.set(part, cursor); cursor += part.length; }
  output.set(end, cursor);
  return output;
}

export function createDocxBytes(template, language, markdown) {
  return zipStore(createDocxXmlParts(template, language, markdown));
}

export function createPlainText(template, language, markdown) {
  const blocks = parseBlocks(markdown);
  let previousList = null;
  let orderedIndex = 0;
  const text = blocks.map((block) => {
    if (block.type !== 'list') { previousList = null; orderedIndex = 0; }
    if (block.type === 'heading' || block.type === 'paragraph') return plainInlineText(block.text);
    if (block.type === 'rule') return '────────────────────────';
    if (block.type === 'table') return block.rows.map((row) => row.map(plainInlineText).join('\t')).join('\n');
    if (previousList !== block.ordered) orderedIndex = 0;
    previousList = block.ordered;
    orderedIndex += 1;
    return `${block.ordered ? `${orderedIndex}.` : '•'} ${plainInlineText(block.text)}`;
  }).filter(Boolean).join('\n\n');
  return `${text}\n\nOpenLegal · ${template.metadata.id} · v${template.metadata.version} · ${language}\n`;
}
