/**
 * Standalone Out-of-Process Filesystem Reader CLI (JTH-STEP 36)
 *
 * Executed in a completely separate Node.js OS process to prove cold restart recovery
 * without any shared JavaScript heap memory, module singletons, or global variables.
 *
 * Usage:
 *   npx tsx src/services/__tests__/standaloneFsReader.ts --root <rootDir> --sku <sku> --unit <unitId>
 */

declare const process: any;

import { WindowsIsolatedFsEvidencePersistenceAdapter } from '../windowsIsolatedFsEvidenceAdapter';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let rootDir = '';
  let sku = '';
  let unitId = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && args[i + 1]) {
      rootDir = args[i + 1];
      i++;
    } else if (args[i] === '--sku' && args[i + 1]) {
      sku = args[i + 1];
      i++;
    } else if (args[i] === '--unit' && args[i + 1]) {
      unitId = args[i + 1];
      i++;
    }
  }

  if (!rootDir || !sku || !unitId) {
    process.stdout.write(
      JSON.stringify({
        success: false,
        error: 'MISSING_REQUIRED_CLI_ARGS',
        message: 'Usage: standaloneFsReader.ts --root <rootDir> --sku <sku> --unit <unitId>'
      })
    );
    process.exit(1);
  }

  try {
    const adapter = new WindowsIsolatedFsEvidencePersistenceAdapter({
      baseDirectory: rootDir
    });

    // 1. Cold Load Record
    const loadResult = await adapter.loadRecord(sku, unitId);
    if (!loadResult.success || !loadResult.record) {
      process.stdout.write(
        JSON.stringify({
          success: false,
          status: loadResult.status,
          error: loadResult.error,
          messageJa: loadResult.messageJa
        })
      );
      process.exit(1);
    }

    // 2. Cold Verify Integrity
    const integrity = await adapter.verifyIntegrity(sku, unitId);
    if (!integrity.isValid) {
      process.stdout.write(
        JSON.stringify({
          success: false,
          status: 'HOLD_CORRUPTED_CHECKSUM',
          error: 'INTEGRITY_MISMATCH',
          messageJa: integrity.messageJa
        })
      );
      process.exit(1);
    }

    const rec = loadResult.record!;
    process.stdout.write(
      JSON.stringify({
        success: true,
        processId: process.pid,
        recordId: rec.recordId,
        sku: rec.sku,
        inventoryUnitId: rec.inventoryUnitId,
        recordChecksum: rec.recordChecksum,
        totalPhotoCount: rec.totalPhotoCount,
        usablePhotoCount: rec.usablePhotoCount,
        status: rec.status,
        angles: Object.keys(rec.photos)
      })
    );
    process.exit(0);
  } catch (err: any) {
    process.stdout.write(
      JSON.stringify({
        success: false,
        error: err.message || 'UNEXPECTED_CLI_ERROR'
      })
    );
    process.exit(1);
  }
}

main();
