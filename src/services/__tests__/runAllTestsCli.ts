import { runAllAppTests } from './runAllTests';

async function main() {
  console.log('🚀 Running JP Treasure Hunting Manager Master Test Suite...\n');

  const results = await runAllAppTests();

  console.log('====================================================');
  console.log('               TEST RESULTS SUMMARY                 ');
  console.log('====================================================');

  results.suites.forEach((suite) => {
    const statusIcon = suite.failed === 0 ? '✅' : '❌';
    console.log(`${statusIcon} ${suite.name}: ${suite.passed} passed, ${suite.failed} failed`);
  });

  console.log('----------------------------------------------------');
  console.log(`TOTAL: ${results.totalPassed} passed, ${results.totalFailed} failed across ${results.suites.length} test suites.`);
  console.log('====================================================');

  if (results.totalFailed > 0) {
    console.error(`\n❌ Test suite failed with ${results.totalFailed} errors.`);
    (globalThis as any).process?.exit(1);
  } else {
    console.log(`\n🎉 All ${results.totalPassed} tests passed successfully!`);
  }
}

main().catch((err) => {
  console.error('Test execution error:', err);
  (globalThis as any).process?.exit(1);
});
