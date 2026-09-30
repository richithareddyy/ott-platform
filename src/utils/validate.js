const { HttpError } = require('./http');

/**
 * Minimal schema validator for request bodies/queries.
 * rules: { field: { type, required, min, max, maxLength, enum, pattern, items } }
 * Returns a new object containing only the declared fields (unknown keys are
 * dropped), so client input can never smuggle operators like `$gt` into queries.
 */
function validate(input, rules, { partial = false } = {}) {
  const out = {};
  const errors = {};
  const src = input && typeof input === 'object' ? input : {};

  for (const [field, rule] of Object.entries(rules)) {
    let value = src[field];
    if (value === undefined || value === null || value === '') {
      if (rule.required && !partial) errors[field] = 'is required';
      else if (rule.default !== undefined && !partial) out[field] = rule.default;
      continue;
    }

    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') { errors[field] = 'must be a string'; continue; }
        value = value.trim();
        if (rule.maxLength && value.length > rule.maxLength) errors[field] = `must be at most ${rule.maxLength} characters`;
        if (rule.minLength && value.length < rule.minLength) errors[field] = `must be at least ${rule.minLength} characters`;
        if (rule.pattern && !rule.pattern.test(value)) errors[field] = 'has an invalid format';
        if (rule.enum && !rule.enum.includes(value)) errors[field] = `must be one of: ${rule.enum.join(', ')}`;
        break;
      case 'number':
        value = typeof value === 'string' ? Number(value) : value;
        if (typeof value !== 'number' || !Number.isFinite(value)) { errors[field] = 'must be a number'; continue; }
        if (rule.integer && !Number.isInteger(value)) errors[field] = 'must be an integer';
        if (rule.min !== undefined && value < rule.min) errors[field] = `must be >= ${rule.min}`;
        if (rule.max !== undefined && value > rule.max) errors[field] = `must be <= ${rule.max}`;
        break;
      case 'boolean':
        if (value === 'true') value = true;
        if (value === 'false') value = false;
        if (typeof value !== 'boolean') errors[field] = 'must be a boolean';
        break;
      case 'stringArray':
        if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) { errors[field] = 'must be an array of strings'; continue; }
        value = value.map((v) => v.trim()).filter(Boolean);
        if (rule.maxItems && value.length > rule.maxItems) errors[field] = `must have at most ${rule.maxItems} items`;
        if (rule.minItems && value.length < rule.minItems) errors[field] = `must have at least ${rule.minItems} items`;
        if (rule.enum && value.some((v) => !rule.enum.includes(v))) errors[field] = `items must be one of: ${rule.enum.join(', ')}`;
        break;
      default:
        throw new Error(`Unknown rule type for ${field}`);
    }
    if (!errors[field]) out[field] = value;
  }

  if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', errors);
  return out;
}

module.exports = { validate };
