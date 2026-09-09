import { runShopeeSgAuthorizationSessionClientTests } from './shopeeSgAuthorizationSessionClient.test';

async function main() {
  const result = await runShopeeSgAuthorizationSessionClientTests();
  console.log(result.log.join('\n'));
  console.log(`Shopee SG Authorization Session Client Tests: ${result.passed} passed, ${result.failed} failed`);
  if (result.failed > 0) (globalThis as any).process?.exit(1);
}
main().catch((error) => { console.error(error); (globalThis as any).process?.exit(1); });
