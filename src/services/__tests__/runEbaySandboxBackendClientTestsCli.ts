import { runEbaySandboxBackendClientAsyncTests } from './ebaySandboxBackendClient.test';
import { runEbaySandboxInventorySyncClientTests } from './ebaySandboxInventorySyncClient.test';

async function main() {
  const backendClient = await runEbaySandboxBackendClientAsyncTests();
  const inventorySyncClient = await runEbaySandboxInventorySyncClientTests();
  const passed = backendClient.passed + inventorySyncClient.passed;
  const failed = backendClient.failed + inventorySyncClient.failed;

  console.log(backendClient.log.join('\n'));
  console.log(inventorySyncClient.log.join('\n'));
  console.log(`eBay Sandbox Backend Client Tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) (globalThis as any).process?.exit(1);
}

main().catch((error) => {
  console.error(error);
  (globalThis as any).process?.exit(1);
});
