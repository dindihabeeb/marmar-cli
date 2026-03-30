/**
 * Config command handlers
 * Usage:
 *   marmar config view
 *   marmar config set --api-key <key>
 *   marmar config set --endpoint <url>
 *   marmar config set --environment <env>
 *   marmar config delete
 */
import { configManager } from '../core/config-manager';
import { c, heading, table } from '../utils/colors';
import { ask, askSecret, confirm } from '../utils/prompt';

export async function handleConfig(args: string[]): Promise<void> {
  const sub = args[0];

  switch (sub) {
    case 'view': return viewConfig();
    case 'set': return setConfig(args.slice(1));
    case 'delete': return deleteConfig();
    default:
      console.log(sub ? c.error(`Unknown subcommand: ${sub}`) : c.error('Missing subcommand'));
      console.log('\nUsage:');
      table([
        ['marmar config view', 'Show current configuration'],
        ['marmar config set --api-key <key>', 'Set your API key'],
        ['marmar config set --endpoint <url>', 'Set CDS endpoint'],
        ['marmar config set --environment <env>', 'Set environment'],
        ['marmar config delete', 'Delete all configuration'],
      ]);
  }
}

async function viewConfig(): Promise<void> {
  heading('MARMAR CLI Configuration');
  const config = configManager.viewConfig();
  const rows: [string, string][] = Object.entries(config).map(([k, v]) => [
    k,
    Array.isArray(v) ? v.join(', ') : String(v),
  ]);
  table(rows);
  console.log('');
}

async function setConfig(args: string[]): Promise<void> {
  const flagIdx = args.findIndex(a => a.startsWith('--'));
  if (flagIdx === -1) {
    console.log(c.error('Specify a setting: --api-key, --endpoint, or --environment'));
    return;
  }

  const flag = args[flagIdx].replace(/^--/, '');
  let value = args[flagIdx + 1];

  switch (flag) {
    case 'api-key':
    case 'apikey': {
      if (!value) value = await askSecret('Enter your MARMAR API key:');
      if (!value) { console.log(c.error('No API key provided')); return; }
      configManager.storeApiKey(value);
      console.log(c.success('API key stored securely'));
      break;
    }
    case 'endpoint': {
      if (!value) value = await ask('Enter CDS endpoint URL:');
      if (!value.startsWith('http')) { console.log(c.error('Must be a valid URL')); return; }
      configManager.setConfig('cdsEndpoint', value);
      console.log(c.success(`Endpoint set to ${value}`));
      break;
    }
    case 'environment':
    case 'env': {
      if (!value) value = await ask('Enter environment (development/staging/production):');
      try {
        configManager.setConfig('environment', value);
        console.log(c.success(`Environment set to ${value}`));
      } catch (err: any) { console.log(c.error(err.message)); }
      break;
    }
    default:
      console.log(c.error(`Unknown setting: ${flag}`));
      console.log(c.dim('  Available: --api-key, --endpoint, --environment'));
  }
}

async function deleteConfig(): Promise<void> {
  const ok = await confirm('Delete all MARMAR CLI configuration?', false);
  if (!ok) { console.log(c.dim('Cancelled')); return; }
  configManager.deleteConfig();
  console.log(c.success('Configuration deleted'));
}
