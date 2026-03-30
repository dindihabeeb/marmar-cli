/**
 * Scan command handler
 * Usage: marmar scan [--dir <path>]
 */
import { codebaseScanner, ScanReport, IntegrationPoint } from '../core/codebase-scanner';
import { configManager } from '../core/config-manager';
import { c, heading, table, spinner } from '../utils/colors';

let lastScanReport: ScanReport | null = null;

export function getLastScanReport(): ScanReport | null {
  return lastScanReport;
}

export async function handleScan(args: string[]): Promise<void> {
  let targetDir = '.';
  const dirIdx = args.indexOf('--dir');
  if (dirIdx !== -1 && args[dirIdx + 1]) targetDir = args[dirIdx + 1];

  // Warn if no API key (scan is local but integration will need it)
  if (!configManager.getApiKey()) {
    console.log(c.warn('No API key configured — scan will proceed but integration requires auth'));
    console.log(c.dim('  Run: marmar login\n'));
  }

  const s = spinner(`Scanning ${targetDir}...`);

  try {
    const report = codebaseScanner.scanDirectory(targetDir);
    lastScanReport = report;

    s.stop(`Scan complete — ${report.scannedFiles} files scanned`);

    heading('Project Structure');
    const st = report.projectStructure;
    table([
      ['Framework', st.framework || 'unknown'],
      ['TypeScript', st.hasTypeScript ? 'yes' : 'no'],
      ['MARMAR SDK', st.hasMarmarSdk ? 'installed' : 'not installed'],
      ['Entry point', st.entryPoint || 'unknown'],
      ['Source dir', st.srcDirectory || '(root)'],
    ]);

    if (report.integrationPoints.length === 0) {
      console.log(c.warn('\nNo integration points found'));
      console.log(c.dim('  Ensure the target directory contains a JS/TS project'));
      console.log(c.dim('  with route handlers that process clinical data.\n'));
      return;
    }

    heading(`Integration Points (${report.integrationPoints.length} found)`);
    renderPoints(report.integrationPoints);

    console.log('');
    console.log(c.info('Run ' + c.bold('marmar integrate') + ' to apply these integrations'));
    console.log('');
  } catch (err: any) {
    s.fail(`Scan failed: ${err.message}`);
  }
}

function renderPoints(points: IntegrationPoint[]): void {
  const byFile = new Map<string, IntegrationPoint[]>();
  for (const p of points) {
    const arr = byFile.get(p.filePath) || [];
    arr.push(p);
    byFile.set(p.filePath, arr);
  }

  for (const [file, filePoints] of byFile) {
    console.log(`\n  ${c.bold(c.blue(file))}`);
    for (const p of filePoints) {
      const conf = p.confidence === 'high'
        ? c.green('HIGH')
        : p.confidence === 'medium'
          ? c.yellow('MED ')
          : c.dim('LOW ');

      const label = TYPE_LABELS[p.pointType] || p.pointType;
      console.log(
        `    ${conf}  L${String(p.lineNumber).padStart(4)}  ${c.cyan(label.padEnd(12))}  ${c.dim(p.suggestion)}`
      );
    }
  }
}

const TYPE_LABELS: Record<string, string> = {
  sdk_import: 'IMPORT',
  client_init: 'INIT',
  patient_route: 'PATIENT',
  assessment_route: 'ASSESSMENT',
  webhook_handler: 'WEBHOOK',
  middleware: 'MIDDLEWARE',
  env_config: 'ENV',
  package_json: 'PACKAGE',
};
