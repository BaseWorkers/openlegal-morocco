import { findTemplateVariables } from './template-package-utils.mjs';

export function translationStructure(markdown) {
  const markers = [...markdown.matchAll(/^<!-- section: ([a-z0-9-]+) -->\s*$/gm)];
  const sections = markers.map((marker, index) => {
    const start = marker.index + marker[0].length;
    const end = markers[index + 1]?.index ?? markdown.length;
    return { id: marker[1], body: markdown.slice(start, end) };
  });
  const sectionContentPresence = sections.map(({ id, body }) => {
    const content = body
      .replace(/^#{1,6}\s+.*$/gm, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '')
      .trim();
    return [id, content.length > 0];
  });
  return {
    sections: sections.map(({ id }) => id),
    sectionContentPresence,
    variablesBySection: sections.map(({ id, body }) => [id, [...new Set(findTemplateVariables(body))].sort()]),
    headingLevels: [...markdown.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match) => ({
      level: match[1].length,
      number: match[2].match(/^(\d+(?:\.\d+)*)(?:[.)\s-]|$)/)?.[1] ?? null
    })),
    headingsBySection: sections.map(({ id, body }) => [id, [...body.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match) => ({
      level: match[1].length,
      number: match[2].match(/^(\d+(?:\.\d+)*)(?:[.)\s-]|$)/)?.[1] ?? null
    }))])
  };
}

export function compareTranslationStructure(referenceMarkdown, translatedMarkdown) {
  const reference = translationStructure(referenceMarkdown);
  const translated = translationStructure(translatedMarkdown);
  const errors = [];
  if (JSON.stringify(translated.sections) !== JSON.stringify(reference.sections)) errors.push('section structure differs');
  if (reference.sectionContentPresence.some(([, hasContent]) => !hasContent) || translated.sectionContentPresence.some(([, hasContent]) => !hasContent)) {
    errors.push('every marked section must contain content beyond its heading');
  }
  if (JSON.stringify(translated.sectionContentPresence) !== JSON.stringify(reference.sectionContentPresence)) errors.push('section content presence differs');
  if (JSON.stringify(translated.variablesBySection) !== JSON.stringify(reference.variablesBySection)) errors.push('section variable placement differs');
  if (JSON.stringify(translated.headingLevels) !== JSON.stringify(reference.headingLevels)) errors.push('heading levels or numbered heading sequence differs');
  if (JSON.stringify(translated.headingsBySection) !== JSON.stringify(reference.headingsBySection)) errors.push('heading placement within sections differs');
  return errors;
}
