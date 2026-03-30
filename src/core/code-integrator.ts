/**
 * CodeIntegrator — FR 2.2 / FR 2.3 (Code Integration and Code Review)
 *
 * Generates code changes based on scan results, using templates that match
 * the actual @marmarteam/sdk API surface:
 *
 * - createMarmarClient({ baseUrl, apiKey })
 * - client.createOrUpdatePatient()
 * - client.createAssessment()
 * - client.getAssessment()
 * - client.listPatients()
 * - client.configureTenantWebhook()
 * - verifyWebhookSignature()
 *
 * All templates reference the real SDK package and API patterns from
 * https://docs.cds.marmar.life
 */
import * as fs from 'fs';
import * as path from 'path';
import { IntegrationPoint, ScanReport, PointType } from './codebase-scanner';

export type ChangeStatus = 'pending' | 'approved' | 'declined' | 'applied' | 'rolled_back';

export interface CodeChange {
  changeId: string;
  targetFile: string;
  lineNumber: number;
  originalCode: string;
  newCode: string;
  status: ChangeStatus;
  pointType: PointType;
  description: string;
}

export interface IntegrationResult {
  success: boolean;
  changesApplied: number;
  changesDeclined: number;
  errors: string[];
}

/**
 * Templates matching the real @marmarteam/sdk API.
 */
const TEMPLATES: Record<string, (ctx: TemplateContext) => string> = {

  'sdk_import': () =>
`import { createMarmarClient } from '@marmarteam/sdk';`,

  'sdk_import:webhook': () =>
`import { createMarmarClient, verifyWebhookSignature } from '@marmarteam/sdk';`,

  'client_init': () =>
`
// Initialize MARMAR CDS client
const marmar = createMarmarClient({
  baseUrl: process.env.MARMAR_CDS_ENDPOINT || 'https://cds.marmar.life/v1',
  apiKey: process.env.MARMAR_API_KEY!,
});`,

  'patient_route': (ctx) =>
`  // MARMAR CDS: Sync patient data for medication safety analysis
  // await marmar.createOrUpdatePatient({
  //   externalId: patient.mrn,
  //   demographics: {
  //     firstName: patient.firstName,
  //     lastName: patient.lastName,
  //     sex: patient.sex,
  //     dateOfBirth: patient.dob,
  //   },
  // });`,

  'assessment_route': () =>
`  // MARMAR CDS: Trigger medication safety assessment
  // const assessment = await marmar.createAssessment({
  //   patient: { patientId: marmarPatientId },
  //   medications: [
  //     { name: 'Metformin', dosage: { amount: 500, unit: 'mg', frequency: 'BID' } },
  //   ],
  // });
  // console.log(\`Assessment \${assessment.assessmentId} queued\`);`,

  'webhook_handler': () =>
`  // MARMAR CDS: Verify webhook signature
  // const signature = req.header('X-Marmar-Signature')!;
  // const timestamp = req.header('X-Marmar-Timestamp')!;
  // const result = verifyWebhookSignature({
  //   payload: req.body,
  //   signature,
  //   secret: process.env.MARMAR_WEBHOOK_SECRET!,
  //   timestamp,
  // });
  // if (!result.valid) return res.sendStatus(400);`,

  'middleware:webhook': () =>
`// Raw body parser for MARMAR webhook signature verification
app.use('/webhooks/marmar', express.raw({ type: 'application/json' }));`,

  'env_config': () =>
`
# MARMAR CDS Configuration
# Get your API key from https://portal.marmar.life → Settings → API Keys
MARMAR_API_KEY=your_api_key_here
MARMAR_CDS_ENDPOINT=https://cds.marmar.life/v1
# MARMAR_WEBHOOK_SECRET=your_webhook_secret_here`,

  'package_json': () =>
`"@marmarteam/sdk": "^1.0.0"`,
};

interface TemplateContext {
  framework: string;
  hasWebhooks: boolean;
}

export class CodeIntegrator {
  private pendingChanges: CodeChange[] = [];
  private approvedChanges: CodeChange[] = [];
  private rollbackStack: CodeChange[] = [];
  private projectPath: string = '';

  /**
   * Prepare code changes based on scan results
   */
  async prepareChanges(scanReport: ScanReport): Promise<CodeChange[]> {
    this.pendingChanges = [];
    this.approvedChanges = [];
    this.rollbackStack = [];
    this.projectPath = scanReport.projectPath;

    const framework = scanReport.projectStructure.framework || 'default';
    const hasWebhooks = scanReport.integrationPoints.some(p => p.pointType === 'webhook_handler');
    const ctx: TemplateContext = { framework, hasWebhooks };

    for (const point of scanReport.integrationPoints) {
      const change = this.createChange(point, ctx);
      if (change) {
        this.pendingChanges.push(change);
      }
    }

    return this.pendingChanges;
  }

