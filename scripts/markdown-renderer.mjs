export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function renderInline(markdown) {
  const protectedParts = [];
  const protectedText = markdown.replace(/\{\{[a-z][a-z0-9_]*\}\}|`[^`\n]+`|\*\*[^*\n]+\*\*|(?:&amp;)*&(?:amp|lt|gt|quot|#39);/g, (token) => {
    const index = protectedParts.push(token) - 1;
    return `\u0000${index}\u0000`;
  });
  let html = escapeHtml(protectedText).replace(/\\([\\`*_{}\[\]()#+\-.!|])/g, (_match, character) => ({
    '[': '&#91;',
    ']': '&#93;',
    '(': '&#40;',
    ')': '&#41;'
  })[character] ?? character);
  return html.replace(/\u0000(\d+)\u0000/g, (_token, indexText) => {
    const token = protectedParts[Number(indexText)];
    if (/^(?:&amp;)*&(?:amp|lt|gt|quot|#39);$/.test(token)) return token.startsWith('&amp;') ? `&${token.slice(5)}` : token;
    if (token.startsWith('{{')) return `<code class="template-variable">${escapeHtml(token)}</code>`;
    if (token.startsWith('`')) return `<code>${escapeHtml(token.slice(1, -1))}</code>`;
    return `<strong>${escapeHtml(token.slice(2, -2))}</strong>`;
  });
}

function tableCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function isTableDivider(line) {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

export function renderMarkdownToHtml(markdown, { headingOffset = 1 } = {}) {
  const lines = markdown.split(/\r?\n/).filter((line) => !/^<!-- section: [a-z0-9-]+ -->$/.test(line.trim()));
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = Math.max(1, Math.min(6, heading[1].length + headingOffset));
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*[-*_]{3,}\s*$/.test(line)) {
      blocks.push('<hr>');
      index += 1;
      continue;
    }

    const listMatch = /^\s*(?:([-*+])\s+|(\d+)\.\s+)(.*)$/.exec(line);
    if (listMatch) {
      const ordered = Boolean(listMatch[2]);
      const tag = ordered ? 'ol' : 'ul';
      const items = [];
      while (index < lines.length) {
        const item = /^\s*(?:([-*+])\s+|(\d+)\.\s+)(.*)$/.exec(lines[index]);
        if (!item || Boolean(item[2]) !== ordered) break;
        items.push(`<li>${renderInline(item[3])}</li>`);
        index += 1;
      }
      blocks.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    if (line.includes('|') && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const headers = tableCells(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        const cells = tableCells(lines[index]);
        rows.push(`<tr>${headers.map((_header, cellIndex) => `<td>${renderInline(cells[cellIndex] ?? '')}</td>`).join('')}</tr>`);
        index += 1;
      }
      blocks.push(`<div class="table-scroll" tabindex="0" role="region" aria-label="Document table"><table><thead><tr>${headers.map((cell) => `<th scope="col">${renderInline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`);
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s+/.test(lines[index]) && !/^\s*(?:[-*+]\s+|\d+\.\s+)/.test(lines[index]) && !(lines[index].includes('|') && index + 1 < lines.length && isTableDivider(lines[index + 1])) && !/^\s*[-*_]{3,}\s*$/.test(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
  }
  return blocks.join('\n').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, escapedHref) => {
    const href = escapedHref.replace(/&amp;/g, '&');
    const safeExternal = /^https:\/\//i.test(href);
    const safeAnchor = /^#[a-z0-9_.:-]+$/i.test(href);
    const safeHtmlRoute = /^(?:\/|\.\.?\/)[^\s]*\.html(?:[?#][^\s]*)?$/i.test(href);
    return safeExternal || safeAnchor || safeHtmlRoute
      ? `<a href="${escapeHtml(href)}">${label}</a>`
      : label;
  });
}
