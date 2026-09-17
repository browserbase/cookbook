const reserved = new Set(['__proto__', 'constructor', 'prototype']);

export function allocateParameterNames(parameters) {
  const used = new Set();
  for (const parameter of parameters) {
    const original = parameter.name;
    let base = String(original || 'parameter')
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '').toLowerCase().slice(0, 40) || 'parameter';
    if (!/^[a-z]/.test(base) || reserved.has(base)) base = `param_${base}`;
    let name = base;
    for (let suffix = 2; used.has(name); suffix++) name = `${base}_${suffix}`;
    used.add(name);
    parameter.name = name;
    if (name !== original) parameter.name_adjustment = { from: original, to: name };
  }
}

export function validateParameters(manifest, ops) {
  if (!Array.isArray(manifest?.parameters)) throw new Error('Manifest must contain a parameters array.');
  const names = new Set();
  const assigned = new Set();
  const indices = new Set(ops.map(op => op.index));
  for (const parameter of manifest.parameters) {
    if (!parameter || typeof parameter.name !== 'string' ||
        !/^[a-z][a-z0-9_]*$/.test(parameter.name) || reserved.has(parameter.name)) {
      throw new Error('Parameter names must be safe lowercase snake_case identifiers. Run detection to normalize edited names.');
    }
    if (names.has(parameter.name)) throw new Error(`Duplicate parameter name: ${parameter.name}`);
    names.add(parameter.name);
    if (!['string', 'string[]', 'number', 'boolean'].includes(parameter.type) || typeof parameter.is_variable !== 'boolean') {
      throw new Error(`Invalid parameter type or variable flag: ${parameter.name}`);
    }
    if (!Array.isArray(parameter.source_op_indices) || !parameter.source_op_indices.length) {
      throw new Error(`Missing source operations: ${parameter.name}`);
    }
    for (const index of parameter.source_op_indices) {
      if (!Number.isInteger(index) || !indices.has(index)) throw new Error(`Unknown source operation: ${parameter.name}`);
      if (parameter.is_variable && assigned.has(index)) throw new Error(`Multiple parameters target operation ${index}`);
      if (parameter.is_variable) assigned.add(index);
    }
  }
}
