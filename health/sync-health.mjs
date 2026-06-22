#!/usr/bin/env node
/**
 * sync-health.mjs — CLI runner for Mi Health V1
 *
 * Usage:
 *   node sync-health.mjs sync            # sync from latest export file
 *   node sync-health.mjs sync --force    # force re-sync all data
 *   node sync-health.mjs status          # show connector status
 *   node sync-health.mjs score           # print health score
 *   node sync-health.mjs alerts          # run alert check and show results
 *   node sync-health.mjs briefing        # print morning briefing health block
 *   node sync-health.mjs query "<text>"  # answer a health query
 *   node sync-health.mjs build-kb        # rebuild knowledge cache
 */

import { HealthConnector } from './HealthConnector.mjs';
import { computeHealthScore } from './HealthScoreEngine.mjs';
import { runAlertCheck, getFormattedAlerts } from './HealthAlertEngine.mjs';
import { buildHealthBriefingBlock, formatHealthBriefingText } from './HealthBriefingIntegration.mjs';
import { handleHealthQuery } from './HealthQueryHandler.mjs';
import { saveToVisibilityCache } from './HealthKnowledgeBuilder.mjs';

const connector = new HealthConnector();
const [,, cmd, ...args] = process.argv;

async function main() {
  switch (cmd) {
    case 'sync': {
      console.log('🔄 Syncing health data...');
      const force = args.includes('--force');
      const result = await connector.sync({ force });
      if (result.ok) {
        if (result.synced) {
          console.log(`✅ Synced: ${result.synced.days} days, ${result.synced.sleep} sleep sessions, ${result.synced.hr} HR samples, ${result.synced.workouts} workouts`);
        } else {
          console.log(`✅ ${result.message}`);
        }
        // Auto-rebuild knowledge cache after sync
        console.log('📚 Updating knowledge cache...');
        saveToVisibilityCache();
        console.log('✅ Knowledge cache updated.');
      } else {
        console.error(`❌ Sync failed: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case 'status': {
      const snapshot = await connector.getSnapshot();
      console.log('\n=== Health Connector Status ===');
      console.log(`Name:        ${snapshot.name}`);
      console.log(`Status:      ${snapshot.status}`);
      console.log(`Configured:  ${connector.isConfigured()}`);
      console.log(`Export path: ${connector.exportPath || 'not found'}`);
      console.log(`Last sync:   ${snapshot.last_sync || 'never'}`);
      if (snapshot.today) {
        const d = snapshot.today;
        console.log(`\nToday:`);
        if (d.steps)      console.log(`  Steps:      ${d.steps.toLocaleString()}`);
        if (d.resting_hr) console.log(`  Resting HR: ${d.resting_hr.toFixed(0)} bpm`);
        if (d.hrv_ms)     console.log(`  HRV:        ${d.hrv_ms.toFixed(1)} ms`);
      }
      break;
    }

    case 'score': {
      const score = computeHealthScore(7);
      if (!score) { console.log('Not enough data for health score.'); break; }
      console.log(`\n=== Executive Health Score ===`);
      console.log(`Score: ${score.score}/100 (${score.grade})`);
      if (score.delta !== null) console.log(`Delta: ${score.delta > 0 ? '+' : ''}${score.delta} vs last week`);
      console.log(`\nComponents:`);
      for (const [key, comp] of Object.entries(score.components)) {
        console.log(`  ${key.padEnd(15)} ${comp.grade.padEnd(4)} ${comp.score}/100 — ${comp.detail}`);
      }
      if (score.explanation) console.log(`\n${score.explanation}`);
      if (score.recommendations.length) {
        console.log(`\nRecommendations:`);
        for (const r of score.recommendations) console.log(`  • ${r}`);
      }
      break;
    }

    case 'alerts': {
      const today = new Date().toISOString().split('T')[0];
      const fresh = runAlertCheck(today);
      const formatted = getFormattedAlerts(7);
      if (!formatted?.has_alerts && !fresh.length) {
        console.log('✅ No health alerts. All metrics within normal range.');
      } else {
        console.log('\n=== Health Alerts ===');
        console.log(formatted?.summary_vi || 'No alerts.');
      }
      break;
    }

    case 'briefing': {
      const block = buildHealthBriefingBlock();
      console.log('\n' + formatHealthBriefingText(block));
      break;
    }

    case 'query': {
      const query = args.join(' ');
      if (!query) { console.log('Usage: sync-health.mjs query "<text>"'); break; }
      const response = await handleHealthQuery(query);
      console.log('\n' + response);
      break;
    }

    case 'build-kb': {
      console.log('📚 Building knowledge cache...');
      const cache = saveToVisibilityCache();
      console.log(`✅ Knowledge cache built. Score: ${cache.health_score?.score || 'N/A'}`);
      break;
    }

    default: {
      console.log(`Mi Health V1 CLI
Commands:
  sync [--force]    Sync from Apple Health export
  status            Show connector status
  score             Print 7-day health score
  alerts            Run alert check
  briefing          Print morning briefing block
  query "<text>"    Answer a health query
  build-kb          Rebuild knowledge cache`);
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
