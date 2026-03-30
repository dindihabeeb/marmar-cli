/**
 * Integrate command handler
 * Usage: marmar integrate [--dir <path>] [--dry-run] [--auto-approve]
 */
import * as path from 'path';
import { codebaseScanner } from '../core/codebase-scanner';
import { codeIntegrator, CodeChange } from '../core/code-integrator';
import { configManager } from '../core/config-manager';
import { c, heading, spinner } from '../utils/colors';
import { confirm, select } from '../utils/prompt';
import { renderDiff, generateDiff, renderChangeSummary } from '../utils/diff';
import { getLastScanReport } from './scan';

export async function handleIntegrate(args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run');
  const autoApprove = args.includes('--auto-approve');

  let targetDir = '.';
  const dirIdx = args.indexOf('--dir');
  if (dirIdx !== -1 && args[dirIdx + 1]) targetDir = args[dirIdx + 1];

  // Require API key (unless dry-run)
  if (!dryRun) {
    try { configManager.requireApiKey(); }
    catch (err: any) { console.log(c.error(err.message)); return; }
  }

  // Get or run scan
  let scanReport = getLastScanReport();
  if (!scanReport || scanReport.projectPath !== path.resolve(targetDir)) {
    const s = spinner('Scanning codebase...');
    try {
      scanReport = codebaseScanner.scanDirectory(targetDir);
      s.stop(`Found ${scanReport.integrationPoints.length} integration points`);
    } catch (err: any) {
      s.fail(`Scan failed: ${err.message}`);
      return;
    }
  }

  if (scanReport.integrationPoints.length === 0) {
    console.log(c.warn('No integration points found. Nothing to integrate.'));
    return;
  }

  const s = spinner('Preparing integration code...');
  const changes = await codeIntegrator.prepareChanges(scanReport);
  s.stop(`Prepared ${changes.length} code changes`);

  if (changes.length === 0) {
    console.log(c.warn('No code changes could be generated.'));
    return;
  }

  if (dryRun) {
    console.log(c.yellow('\n  DRY RUN — no files will be modified\n'));
  }

  // Review
  if (autoApprove) {
    codeIntegrator.approveAll();
    console.log(c.info(`Auto-approved ${changes.length} changes`));
  } else {
    await reviewChanges(changes);
  }

  const approved = changes.filter(ch => ch.status === 'approved');
  const declined = changes.filter(ch => ch.status === 'declined');

  if (approved.length === 0) {
    console.log(c.warn('\nNo changes approved. Integration cancelled.'));
    return;
  }

  if (dryRun) {
    heading('Dry Run Summary');
    console.log(`  ${c.green(`${approved.length} changes would be applied`)}`);
    console.log(`  ${c.red(`${declined.length} changes declined`)}`);
    console.log(c.dim('\n  Remove --dry-run to apply changes\n'));
    return;
  }

  // Apply
  const applyS = spinner('Applying approved changes...');
  const result = codeIntegrator.applyApprovedChanges();

  if (result.success) {
    applyS.stop('Integration complete');
    heading('Result');
    console.log(`  ${c.green(`${result.changesApplied} changes applied`)}`);
    console.log(`  ${c.red(`${result.changesDeclined} changes declined`)}`);
    if (result.errors.length > 0) {
      for (const err of result.errors) console.log(`  ${c.dim(err)}`);
    }
    console.log('');
    if (!scanReport.projectStructure.hasMarmarSdk) {
      console.log(c.info('Next step: npm install @marmarteam/sdk'));
    }
    console.log(c.info('Set MARMAR_API_KEY in your environment'));
    console.log(c.dim('  Get your key from https://portal.marmar.life\n'));
  } else {
    applyS.fail('Some changes failed');
    for (const err of result.errors) console.log(`  ${c.error(err)}`);
    const rollback = await confirm('Rollback all changes?', true);
    if (rollback) {
      const n = codeIntegrator.rollbackAll();
      console.log(c.success(`Rolled back ${n} changes`));
    }
  }
}

async function reviewChanges(changes: CodeChange[]): Promise<void> {
  heading('Code Review');
  console.log(c.dim(`  ${changes.length} changes to review\n`));

  const mode = await select('How would you like to review?', [
    'Review each change individually',
    'Show all, then approve/decline in batch',
    'Auto-approve all',
  ]);

  switch (mode) {
    case 0: await reviewIndividual(changes); break;
    case 1: await reviewBatch(changes); break;
    case 2:
      codeIntegrator.approveAll();
      console.log(c.success(`Approved all ${changes.length} changes`));
      break;
  }
}

async function reviewIndividual(changes: CodeChange[]): Promise<void> {
  for (let i = 0; i < changes.length; i++) {
    const ch = changes[i];
    console.log(c.bold(`\n  Change ${i + 1}/${changes.length}: ${ch.description}`));
    console.log(c.dim(`  File: ${ch.targetFile}  Line: ${ch.lineNumber}  Type: ${ch.pointType}`));

    const diff = generateDiff(ch.originalCode, ch.newCode);
    renderDiff(ch.targetFile, diff);
    renderChangeSummary(diff);

    const action = await select('Action:', [
      'Approve', 'Decline', 'Approve all remaining', 'Decline all remaining',
    ]);

    switch (action) {
      case 0:
        codeIntegrator.approveChange(ch.changeId);
        console.log(c.success('Approved'));
        break;
      case 1:
        codeIntegrator.declineChange(ch.changeId);
        console.log(c.dim('Declined'));
        break;
      case 2:
        codeIntegrator.approveChange(ch.changeId);
        for (let j = i + 1; j < changes.length; j++) codeIntegrator.approveChange(changes[j].changeId);
        console.log(c.success(`Approved ${changes.length - i} remaining`));
        return;
      case 3:
        codeIntegrator.declineChange(ch.changeId);
        for (let j = i + 1; j < changes.length; j++) codeIntegrator.declineChange(changes[j].changeId);
        console.log(c.dim(`Declined ${changes.length - i} remaining`));
        return;
    }
  }
}

async function reviewBatch(changes: CodeChange[]): Promise<void> {
  for (const ch of changes) {
    console.log(c.bold(`\n  ${ch.description}`));
    console.log(c.dim(`  ${ch.targetFile}:${ch.lineNumber} (${ch.pointType})`));
    const diff = generateDiff(ch.originalCode, ch.newCode);
    renderDiff(ch.targetFile, diff);
  }

  const ok = await confirm(`\nApprove all ${changes.length} changes?`, true);
  if (ok) {
    codeIntegrator.approveAll();
    console.log(c.success(`Approved all ${changes.length} changes`));
  } else {
    codeIntegrator.declineAll();
    console.log(c.dim(`Declined all ${changes.length} changes`));
  }
}
