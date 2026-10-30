import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { transformWithEsbuild } from 'vite';

// Compile the real TSX component for Node without adding generated files to the repo.
test('password visibility toggles without changing the value or submitting a form', async () => {
  const cache = join(process.cwd(), 'node_modules', '.cache');
  await mkdir(cache, { recursive: true });
  const temp = await mkdtemp(join(cache, 'password-test-'));
  try {
    const source = await readFile('src/PasswordField.tsx', 'utf8');
    const { code } = await transformWithEsbuild(source, 'src/PasswordField.tsx', { jsx: 'automatic' });
    const path = join(temp, 'PasswordField.mjs');
    await writeFile(path, code);
    const { PasswordField } = await import(pathToFileURL(path).href);
    const props = { value: 'example password', onChange: () => {}, autoComplete: 'current-password', required: true };
    let view;
    await act(async () => { view = create(React.createElement(PasswordField, props)); });
    const input = () => view.root.findByType('input');
    const button = () => view.root.findByType('button');
    assert.equal(input().props.type, 'password');
    assert.equal(button().props.type, 'button');
    assert.equal(button().props['aria-label'], 'Show password');
    await act(async () => button().props.onClick());
    assert.equal(input().props.type, 'text');
    assert.equal(input().props.value, props.value);
    assert.equal(button().props['aria-label'], 'Hide password');
    await act(async () => button().props.onClick());
    assert.equal(input().props.type, 'password');
    await act(async () => button().props.onClick());
    await act(async () => view.update(React.createElement(PasswordField, { ...props, autoComplete: 'new-password' })));
    assert.equal(input().props.type, 'password');
    view.unmount();
  } finally { await rm(temp, { recursive: true, force: true }); }
});
