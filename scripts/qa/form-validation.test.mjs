import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const compiled = ts.transpileModule(readFileSync('src/lib/admin/actions.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = { exports: {} };
new Function('require', 'module', 'exports', compiled)((id) => {
  if (id === 'next/navigation') return { unstable_rethrow() {} };
  if (id === './auth') return { NotAllowedError: class extends Error {} };
  if (id === '@/lib/uploads') return { UploadError: class extends Error {} };
  throw new Error(`Unexpected dependency ${id}`);
}, loaded, loaded.exports);
const { formReader, ValidationError } = loaded.exports;

for (const value of ['2026-02-31', '2025-02-29', '2026-04-31', '0000-01-01', '2026-13-01', '2026-1-1']) {
  test(`Shared date fields reject ${value}`, () => {
    const form = new FormData(); form.set('date', value);
    const fields = formReader(form); fields.date('date');
    assert.throws(() => fields.done(), ValidationError);
    assert.equal(fields.errors.date, 'Enter a valid date');
  });
}
test('Shared date fields preserve leap days and optional blank values', () => {
  const form = new FormData(); form.set('date', '2024-02-29');
  const fields = formReader(form);
  assert.equal(fields.date('date'), '2024-02-29');
  assert.equal(fields.date('optional'), null);
  fields.done();
});
test('Integer fields reject precision loss and accept grouped amounts', () => {
  const form = new FormData(); form.set('unsafe', '9007199254740993'); form.set('amount', '1,234');
  const fields = formReader(form);
  assert.equal(fields.int('unsafe'), null);
  assert.equal(fields.int('amount'), 1234);
  assert.throws(() => fields.done(), ValidationError);
});
