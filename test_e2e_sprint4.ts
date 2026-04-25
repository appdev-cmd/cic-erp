import './setup-env';
import { ProactiveService } from './services/ai/proactiveService';
import { createSmartPlanTool, analyzeBottleneckTool } from './services/ai/openclaw/tools/planning.tools';

async function runTest() {
  console.log('--- TEST: PROACTIVE SERVICE ---');
  const alerts = await ProactiveService.runDailyAnalysis();
  console.log(JSON.stringify(alerts, null, 2));

  console.log('\n--- TEST: PLANNING AGENT (Analyze Bottleneck) ---');
  const context = { userId: 'e100f7d5-dcd7-4eb7-a5ec-ffae1c8e317d', role: 'admin' };
  const bottleneckRes = await analyzeBottleneckTool.execute({}, context as any);
  console.log(bottleneckRes);

  console.log('\n--- TEST: PLANNING AGENT (Create Smart Plan) ---');
  const planRes = await createSmartPlanTool.execute({ planType: 'weekly', focusArea: 'all' }, context as any);
  console.log(planRes);
}

runTest().catch(console.error);
