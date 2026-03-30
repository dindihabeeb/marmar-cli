# MARMAR CLI

Streamline integration of EMR systems and third-party health innovations with the MARMAR Clinical Decision Support (CDS) API/SDK.

Instead of manually reading documentation and writing integration code (which typically takes weeks), the MARMAR CLI scans your codebase, identifies where clinical data flows, and inserts the right `@marmarteam/sdk` calls — with full review and rollback support.

## Quick Start

```bash
# Install dependencies and build
npm install typescript ts-node @types/node --save-dev
npm run build

# Link globally (optional)
npm link

# 1. Get your API key from https://portal.marmar.life → Settings → API Keys
marmar login --api-key mk_your_key_here

# 2. Scan your project (use the sample emr project in this repo to test)
marmar scan --dir ./your-emr-project

# 3. Integrate (with review)
marmar integrate --dir ./your-emr-project

# Or preview without making changes
marmar integrate --dir ./your-emr-project --dry-run
```

## How It Works

The CLI understands the MARMAR CDS API surface and the `@marmarteam/sdk`:

1. **Scan** — Analyzes your JS/TS project to find route handlers that process patient data, medication orders, clinical assessments, and webhook endpoints.

2. **Integrate** — Generates code that uses the real SDK methods:
   - `createMarmarClient()` initialization
   - `client.createOrUpdatePatient()` for patient data sync
   - `client.createAssessment()` for medication safety checks
   - `verifyWebhookSignature()` for webhook handlers
   - Environment variable configuration (`MARMAR_API_KEY`, `MARMAR_WEBHOOK_SECRET`)
   - `@marmarteam/sdk` dependency in package.json

3. **Review** — Every change is presented as a diff. Approve individually, in batch, or auto-approve. All changes support rollback.

## Commands

### `marmar login [--api-key <key>]`
Store your API key and verify it against the live API. Keys are obtained from the [Tenant Dashboard](https://portal.marmar.life) under Settings → API Keys.

### `marmar logout`
Clear the stored API key.

### `marmar status`
Check whether your API key is configured and valid.

### `marmar config <subcommand>`

| Subcommand | Description |
|---|---|
| `config view` | Show all current settings |
| `config set --api-key <key>` | Store API key securely |
| `config set --endpoint <url>` | Set CDS endpoint (default: `https://cds.marmar.life/v1`) |
| `config set --environment <env>` | Set environment (development/staging/production) |
| `config delete` | Remove all configuration |

### `marmar scan [--dir <path>]`
Scan a JavaScript/TypeScript project for MARMAR CDS integration points. Detects:

- **Frameworks**: Express, Fastify, NestJS, Next.js, Koa
- **Patient routes**: Endpoints handling patient/clinical/medication data
- **Assessment triggers**: Prescription, dispensing, ordering endpoints
- **Webhook handlers**: Callback/notification endpoints
- **Missing SDK**: Whether `@marmarteam/sdk` is installed
- **Missing env vars**: Whether `MARMAR_API_KEY` is configured

### `marmar integrate [--dir <path>] [--dry-run] [--auto-approve]`
Generate and apply integration code.

| Flag | Description |
|---|---|
| `--dir <path>` | Target project directory (default: `.`) |
| `--dry-run` | Preview changes without modifying files |
| `--auto-approve` | Skip review and apply all changes |

## Architecture

```
src/
  index.ts                  # CLI entry point, command parser & router
  commands/
    auth.ts                 # login, logout, status
    config.ts               # config view/set/delete
    scan.ts                 # codebase scanning
    integrate.ts            # code integration & review
  core/
    auth-manager.ts         # API key storage and verification (FR 1)
    config-manager.ts       # Configuration management (FR 3)
    codebase-scanner.ts     # Project scanning for integration points (FR 2.1)
    code-integrator.ts      # Code generation, review, apply, rollback (FR 2.2, FR 2.3)
  utils/
    colors.ts               # Terminal colors & formatting
    diff.ts                 # Diff generation & display
    http.ts                 # HTTP client (Node.js built-ins only)
    prompt.ts               # Interactive prompts (readline-based)
```

### Design Decisions

- **Zero external runtime dependencies** — Uses only Node.js built-in modules (`fs`, `path`, `os`, `crypto`, `http`, `https`, `readline`). Only TypeScript is needed as a dev dependency for building.
- **Matches the real API** — Auth model uses static Bearer token keys (no session exchange). Templates reference actual `@marmarteam/sdk` methods. Base URL defaults to `https://cds.marmar.life/v1`.
- **Credentials stored securely** — API key in `~/.marmar/.credentials` with `0600` permissions.
- **Rollback support** — All code changes tracked and reversible.
- **Offline scanning** — `scan` is fully local. Only `status` and `login` hit the network.

## Configuration

Stored in `~/.marmar/`:
- `config.json` — Endpoint, environment, scan patterns
- `.credentials` — API key (restricted permissions)

## API Reference

The MARMAR CDS API that this CLI integrates against:

| Endpoint | Method | Description |
|---|---|---|
| `/v1/patients` | GET | List patients for tenant |
| `/v1/patients` | POST | Create or update a patient |
| `/v1/assessments` | POST | Create medication safety assessment |
| `/v1/assessments/{id}` | GET | Retrieve assessment results |
| `/v1/assessments/{id}` | PATCH | Update assessment review status |
| `/v1/webhooks` | POST | Create a webhook |
| `/v1/webhooks` | GET | List webhooks |
| `/v1/webhooks/{id}` | PATCH | Update a webhook |
| `/v1/fhir/$submit` | POST | Submit FHIR bundle |
| `/v1/fhir/{type}/{id}` | GET | Retrieve FHIR resource |

Full docs: https://docs.cds.marmar.life

## Requirements

- Node.js 18+
- TypeScript 5+ (dev dependency, for building)

## Development

```bash
# Run without building
npx ts-node src/index.ts help
npx ts-node src/index.ts scan --dir ./test-project

# Build
npm run build

# Run built version
node dist/index.js help
```

## Environment Variables

| Variable | Description |
|---|---|
| `MARMAR_API_KEY` | API key (alternative to `marmar login`) |
| `MARMAR_CDS_ENDPOINT` | Override CDS endpoint |
| `MARMAR_WEBHOOK_SECRET` | Webhook signature verification secret |
| `MARMAR_DEBUG` | Enable debug output |
