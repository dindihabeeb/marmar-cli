#!/usr/bin/env node

import { handleLogin, handleLogout, handleStatus } from './commands/auth';
import { handleConfig } from './commands/config';
import { handleScan } from './commands/scan';
import { handleIntegrate } from './commands/integrate';
import { c, table } from './utils/colors';

const VERSION = '0.1.0';

function showHelp(): void {
  console.log(c.bold('USAGE'));
  console.log(`  ${c.cyan('marmar')} ${c.dim('<command>')} ${c.dim('[options]')}\n`);

  console.log(c.bold('COMMANDS\n'));
  table([
    ['login', 'Store and verify your MARMAR API key'],
    ['logout', 'Clear stored API key'],
    ['status', 'Check API key validity'],
    ['config', 'View and manage configuration'],
    ['scan', 'Scan codebase for CDS integration points'],
    ['integrate', 'Generate and apply SDK integration code'],
    ['help', 'Show this help message'],
    ['version', 'Show CLI version'],
  ]);

  console.log(`\n${c.bold('QUICK START')}\n`);
  console.log(c.dim('  # 1. Get your API key from https://portal.marmar.life'));
  console.log(`  ${c.cyan('marmar login --api-key')} mk_abc123...`);
  console.log('');
  console.log(c.dim('  # 2. Scan your EMR project'));
  console.log(`  ${c.cyan('marmar scan --dir')} ./my-emr-project`);
  console.log('');
  console.log(c.dim('  # 3. Integrate (with review)'));
  console.log(`  ${c.cyan('marmar integrate --dir')} ./my-emr-project`);
  console.log('');
  console.log(c.dim('  # Preview without changes'));
  console.log(`  ${c.cyan('marmar integrate --dir')} ./my-emr-project ${c.cyan('--dry-run')}`);
  console.log('');
  console.log(c.dim(`  Docs: https://docs.cds.marmar.life`));
  console.log(c.dim(`  SDK:  npm install @marmarteam/sdk\n`));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const commandArgs = args.slice(1);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  if (command === 'version' || command === '--version' || command === '-v') {
    console.log(`marmar-cli v${VERSION}`);
    return;
  }

  try {
    switch (command) {
      case 'login':     await handleLogin(commandArgs); break;
      case 'logout':    await handleLogout(); break;
      case 'status':    await handleStatus(); break;
      case 'config':    await handleConfig(commandArgs); break;
      case 'scan':      await handleScan(commandArgs); break;
      case 'integrate': await handleIntegrate(commandArgs); break;
      default:
        console.log(c.error(`Unknown command: ${command}`));
        console.log(c.dim(`  Run ${c.cyan('marmar help')} for available commands`));
        process.exit(1);
    }
  } catch (err: any) {
    console.log(c.error(err.message));
    if (process.env.MARMAR_DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(c.error(`Fatal: ${err.message}`));
  process.exit(1);
});
