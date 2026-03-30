/**
 * Interactive terminal prompts using built-in readline (zero dependencies)
 */
import * as readline from 'readline';
import { c } from './colors';

function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

export async function ask(question: string): Promise<string> {
  const rl = createInterface();
  return new Promise((resolve) => {
    rl.question(`${c.cyan('?')} ${question} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function askSecret(question: string): Promise<string> {
  const rl = createInterface();
  return new Promise((resolve) => {
    process.stdout.write(`${c.cyan('?')} ${question} `);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;

    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }

    let input = '';
    const onData = (char: Buffer) => {
      const str = char.toString();
      if (str === '\n' || str === '\r') {
        if (stdin.isTTY) stdin.setRawMode(wasRaw || false);
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(input);
      } else if (str === '\u0003') {
        // Ctrl+C
        process.exit(0);
      } else if (str === '\u007F' || str === '\b') {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        input += str;
        process.stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const answer = await ask(`${question} ${c.dim(`(${hint})`)}`);
  if (answer === '') return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

export async function select(question: string, options: string[]): Promise<number> {
  console.log(`\n${c.cyan('?')} ${question}\n`);
  options.forEach((opt, i) => {
    console.log(`  ${c.bold(`${i + 1}.`)} ${opt}`);
  });
  console.log('');

  const answer = await ask(`Enter choice (1-${options.length}):`);
  const choice = parseInt(answer, 10);
  if (isNaN(choice) || choice < 1 || choice > options.length) {
    console.log(c.error('Invalid choice, defaulting to 1'));
    return 0;
  }
  return choice - 1;
}