  private createChange(point: IntegrationPoint, ctx: TemplateContext): CodeChange | null {
    const fullPath = path.join(this.projectPath, point.filePath);
    const changeId = `${point.pointType}-${point.filePath}-${point.lineNumber}`;

    // Select the right template
    let templateKey = point.pointType as string;
    if (point.pointType === 'sdk_import' && ctx.hasWebhooks) {
      templateKey = 'sdk_import:webhook';
    }
    if (point.pointType === 'middleware') {
      templateKey = 'middleware:webhook';
    }

    const templateFn = TEMPLATES[templateKey];
    if (!templateFn) return null;
    const template = templateFn(ctx).trim();

    try {
      if (point.pointType === 'package_json') {
        return this.createPackageJsonChange(fullPath, template, changeId);
      }
      if (point.pointType === 'env_config') {
        return this.createEnvChange(fullPath, template, changeId, point);
      }

      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      let originalCode = '';
      let newCode = '';

      switch (point.pointType) {
        case 'sdk_import': {
          const idx = point.lineNumber - 1;
          originalCode = lines[idx] || '';
          newCode = `${originalCode}\n${template}`;
          break;
        }
        case 'client_init': {
          const idx = point.lineNumber - 1;
          originalCode = lines[idx] || '';
          newCode = `${originalCode}\n${template}`;
          break;
        }
        case 'patient_route':
        case 'assessment_route':
        case 'webhook_handler': {
          const idx = point.lineNumber - 1;
          originalCode = lines[idx] || '';
          newCode = `${originalCode}\n${template}`;
          break;
        }
        case 'middleware': {
          const idx = point.lineNumber - 1;
          originalCode = lines[idx] || '';
          const indent = originalCode.match(/^\s*/)?.[0] || '';
          newCode = `${indent}${template}\n\n${originalCode}`;
          break;
        }
        default:
          return null;
      }

      return {
        changeId,
        targetFile: point.filePath,
        lineNumber: point.lineNumber,
        originalCode,
        newCode,
        status: 'pending',
        pointType: point.pointType,
        description: point.suggestion,
      };
    } catch {
      return null;
    }
  }

  private createPackageJsonChange(
    fullPath: string, template: string, changeId: string
  ): CodeChange | null {
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const depsMatch = content.match(/"dependencies"\s*:\s*\{/);
      if (depsMatch && depsMatch.index !== undefined) {
        const originalLine = depsMatch[0];
        const newLine = `${originalLine}\n    ${template},`;
        return {
          changeId,
          targetFile: 'package.json',
          lineNumber: 1,
          originalCode: originalLine,
          newCode: newLine,
          status: 'pending',
          pointType: 'package_json',
          description: 'Add @marmarteam/sdk dependency',
        };
      }
    } catch {}
    return null;
  }

  private createEnvChange(
    fullPath: string, template: string, changeId: string, point: IntegrationPoint
  ): CodeChange {
    let originalCode = '';
    try { originalCode = fs.readFileSync(fullPath, 'utf-8'); } catch {}

    return {
      changeId,
      targetFile: point.filePath,
      lineNumber: 1,
      originalCode: originalCode.slice(-100),
      newCode: `${originalCode.trimEnd()}\n${template}\n`,
      status: 'pending',
      pointType: 'env_config',
      description: 'Add MARMAR CDS environment variables',
    };
  }

  // --- Review and apply ---

  getPendingChanges(): CodeChange[] {
    return this.pendingChanges.filter(c => c.status === 'pending');
  }

  approveChange(changeId: string): void {
    const change = this.pendingChanges.find(c => c.changeId === changeId);
    if (change) { change.status = 'approved'; this.approvedChanges.push(change); }
  }

  declineChange(changeId: string): void {
    const change = this.pendingChanges.find(c => c.changeId === changeId);
    if (change) change.status = 'declined';
  }

  approveAll(): void {
    for (const c of this.pendingChanges) {
      if (c.status === 'pending') { c.status = 'approved'; this.approvedChanges.push(c); }
    }
  }

  declineAll(): void {
    for (const c of this.pendingChanges) {
      if (c.status === 'pending') c.status = 'declined';
    }
  }

  applyApprovedChanges(): IntegrationResult {
    const result: IntegrationResult = {
      success: true,
      changesApplied: 0,
      changesDeclined: this.pendingChanges.filter(c => c.status === 'declined').length,
      errors: [],
    };

    // Group by file
    const changesByFile = new Map<string, CodeChange[]>();
    for (const change of this.approvedChanges) {
      if (change.status !== 'approved') continue;
      const arr = changesByFile.get(change.targetFile) || [];
      arr.push(change);
      changesByFile.set(change.targetFile, arr);
    }

    for (const [file, changes] of changesByFile) {
      try {
        const fullPath = path.join(this.projectPath, file);
        let content = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : '';

        // Apply from bottom up to preserve line numbers
        changes.sort((a, b) => b.lineNumber - a.lineNumber);

        for (const change of changes) {
          if (change.pointType === 'env_config') {
            content = change.newCode;
          } else if (change.pointType === 'package_json') {
            content = content.replace(change.originalCode, change.newCode);
          } else {
            const lines = content.split('\n');
            const idx = change.lineNumber - 1;
            if (idx >= 0 && idx < lines.length) {
              lines[idx] = change.newCode;
              content = lines.join('\n');
            }
          }
          change.status = 'applied';
          this.rollbackStack.push({ ...change });
          result.changesApplied++;
        }

        fs.writeFileSync(fullPath, content, 'utf-8');
      } catch (err: any) {
        result.success = false;
        result.errors.push(`Failed to apply to ${file}: ${err.message}`);
      }
    }

    return result;
  }

  rollbackChange(changeId: string): boolean {
    const change = this.rollbackStack.find(c => c.changeId === changeId);
    if (!change) return false;
    try {
      const fullPath = path.join(this.projectPath, change.targetFile);
      let content = fs.readFileSync(fullPath, 'utf-8');
      content = content.replace(change.newCode, change.originalCode);
      fs.writeFileSync(fullPath, content, 'utf-8');
      change.status = 'rolled_back';
      return true;
    } catch { return false; }
  }

  rollbackAll(): number {
    let count = 0;
    for (let i = this.rollbackStack.length - 1; i >= 0; i--) {
      if (this.rollbackChange(this.rollbackStack[i].changeId)) count++;
    }
    return count;
  }
}

export const codeIntegrator = new CodeIntegrator();
