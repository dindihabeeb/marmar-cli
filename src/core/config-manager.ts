/**
 * ConfigManager — FR 3 (Configuration Management)
 *
 * Manages API key, CDS endpoint, and environment settings.
 * Config: ~/.marmar/config.json
 * Credentials: ~/.marmar/.credentials (0600 permissions)
 *
 * Auth model: MARMAR CDS uses static API keys as Bearer tokens.
 * Keys are obtained from https://portal.marmar.life → Settings → API Keys.
 * There is no login/logout token exchange — the key IS the credential.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface MarmarConfig {
  cdsEndpoint: string;
  environment: 'development' | 'staging' | 'production';
  defaultLanguage: string;
  scanPatterns: string[];
}

interface Credentials {
  apiKey?: string;
}

const DEFAULT_CONFIG: MarmarConfig = {
  cdsEndpoint: 'https://cds.marmar.life/v1',
  environment: 'production',
  defaultLanguage: 'typescript',
  scanPatterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
};

export class ConfigManager {
  private configDir: string;
  private configPath: string;
  private credentialsPath: string;

  constructor() {
    this.configDir = path.join(os.homedir(), '.marmar');
    this.configPath = path.join(this.configDir, 'config.json');
    this.credentialsPath = path.join(this.configDir, '.credentials');
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
    }
  }

  loadConfig(): MarmarConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      }
    } catch {}
    return { ...DEFAULT_CONFIG };
  }

  saveConfig(config: MarmarConfig): void {
    this.ensureDir();
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  }

  getConfig(key: keyof MarmarConfig): string | string[] {
    const config = this.loadConfig();
    return config[key];
  }

  setConfig(key: keyof MarmarConfig, value: string): void {
    const config = this.loadConfig();
    if (key === 'scanPatterns') {
      config.scanPatterns = value.split(',').map(s => s.trim());
    } else if (key === 'environment') {
      if (!['development', 'staging', 'production'].includes(value)) {
        throw new Error(`Invalid environment: ${value}. Must be development, staging, or production.`);
      }
      config.environment = value as MarmarConfig['environment'];
    } else {
      (config as any)[key] = value;
    }
    this.saveConfig(config);
  }

  deleteConfig(): void {
    if (fs.existsSync(this.configPath)) fs.unlinkSync(this.configPath);
    if (fs.existsSync(this.credentialsPath)) fs.unlinkSync(this.credentialsPath);
  }

  viewConfig(): Record<string, string | string[]> {
    const config = this.loadConfig();
    const creds = this.loadCredentials();
    return {
      ...config,
      apiKey: creds.apiKey ? maskKey(creds.apiKey) : '(not set)',
    };
  }

  // --- Credential management ---

  storeApiKey(apiKey: string): void {
    this.ensureDir();
    this.saveCredentials({ apiKey });
  }

  getApiKey(): string | undefined {
    return this.loadCredentials().apiKey;
  }

  clearApiKey(): void {
    this.saveCredentials({});
  }

  /**
   * Authorization header for all MARMAR CDS API requests.
   * Format: Bearer YOUR_API_KEY
   */
  getAuthHeader(): Record<string, string> | null {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;
    return { Authorization: `Bearer ${apiKey}` };
  }

  /**
   * Require a configured API key or throw with setup instructions
   */
  requireApiKey(): string {
    const key = this.getApiKey();
    if (!key) {
      throw new Error(
        'No API key configured.\n' +
        '  1. Get your key from https://portal.marmar.life → Settings → API Keys\n' +
        '  2. Run: marmar config set --api-key <your-key>'
      );
    }
    return key;
  }

  private loadCredentials(): Credentials {
    try {
      if (fs.existsSync(this.credentialsPath)) {
        return JSON.parse(fs.readFileSync(this.credentialsPath, 'utf-8'));
      }
    } catch {}
    return {};
  }

  private saveCredentials(creds: Credentials): void {
    this.ensureDir();
    fs.writeFileSync(this.credentialsPath, JSON.stringify(creds, null, 2), { mode: 0o600 });
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

export const configManager = new ConfigManager();
