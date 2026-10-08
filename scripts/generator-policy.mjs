export function validateGeneratorVariablePolicy(variableDefinitions, { allowBlocked = false } = {}) {
  const errors = [];
  for (const variable of variableDefinitions) {
    if (variable.generator_input === 'blocked') {
      if (!allowBlocked) errors.push(`{{${variable.name}}} requires counsel-controlled wording or a pre-approved clause choice`);
    }
    else if (variable.generator_input === 'approved_choice') {
      if (!Array.isArray(variable.enum) || variable.enum.length === 0) errors.push(`{{${variable.name}}} needs a non-empty approved enum`);
      if (variable.type !== 'string') errors.push(`{{${variable.name}}} approved choices must be strings`);
    } else if (variable.generator_input !== 'factual') errors.push(`{{${variable.name}}} has no approved generator input classification`);

    if (['factual', 'approved_choice'].includes(variable.generator_input) && ['string', 'address', 'email', 'currency'].includes(variable.type) && (!Number.isInteger(variable.maxLength) || variable.maxLength < 1)) {
      errors.push(`{{${variable.name}}} text needs a maxLength`);
    }
    if (variable.type === 'number') {
      if (!Number.isFinite(variable.minimum)) errors.push(`{{${variable.name}}} number needs a finite minimum`);
      if (!Number.isFinite(variable.maximum)) errors.push(`{{${variable.name}}} number needs a finite maximum`);
      if (Number.isFinite(variable.minimum) && Number.isFinite(variable.maximum) && variable.minimum > variable.maximum) {
        errors.push(`{{${variable.name}}} minimum cannot exceed maximum`);
      }
    }
    if (variable.generator_input === 'factual' && variable.enum) errors.push(`{{${variable.name}}} factual inputs cannot declare selectable choices`);
  }
  return errors;
}
