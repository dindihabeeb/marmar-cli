/**
 * AuthManager — FR 1 (Authentication)
 *
 * MARMAR CDS uses static API keys (Bearer tokens). There is no login/logout
 * token exchange. The API key is obtained from the Tenant Dashboard at
 * https://portal.marmar.life → Settings → API Keys.
 *
 * "Login" in the CLI context means: store the API key and verify it works
 * by making a test request to the API.
 * "Logout" means: clear the stored API key.
 */
import { configManager } from './config-manager';
import { request, buildUrl } from '../utils/http';

export interface AuthResult {
  success: boolean;
  message: string;
}

export class AuthManager {
  /**
   * Store an API key and verify it works against the live API.
   * Validate by calling GET /v1/patients — if get 200, the key is good.
   * If 401, the key is invalid. If we get a network error, we store
   * the key anyway but warn the user.
   */
  async login(apiKey: string): Promise<AuthResult> {
    if (!apiKey) {
      return { success: false, message: 'No API key provided' };
    }

    // Store the key first
    configManager.storeApiKey(apiKey);

    // Verify against the live API
    try {
      const endpoint = configManager.getConfig('cdsEndpoint') as string;
      const res = await request(buildUrl(endpoint, '/patients'), {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (res.statusCode === 200) {
        return { success: true, message: 'API key verified and stored' };
      } else if (res.statusCode === 401) {
        configManager.clearApiKey();
        return { success: false, message: 'Invalid API key — authentication failed (401)' };
      } else if (res.statusCode === 429) {
        // Rate limited but key format is valid
        return { success: true, message: 'API key stored (rate limited during verification, but key format accepted)' };
      } else {
        return { success: true, message: `API key stored (verification returned HTTP ${res.statusCode} — key may still be valid)` };
      }
    } catch (err: any) {
      // Network error — store key anyway, user may be offline
      return { success: true, message: `API key stored (could not verify: ${err.message})` };
    }
  }

  /**
   * Clear the stored API key
   */
  logout(): AuthResult {
    configManager.clearApiKey();
    return { success: true, message: 'API key cleared' };
  }

  /**
   * Check if an API key is configured
   */
  isConfigured(): boolean {
    return !!configManager.getApiKey();
  }

  /**
   * Verify the current API key is still valid
   */
  async verify(): Promise<AuthResult> {
    const apiKey = configManager.getApiKey();
    if (!apiKey) {
      return { success: false, message: 'No API key configured' };
    }

    try {
      const endpoint = configManager.getConfig('cdsEndpoint') as string;
      const res = await request(buildUrl(endpoint, '/patients'), {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (res.statusCode === 200) {
        return { success: true, message: 'API key is valid' };
      } else if (res.statusCode === 401) {
        return { success: false, message: 'API key is invalid or revoked' };
      } else {
        return { success: true, message: `API responded with HTTP ${res.statusCode}` };
      }
    } catch (err: any) {
      return { success: false, message: `Could not reach API: ${err.message}` };
    }
  }

  /**
   * Require a valid API key or throw
   */
  requireAuth(): string {
    return configManager.requireApiKey();
  }

  /**
   * Get auth header for API requests
   */
  getAuthHeader(): Record<string, string> | null {
    return configManager.getAuthHeader();
  }
}

export const authManager = new AuthManager();
