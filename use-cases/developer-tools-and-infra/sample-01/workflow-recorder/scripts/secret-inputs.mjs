export function isSecretOperation(op) {
  return op.secret === true || String(op.type || '').toLowerCase() === 'password';
}

export function validateSecretOperations(ops) {
  for (const op of ops.filter(isSecretOperation)) {
    if (op.secret !== true || !Number.isInteger(op.index) || op.index < 0 ||
        (op.op === 'fill' && op.value !== null) ||
        op.label !== 'Sensitive field' || !Array.isArray(op.selectors) || !op.selectors.length ||
        op.selectors.some(s => s.kind !== 'css' || !/^[a-z]+:nth-of-type\([1-9]\d*\)( > [a-z]+:nth-of-type\([1-9]\d*\))*$/.test(s.value))) {
      throw new Error('Unsafe legacy sensitive operation. Re-record with sensitive-field masking enabled.');
    }
  }
}

export function enrichmentCandidates(candidates) {
  return candidates.filter(candidate => !isSecretOperation(candidate)).map((candidate, index) => ({
    index,
    label: candidate.label,
    tag: candidate.tag,
    type: candidate.type,
    value_example: candidate.original_value,
    pattern_detected: candidate.pattern?.name || null,
  }));
}

export function recorderEvents(message) {
  if (message.method !== 'Runtime.consoleAPICalled') return [];
  const events = [];
  for (const arg of message.params?.args || []) {
    if (arg.type !== 'string' || typeof arg.value !== 'string' || !arg.value.startsWith('[REC]')) continue;
    let op;
    try { op = JSON.parse(arg.value.slice(5)); } catch { continue; }
    if (!op || !['fill', 'click', 'select', 'check', 'press', 'submit', 'navigation', 'goto'].includes(op.op)) continue;
    if (isSecretOperation(op)) {
      validateSecretOperations([{ ...op, index: 0 }]);
      op = { op: op.op, op_index: op.op_index, secret: true, type: 'password', label: 'Sensitive field', value: null, selectors: op.selectors.map(s => ({ kind: 'css', value: s.value })) };
    }
    events.push({ method: 'Runtime.consoleAPICalled', params: {
      timestamp: message.params.timestamp, executionContextId: message.params.executionContextId,
      args: [{ type: 'string', value: '[REC]' + JSON.stringify(op) }],
    } });
  }
  return events;
}
