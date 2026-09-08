import { runShopeeSgBackendAuthClientTests } from './shopeeSgBackendAuthClient.test';

async function main() {
  const result = await runShopeeSgBackendAuthClientTests();
  console.log(result.log.join('\n'));
  console.log(`Shopee SG Backend Auth Readiness Tests: ${result.passed} passed, ${result.failed} failed`);
  if (result.failed > 0) (globalThis as any).process?.exit(1);
}

main().catch((error) => {
  console.error(error);
  (globalThis as any).process?.exit(1);
});
