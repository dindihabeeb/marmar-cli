/**
 * CodebaseScanner — FR 2.1 (Codebase Scanning)
 *
 * Scans JavaScript/TypeScript projects to identify where MARMAR CDS
 * integration code should be inserted. Detects:
 *
 * - Where to add @marmarteam/sdk imports
 * - Where to initialize createMarmarClient()
 * - Route handlers that handle patient or clinical data
 * - Webhook endpoint handlers
 * - Express middleware registration points
 * - Environment config files missing MARMAR_API_KEY
 * - package.json missing @marmarteam/sdk
 */
import * as fs from 'fs';
import * as path from 'path';

export type PointType =
  | 'sdk_import'         // Where to add @marmarteam/sdk import
  | 'client_init'        // Where to initialize createMarmarClient()
  | 'patient_route'      // Route handlers dealing with patient data
  | 'assessment_route'   // Route handlers where assessments should be triggered
  | 'webhook_handler'    // Webhook endpoint that should verify MARMAR signatures
  | 'middleware'          // Middleware insertion points
  | 'env_config'         // .env files missing MARMAR_API_KEY
  | 'package_json';      // package.json missing @marmarteam/sdk

export interface IntegrationPoint {
  filePath: string;
  lineNumber: number;
  pointType: PointType;
  context: string;
  suggestion: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ScanReport {
  projectPath: string;
  scannedFiles: number;
  supportedLanguages: string[];
  integrationPoints: IntegrationPoint[];
  projectStructure: ProjectStructure;
  timestamp: string;
}

export interface ProjectStructure {
  hasPackageJson: boolean;
  hasTypeScript: boolean;
  hasMarmarSdk: boolean;
  framework: string | null;
  entryPoint: string | null;
  srcDirectory: string | null;
}

// Patterns for detecting clinical/health data routes
const PATIENT_ROUTE_PATTERNS = [
  /['"]\/?patients?['"]/i,
  /['"]\/?patient[/:]/i,
  /['"]\/?emr['"]/i,
  /['"]\/?ehr['"]/i,
  /['"]\/?clinical['"]/i,
  /['"]\/?medication/i,
  /['"]\/?prescription/i,
  /['"]\/?diagnosis/i,
  /['"]\/?vitals?['"]/i,
  /['"]\/?lab[s-]?/i,
  /['"]\/?allerg/i,
  /['"]\/?encounter/i,
];

const ASSESSMENT_TRIGGER_PATTERNS = [
  /['"]\/?assess/i,
  /['"]\/?risk['"]/i,
  /['"]\/?safety['"]/i,
  /['"]\/?check['"]/i,
  /['"]\/?review['"]/i,
  /['"]\/?prescri/i,          // prescribe / prescription endpoints
  /['"]\/?dispens/i,          // dispense endpoints
  /['"]\/?order/i,            // medication order endpoints
];

const WEBHOOK_PATTERNS = [
  /['"]\/?webhook/i,
  /['"]\/?hook/i,
  /['"]\/?callback/i,
  /['"]\/?notify/i,
];

const ROUTE_PATTERNS = [
  /\.(get|post|put|delete|patch)\s*\(\s*['"]/,
  /router\.(get|post|put|delete|patch)\s*\(/,
  /@(Get|Post|Put|Delete|Patch)\s*\(/,
  /app\.(get|post|put|delete|patch)\s*\(/,
];

const MIDDLEWARE_PATTERNS = [
  /app\.use\s*\(/,
  /router\.use\s*\(/,
];

const IMPORT_PATTERNS = [
  /^import\s+/,
  /^const\s+\w+\s*=\s*require\s*\(/,
];

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.next', '.nuxt', '.cache', 'tmp', '.turbo',
]);

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

export class CodebaseScanner {
  private targetDirectory: string = '';
  private integrationPoints: IntegrationPoint[] = [];

  scanDirectory(dirPath: string): ScanReport {
    this.targetDirectory = path.resolve(dirPath);
    this.integrationPoints = [];

    if (!fs.existsSync(this.targetDirectory)) {
      throw new Error(`Directory not found: ${this.targetDirectory}`);
    }

    const structure = this.analyzeCodeStructure();
    const files = this.collectFiles(this.targetDirectory);

    for (const file of files) {
      this.scanFile(file, structure);
    }

    this.checkPackageJson(structure);
    this.checkEnvConfig();

    // Sort: high confidence first
    this.integrationPoints.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.confidence] - order[b.confidence];
    });

    return {
      projectPath: this.targetDirectory,
      scannedFiles: files.length,
      supportedLanguages: ['javascript', 'typescript'],
      integrationPoints: this.integrationPoints,
      projectStructure: structure,
      timestamp: new Date().toISOString(),
    };
  }

  private analyzeCodeStructure(): ProjectStructure {
    const structure: ProjectStructure = {
      hasPackageJson: false,
      hasTypeScript: false,
      hasMarmarSdk: false,
      framework: null,
      entryPoint: null,
      srcDirectory: null,
    };

    const pkgPath = path.join(this.targetDirectory, 'package.json');
    if (fs.existsSync(pkgPath)) {
      structure.hasPackageJson = true;
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

        if (allDeps['@marmarteam/sdk']) structure.hasMarmarSdk = true;
        if (allDeps['express']) structure.framework = 'express';
        else if (allDeps['fastify']) structure.framework = 'fastify';
        else if (allDeps['@nestjs/core']) structure.framework = 'nestjs';
        else if (allDeps['next']) structure.framework = 'nextjs';
        else if (allDeps['koa']) structure.framework = 'koa';

        structure.entryPoint = pkg.main || null;
        if (allDeps['typescript']) structure.hasTypeScript = true;
      } catch {}
    }

    if (fs.existsSync(path.join(this.targetDirectory, 'tsconfig.json'))) {
      structure.hasTypeScript = true;
    }

    for (const dir of ['src', 'lib', 'app', 'server']) {
      if (fs.existsSync(path.join(this.targetDirectory, dir))) {
        structure.srcDirectory = dir;
        break;
      }
    }

    return structure;
  }

  private collectFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.collectFiles(fullPath));
      } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
    return files;
  }

  private scanFile(filePath: string, structure: ProjectStructure): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relPath = path.relative(this.targetDirectory, filePath);

    // Skip files that already import @marmarteam/sdk
    const alreadyImportsMarmar = lines.some(l =>
      l.includes('@marmarteam/sdk') || l.includes('marmar')
    );

    let lastImportLine = -1;
    let hasRoutes = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Track last import line
      if (IMPORT_PATTERNS.some(p => p.test(line))) {
        lastImportLine = lineNum;
      }

      // Is this a route handler?
      const isRoute = ROUTE_PATTERNS.some(p => p.test(line));
      if (!isRoute) continue;
      hasRoutes = true;

      // Classify the route
      if (PATIENT_ROUTE_PATTERNS.some(p => p.test(line))) {
        this.integrationPoints.push({
          filePath: relPath,
          lineNumber: lineNum,
          pointType: 'patient_route',
          context: line.trim(),
          suggestion: 'Sync patient data with MARMAR CDS via client.createOrUpdatePatient()',
          confidence: 'high',
        });
      }

      if (ASSESSMENT_TRIGGER_PATTERNS.some(p => p.test(line))) {
        this.integrationPoints.push({
          filePath: relPath,
          lineNumber: lineNum,
          pointType: 'assessment_route',
          context: line.trim(),
          suggestion: 'Trigger medication safety assessment via client.createAssessment()',
          confidence: 'high',
        });
      }

      if (WEBHOOK_PATTERNS.some(p => p.test(line))) {
        this.integrationPoints.push({
          filePath: relPath,
          lineNumber: lineNum,
          pointType: 'webhook_handler',
          context: line.trim(),
          suggestion: 'Verify MARMAR webhook signatures with verifyWebhookSignature()',
          confidence: 'high',
        });
      }

      // Generic route that could benefit from CDS
      if (!PATIENT_ROUTE_PATTERNS.some(p => p.test(line)) &&
          !ASSESSMENT_TRIGGER_PATTERNS.some(p => p.test(line)) &&
          !WEBHOOK_PATTERNS.some(p => p.test(line))) {
        // Only flag POST routes as low-confidence candidates
        if (/\.post\s*\(/i.test(line)) {
          this.integrationPoints.push({
            filePath: relPath,
            lineNumber: lineNum,
            pointType: 'patient_route',
            context: line.trim(),
            suggestion: 'Potential clinical data endpoint — consider MARMAR CDS integration',
            confidence: 'low',
          });
        }
      }
    }

    // If this file has routes, suggest adding SDK import and client init
    if (hasRoutes && !alreadyImportsMarmar) {
      if (lastImportLine > 0) {
        this.integrationPoints.push({
          filePath: relPath,
          lineNumber: lastImportLine,
          pointType: 'sdk_import',
          context: lines[lastImportLine - 1].trim(),
          suggestion: "Add: import { createMarmarClient } from '@marmarteam/sdk';",
          confidence: 'high',
        });
      }

      // Find app creation for client initialization
      for (let i = 0; i < lines.length; i++) {
        if (/const\s+app\s*=\s*(express|fastify|new Koa)\s*\(/.test(lines[i]) ||
            /createApp|createServer|NestFactory\.create/.test(lines[i])) {
          this.integrationPoints.push({
            filePath: relPath,
            lineNumber: i + 2,
            pointType: 'client_init',
            context: lines[i].trim(),
            suggestion: 'Initialize MARMAR client: createMarmarClient({ baseUrl, apiKey })',
            confidence: 'high',
          });
          break;
        }
      }
    }

    // Detect middleware registration points for webhook verification middleware
    if (!alreadyImportsMarmar) {
      for (let i = 0; i < lines.length; i++) {
        if (MIDDLEWARE_PATTERNS.some(p => p.test(lines[i]))) {
          // Only suggest if there are webhook-related routes
          const hasWebhookRoutes = this.integrationPoints.some(
            p => p.filePath === relPath && p.pointType === 'webhook_handler'
          );
          if (hasWebhookRoutes) {
            this.integrationPoints.push({
              filePath: relPath,
              lineNumber: i + 1,
              pointType: 'middleware',
              context: lines[i].trim(),
              suggestion: 'Add raw body parser middleware for webhook signature verification',
              confidence: 'medium',
            });
            break;
          }
        }
      }
    }
  }

  private checkPackageJson(structure: ProjectStructure): void {
    if (!structure.hasPackageJson || structure.hasMarmarSdk) return;

    this.integrationPoints.push({
      filePath: 'package.json',
      lineNumber: 1,
      pointType: 'package_json',
      context: 'dependencies section',
      suggestion: 'Add @marmarteam/sdk to dependencies: npm install @marmarteam/sdk',
      confidence: 'high',
    });
  }

  private checkEnvConfig(): void {
    const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];
    for (const envFile of envFiles) {
      const envPath = path.join(this.targetDirectory, envFile);
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        if (!content.includes('MARMAR_API_KEY')) {
          this.integrationPoints.push({
            filePath: envFile,
            lineNumber: 1,
            pointType: 'env_config',
            context: envFile,
            suggestion: 'Add MARMAR_API_KEY (and optionally MARMAR_WEBHOOK_SECRET)',
            confidence: 'high',
          });
        }
        break;
      }
    }
  }
}

export const codebaseScanner = new CodebaseScanner();
