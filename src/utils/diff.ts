/**
 * Simple unified diff display for code review (zero dependencies)
 */
import { c } from './colors';

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  lineNumber?: number;
}

/**
 * Generate a simple diff between two strings
 */
export function generateDiff(original: string, modified: string, contextLines = 3): DiffLine[] {
  const origLines = original.split('\n');
  const modLines = modified.split('\n');
  const result: DiffLine[] = [];

  // Simple line-by-line comparison
  const maxLen = Math.max(origLines.length, modLines.length);

  for (let i = 0; i < maxLen; i++) {
    const origLine = origLines[i];
    const modLine = modLines[i];

    if (origLine === undefined && modLine !== undefined) {
      result.push({ type: 'add', content: modLine, lineNumber: i + 1 });
    } else if (modLine === undefined && origLine !== undefined) {
      result.push({ type: 'remove', content: origLine, lineNumber: i + 1 });
    } else if (origLine !== modLine) {
      result.push({ type: 'remove', content: origLine!, lineNumber: i + 1 });
      result.push({ type: 'add', content: modLine!, lineNumber: i + 1 });
    } else {
      result.push({ type: 'context', content: origLine!, lineNumber: i + 1 });
    }
  }

  return result;
}

/**
 * Render diff to terminal with colors
 */
export function renderDiff(filePath: string, diff: DiffLine[]): void {
  console.log(`\n${c.bold('--- ' + filePath + ' (original)')}`);
  console.log(`${c.bold('+++ ' + filePath + ' (modified)')}\n`);

  // Show only changed regions with context
  let inChange = false;
  let contextBuffer: DiffLine[] = [];
  const CONTEXT = 3;

  for (let i = 0; i < diff.length; i++) {
    const line = diff[i];
    const isChange = line.type !== 'context';
    const nearChange = diff.slice(Math.max(0, i - CONTEXT), Math.min(diff.length, i + CONTEXT + 1))
      .some(l => l.type !== 'context');

    if (isChange || nearChange) {
      if (!inChange && i > 0) {
        console.log(c.dim('  ...'));
      }
      inChange = true;

      const lineNum = String(line.lineNumber || '').padStart(4, ' ');
      switch (line.type) {
        case 'add':
          console.log(c.green(`+ ${lineNum} | ${line.content}`));
          break;
        case 'remove':
          console.log(c.red(`- ${lineNum} | ${line.content}`));
          break;
        case 'context':
          console.log(c.dim(`  ${lineNum} | ${line.content}`));
          break;
      }
    } else {
      if (inChange) {
        console.log(c.dim('  ...'));
      }
      inChange = false;
    }
  }
  console.log('');
}

/**
 * Render a summary of changes
 */
export function renderChangeSummary(diff: DiffLine[]): { additions: number; deletions: number } {
  const additions = diff.filter(l => l.type === 'add').length;
  const deletions = diff.filter(l => l.type === 'remove').length;

  console.log(
    `  ${c.green(`+${additions} additions`)}  ${c.red(`-${deletions} deletions`)}`
  );

  return { additions, deletions };
}
