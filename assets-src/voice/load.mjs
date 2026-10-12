// Loads src/audio/voice.ts in Node by transpiling it with the project's TypeScript.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = await readFile(path.join(here, '..', '..', 'src', 'audio', 'voice.ts'), 'utf8');
const { outputText } = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } });
export const voice = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
