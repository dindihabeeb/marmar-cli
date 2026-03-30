/**
 * Terminal colors and formatting utilities (zero dependencies)
 */

const CODES = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  underline: '\x1b[4m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

function colorize(code: string, text: string): string {
  return `${code}${text}${CODES.reset}`;
}

export const c = {
  red: (t: string) => colorize(CODES.red, t),
  green: (t: string) => colorize(CODES.green, t),
  yellow: (t: string) => colorize(CODES.yellow, t),
  blue: (t: string) => colorize(CODES.blue, t),
  magenta: (t: string) => colorize(CODES.magenta, t),
  cyan: (t: string) => colorize(CODES.cyan, t),
  white: (t: string) => colorize(CODES.white, t),
  gray: (t: string) => colorize(CODES.gray, t),
  bold: (t: string) => colorize(CODES.bold, t),
  dim: (t: string) => colorize(CODES.dim, t),
  underline: (t: string) => colorize(CODES.underline, t),
  success: (t: string) => colorize(CODES.green, `✓ ${t}`),
  error: (t: string) => colorize(CODES.red, `✗ ${t}`),
  warn: (t: string) => colorize(CODES.yellow, `! ${t}`),
  info: (t: string) => colorize(CODES.cyan, `i ${t}`),
};

export function table(rows: [string, string][], indent = 2): void {
  const maxKey = Math.max(...rows.map(([k]) => k.length));
  for (const [key, val] of rows) {
    const padding = ' '.repeat(maxKey - key.length + 2);
    console.log(`${' '.repeat(indent)}${c.bold(key)}${padding}${val}`);
  }
}

export function heading(text: string): void {
  console.log(`\n${c.bold(c.cyan(text))}`);
  console.log(c.dim('─'.repeat(text.length + 4)));
}

export function spinner(text: string): { stop: (msg?: string) => void; fail: (msg?: string) => void } {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r${c.cyan(frames[i++ % frames.length])} ${text}`);
  }, 80);

  return {
    stop: (msg?: string) => {
      clearInterval(interval);
      process.stdout.write(`\r${c.success(msg || text)}\n`);
    },
    fail: (msg?: string) => {
      clearInterval(interval);
      process.stdout.write(`\r${c.error(msg || text)}\n`);
    },
  };
}
