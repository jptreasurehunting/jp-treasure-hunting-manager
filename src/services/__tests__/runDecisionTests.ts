import { runShippingDecisionEngineTests } from './shippingDecisionEngine.test';
import { runShippingDecisionIntegrationTests } from './shippingDecisionIntegration.test';

console.log('🚀 Running Shipping Decision Engine Test Suite...\n');

const foundationResult = runShippingDecisionEngineTests();
console.log('\n--- Foundation Test Logs ---');
foundationResult.log.forEach((line) => console.log(line));

const integrationResult = runShippingDecisionIntegrationTests();
console.log('\n--- Integration Test Logs ---');
integrationResult.log.forEach((line) => console.log(line));

const totalPassed = foundationResult.passed + integrationResult.passed;
const totalFailed = foundationResult.failed + integrationResult.failed;

console.log('\n====================================================');
console.log('       SHIPPING DECISION ENGINE TEST SUMMARY        ');
console.log('====================================================');
console.log(`✅ Foundation Tests: ${foundationResult.passed} passed, ${foundationResult.failed} failed`);
console.log(`✅ Integration Tests: ${integrationResult.passed} passed, ${integrationResult.failed} failed`);
console.log('----------------------------------------------------');
console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed.`);
console.log('====================================================');

if (totalFailed > 0) {
  console.error(`\n❌ Shipping Decision Engine tests failed with ${totalFailed} errors.`);
  (globalThis as any).process?.exit(1);
} else {
  console.log(`\n🎉 All ${totalPassed} Shipping Decision Engine tests passed successfully!`);
}
