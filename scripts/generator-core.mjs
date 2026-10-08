import { validateGeneratorVariablePolicy } from './generator-policy.mjs';

const unsafeValueCharacters = /[\p{Cc}\p{Zl}\p{Zp}\p{Bidi_Control}]/u;

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validateValue(variable, value) {
  if (variable.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`{{${variable.name}}} must be a finite number`);
    if (value < variable.minimum || value > variable.maximum) {
      throw new Error(`{{${variable.name}}} must be between ${variable.minimum} and ${variable.maximum}`);
    }
  } else if (variable.type === 'boolean') {
    if (typeof value !== 'boolean') throw new Error(`{{${variable.name}}} must be a boolean`);
  } else if (typeof value !== 'string') {
    throw new Error(`{{${variable.name}}} must be a string`);
  }

  if (typeof value === 'string') {
    if (value.trim().length === 0 && variable.required) throw new Error(`{{${variable.name}}} is required and cannot be empty`);
    if (unsafeValueCharacters.test(value)) throw new Error(`{{${variable.name}}} must not contain control characters, line separators, or bidirectional formatting controls`);
    if (variable.maxLength && value.length > variable.maxLength) throw new Error(`{{${variable.name}}} exceeds maxLength ${variable.maxLength}`);
    if (variable.enum && !variable.enum.includes(value)) throw new Error(`{{${variable.name}}} must be one of: ${variable.enum.join(', ')}`);
    if (variable.type === 'date' && !isValidDate(value)) throw new Error(`{{${variable.name}}} must be a valid YYYY-MM-DD date`);
    if (variable.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error(`{{${variable.name}}} must be an email address`);
  }
}

export function validateInputValues(variableDefinitions, values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Input values must be a JSON object');
  const policyErrors = validateGeneratorVariablePolicy(variableDefinitions);
  if (policyErrors.length) throw new Error(`Unsafe or unclassified generator variables: ${policyErrors.join('; ')}`);
  const definitions = new Map(variableDefinitions.map((variable) => [variable.name, variable]));
  for (const name of Object.keys(values)) if (!definitions.has(name)) throw new Error(`Unknown input variable: ${name}`);
  for (const variable of variableDefinitions) {
    if (!Object.hasOwn(values, variable.name)) {
      if (variable.required) throw new Error(`Missing required input variable: ${variable.name}`);
      continue;
    }
    validateValue(variable, values[variable.name]);
  }
}

export function escapeMarkdownValue(value) {
  return String(value)
    .replace(/\r\n?|\n/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_{}\[\]()#+\-.!|])/g, '\\$1');
}

export function renderTemplateText(markdown, variables, values) {
  validateInputValues(variables, values);
  return markdown.replace(/\{\{([a-z][a-z0-9_]*)\}\}/g, (_match, name) => escapeMarkdownValue(Object.hasOwn(values, name) ? values[name] : ''));
}
