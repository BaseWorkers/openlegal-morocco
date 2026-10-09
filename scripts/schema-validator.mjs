const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const schemaTypes = new Set(['object', 'array', 'string', 'integer', 'number', 'boolean', 'null']);
const supportedKeywords = new Set([
  '$schema', '$id', '$ref', '$defs', 'title', 'description', 'default', 'examples', 'deprecated',
  'type', 'const', 'enum', 'properties', 'required', 'additionalProperties', 'items',
  'minLength', 'maxLength', 'pattern', 'format', 'minItems', 'maxItems', 'uniqueItems',
  'minProperties', 'minimum', 'maximum'
]);
const supportedFormats = new Set(['date', 'date-time', 'uri']);

function assertSupportedSchema(schema, path = '$schema') {
  if (!isPlainObject(schema)) throw new Error(`${path} must be a schema object`);
  for (const keyword of Object.keys(schema)) {
    if (!supportedKeywords.has(keyword)) throw new Error(`Unsupported JSON Schema keyword ${keyword} at ${path}`);
  }
  if (schema.format && !supportedFormats.has(schema.format)) {
    throw new Error(`Unsupported JSON Schema format ${schema.format} at ${path}`);
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    for (const type of types) if (!schemaTypes.has(type)) throw new Error(`Unsupported schema type: ${type}`);
  }
  for (const [key, child] of Object.entries(schema.properties ?? {})) assertSupportedSchema(child, `${path}.properties.${key}`);
  for (const [key, child] of Object.entries(schema.$defs ?? {})) assertSupportedSchema(child, `${path}.$defs.${key}`);
  if (schema.items) assertSupportedSchema(schema.items, `${path}.items`);
  if (isPlainObject(schema.additionalProperties)) assertSupportedSchema(schema.additionalProperties, `${path}.additionalProperties`);
}

function matchesType(value, type) {
  if (Array.isArray(type)) return type.some((candidate) => matchesType(value, candidate));
  switch (type) {
    case 'object': return isPlainObject(value);
    case 'array': return Array.isArray(value);
    case 'string': return typeof value === 'string';
    case 'integer': return Number.isInteger(value);
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'boolean': return typeof value === 'boolean';
    case 'null': return value === null;
    default: throw new Error(`Unsupported schema type: ${type}`);
  }
}

function resolveRef(rootSchema, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Only local JSON Schema references are supported: ${ref}`);
  return ref.slice(2).split('/').map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((current, key) => current?.[key], rootSchema);
}

function validateNode(value, schema, rootSchema, path, errors) {
  if (schema.$ref) {
    const target = resolveRef(rootSchema, schema.$ref);
    if (!target) throw new Error(`Unresolved JSON Schema reference: ${schema.$ref}`);
    validateNode(value, target, rootSchema, path, errors);
    const siblings = Object.fromEntries(Object.entries(schema).filter(([key]) => key !== '$ref' && !['$schema', '$id', '$defs', 'title', 'description', 'default', 'examples', 'deprecated'].includes(key)));
    if (Object.keys(siblings).length) validateNode(value, siblings, rootSchema, path, errors);
    return;
  }
  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(`${path} must be ${Array.isArray(schema.type) ? schema.type.join(' or ') : schema.type}`);
    return;
  }
  if (Object.hasOwn(schema, 'const') && !Object.is(schema.const, value)) errors.push(`${path} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) errors.push(`${path} must be one of: ${schema.enum.join(', ')}`);
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path} is shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path} is longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path} does not match ${schema.pattern}`);
    if (schema.format === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)) errors.push(`${path} must be a valid YYYY-MM-DD date`);
    if (schema.format === 'date-time' && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value)))) errors.push(`${path} must be a valid RFC 3339 date-time`);
    if (schema.format === 'uri') {
      try { new URL(value); } catch { errors.push(`${path} must be a valid URI`); }
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} must contain at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path} must contain at most ${schema.maxItems} items`);
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${path} items must be unique`);
    if (schema.items) value.forEach((item, index) => validateNode(item, schema.items, rootSchema, `${path}[${index}]`, errors));
  }
  if (isPlainObject(value)) {
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) errors.push(`${path} must contain at least ${schema.minProperties} properties`);
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${path}.${key} is required`);
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties?.[key]) validateNode(child, schema.properties[key], rootSchema, `${path}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${path}.${key} is not allowed`);
      else if (isPlainObject(schema.additionalProperties)) validateNode(child, schema.additionalProperties, rootSchema, `${path}.${key}`, errors);
    }
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} must be at least ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} must be at most ${schema.maximum}`);
  }
}

export function validateJsonSchemaValue(value, schema) {
  assertSupportedSchema(schema);
  const errors = [];
  validateNode(value, schema, schema, '$', errors);
  return errors;
}
