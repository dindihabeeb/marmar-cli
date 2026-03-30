/**
 * Auth command handlers
 *
 * MARMAR CDS uses static API keys (Bearer tokens). There is no session-based
 * login/logout. The CLI "login" stores and verifies the key. "logout" clears it.
 *
 * Usage:
 *   marmar login [--api-key <key>]
 *   marmar logout
 *   marmar status
 */
import { authManager } from '../core/auth-manager';
import { configManager } from '../core/config-manager';
import { c, spinner } from '../utils/colors';
import { askSecret } from '../utils/prompt';

export async function handleLogin(args: string[]): Promise<void> {
  let apiKey: string | undefined;

  // Check for --api-key flag
  const keyIdx = args.indexOf('--api-key');
  if (keyIdx !== -1 && args[keyIdx + 1]) {
    apiKey = args[keyIdx + 1];
  }

  // Prompt if not provided
  if (!apiKey) {
    console.log(c.dim('  Get your API key from https://portal.marmar.life → Settings → API Keys\n'));
    apiKey = await askSecret('Enter your MARMAR API key:');
    if (!apiKey) {
      console.log(c.error('No API key provided'));
      return;
    }
  }

  const s = spinner('Verifying API key with MARMAR CDS...');
  const result = await authManager.login(apiKey);

  if (result.success) {
    s.stop(result.message);
  } else {
    s.fail(result.message);
  }
}

export async function handleLogout(): Promise<void> {
  const result = authManager.logout();
  if (result.success) {
    console.log(c.success(result.message));
  } else {
    console.log(c.error(result.message));
  }
}

export async function handleStatus(): Promise<void> {
  const apiKey = configManager.getApiKey();

  console.log('');
  if (!apiKey) {
    console.log(c.warn('No API key configured'));
    console.log(c.dim('  Run: marmar login'));
    console.log(c.dim('  Get your key from https://portal.marmar.life\n'));
    return;
  }

  console.log(c.info(`API Key: ${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`));
  console.log(c.info(`Endpoint: ${configManager.getConfig('cdsEndpoint')}`));

  const s = spinner('Verifying...');
  const result = await authManager.verify();

  if (result.success) {
    s.stop(result.message);
  } else {
    s.fail(result.message);
  }
  console.log('');
}
