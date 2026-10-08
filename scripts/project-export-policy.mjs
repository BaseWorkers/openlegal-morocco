const internalDocumentationName = /(?:^|[-_. ])(?:AGENTS|CLAUDE|CODEX|ROADMAP|BUILD(?:ING)?|HOW[-_ ]?TO|SETUP|DEVELOPMENT|DEV[-_ ]?SETUP|PLAN|PLANNING|INSTRUCTIONS?)(?:[-_. ]|\.md$)/i;
const internalDocumentationText = /\b(?:codex|roadmap|contributor(?:s)?\s+guide|development\s+(?:setup|plan|instructions?)|how\s+to\s+build|build(?:ing)?\s+(?:the\s+)?project|project\s+(?:(?:implementation|development)\s+)?plan|implementation\s+plan|build\s+instructions?|(?:npm|pnpm|yarn|bun)\s+(?:run|test|exec|install|build)\b|npx\s+\S+|node\s+scripts\/\S+)/i;

export function isInternalMarkdownDocument(filename, contents) {
  return internalDocumentationName.test(filename) || internalDocumentationText.test(contents);
}
