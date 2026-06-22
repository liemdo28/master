/**
 * Cognitive Task Planner
 * Automatically decomposes developer goals into structured subtasks,
 * calculates complexity metrics and SLA risk levels, and assigns agent roles.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export class CognitiveTaskPlanner {
  constructor() {
    this.agentCapabilities = {
      'Dev_AI': ['coding', 'refactoring', 'debugging', 'patching'],
      'QA_AI': ['testing', 'validation', 'integration checks', 'regression testing'],
      'Infra_AI': ['infrastructure', 'deployment', 'resource monitoring', 'docker'],
      'Security_AI': ['vulnerability scanning', 'dependency audit', 'auth compliance'],
      'Marketing_AI': ['post creation', 'release notes', 'changelog copywriting'],
      'Product_AI': ['planning', 'requirements analysis', 'complexity estimation'],
    };
  }

  /**
   * Plans execution path for a goal
   * @param {string} goal 
   * @returns {object} The cognitive plan including subtasks, risk estimation, and decision graph definition
   */
  plan(goal) {
    const cleanGoal = (goal || '').trim();
    if (!cleanGoal) {
      throw new Error('Goal cannot be empty');
    }

    // 1. Analyze complexity and target details
    const analysis = this._analyzeGoal(cleanGoal);
    
    // 2. Perform SLA risk computation
    const slaRisk = this._computeSlaRisk(analysis.complexity, cleanGoal);

    // 3. Decompose task into logical subtasks
    const subtasks = this._decompose(cleanGoal, analysis.type);

    // 4. Map agent assignments based on subtasks
    const assignments = [...new Set(subtasks.map(s => s.agent))];

    // 5. Generate decision graph mapping
    const decisionGraph = this._generateDecisionGraph(cleanGoal, analysis, slaRisk, subtasks);

    return {
      id: `plan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      goal: cleanGoal,
      type: analysis.type,
      complexity: analysis.complexity,
      slaRisk,
      subtasks,
      assignments,
      decisionGraph,
      timestamp: Date.now()
    };
  }

  _analyzeGoal(goal) {
    const text = goal.toLowerCase();
    let type = 'general';
    let complexity = 3; // base complexity

    // Determine type
    if (text.includes('fix') || text.includes('bug') || text.includes('patch') || text.includes('refactor')) {
      type = 'engineering';
      complexity += 3;
    } else if (text.includes('test') || text.includes('qa') || text.includes('check')) {
      type = 'testing';
      complexity += 2;
    } else if (text.includes('deploy') || text.includes('infrastructure') || text.includes('docker') || text.includes('setup')) {
      type = 'infrastructure';
      complexity += 4;
    } else if (text.includes('vulnerability') || text.includes('security') || text.includes('audit')) {
      type = 'security';
      complexity += 4;
    } else if (text.includes('post') || text.includes('linkedin') || text.includes('marketing') || text.includes('changelog')) {
      type = 'marketing';
      complexity += 1;
    }

    // Adjust complexity based on vocabulary keywords
    if (text.includes('database') || text.includes('db') || text.includes('migration')) complexity += 2;
    if (text.includes('auth') || text.includes('jwt') || text.includes('token') || text.includes('session')) complexity += 2;
    if (text.includes('memory leak') || text.includes('leak') || text.includes('performance')) complexity += 3;
    if (text.includes('global') || text.includes('all') || text.includes('multiple')) complexity += 1;

    // Cap complexity between 1 and 10
    complexity = Math.min(10, Math.max(1, complexity));

    return { type, complexity };
  }

  _computeSlaRisk(complexity, goal) {
    let score = complexity;

    // Check workspace configuration if index file exists (simulate repository size impact)
    const indexPath = '/Users/liemdo/.super-agent-ai/index/global-index.json';
    if (existsSync(indexPath)) {
      try {
        const index = JSON.parse(readFileSync(indexPath, 'utf8'));
        if (index && Array.isArray(index.projects)) {
          // If workspace has many projects, risk goes up slightly
          if (index.projects.length > 5) score += 1;
          // If we detect duplicate projects, risk increases
          const paths = index.projects.map(p => p.path);
          const duplicates = paths.filter((item, index) => paths.indexOf(item) !== index);
          if (duplicates.length > 0) score += 2;
        }
      } catch {}
    }

    // High complexity keywords increase risk
    const text = goal.toLowerCase();
    if (text.includes('prod') || text.includes('production') || text.includes('deploy')) score += 2;
    if (text.includes('security') || text.includes('credential') || text.includes('secret')) score += 3;

    if (score >= 10) return 'CRITICAL';
    if (score >= 7) return 'HIGH';
    if (score >= 4) return 'MEDIUM';
    return 'LOW';
  }

  _decompose(goal, type) {
    const subtasks = [];
    let stepCount = 1;

    // Standard initial steps
    subtasks.push({
      id: `sub_${stepCount++}`,
      title: 'Analyze Goal & Fetch Project Context',
      agent: 'Product_AI',
      duration: '2m',
      status: 'completed'
    });

    if (type === 'engineering') {
      subtasks.push({
        id: `sub_${stepCount++}`,
        title: 'Locate Target Code Modules & Traces',
        agent: 'Dev_AI',
        duration: '5m',
        status: 'pending'
      });
      subtasks.push({
        id: `sub_${stepCount++}`,
        title: 'Identify Vulnerabilities or Bugs',
        agent: 'Security_AI',
        duration: '8m',
        status: 'pending'
      });
      subtasks.push({
        id: `sub_${stepCount++}`,
        title: 'Apply Sandbox Patch & Build Verification',
        agent: 'Dev_AI',
        duration: '10m',
        status: 'pending'
      });
      subtasks.push({
        id: `sub_${stepCount++}`,
        title: 'Perform QA Regression Verification & Tests',
        agent: 'QA_AI',
        duration: '7m',
        status: 'pending'
      });
    } else if (type === 'testing') {
      subtasks.push({
        id: `sub_${stepCount++}`,
        title: 'Map Test Coverage & Assertions',
        agent: 'QA_AI',
        duration: '6m',
        status: 'pending'
      });
      subtasks.push({
        id: `sub_${stepCount++}`,
        title: 'Run Integration and Unit Test suites',
        agent: 'QA_AI',
        duration: '8m',
        status: 'pending'
      });
    } else if (type === 'infrastructure') {
      subtasks.push({
        id: `sub_${stepCount++}`,
        title: 'Verify Environment Variables & Docker configs',
        agent: 'Infra_AI',
        duration: '5m',
        status: 'pending'
      });
      subtasks.push({
        id: `sub_${stepCount++}`,
        title: 'Run Resource Availability checks',
        agent: 'Infra_AI',
        duration: '4m',
        status: 'pending'
      });
      subtasks.push({
        id: `sub_${stepCount++}`,
        title: 'Trigger Deploy Scripts & Monitor Health logs',
        agent: 'Infra_AI',
        duration: '12m',
        status: 'pending'
      });
    } else if (type === 'security') {
      subtasks.push({
        id: `sub_${stepCount++}`,
        title: 'Audit package.json vulnerability logs',
        agent: 'Security_AI',
        duration: '6m',
        status: 'pending'
      });
      subtasks.push({
        id: `sub_${stepCount++}`,
        title: 'Scan secrets leakage in history',
        agent: 'Security_AI',
        duration: '8m',
        status: 'pending'
      });
    } else if (type === 'marketing') {
      subtasks.push({
        id: `sub_${stepCount++}`,
        title: 'Extract key project features list',
        agent: 'Product_AI',
        duration: '3m',
        status: 'pending'
      });
      subtasks.push({
        id: `sub_${stepCount++}`,
        title: 'Generate marketing content templates',
        agent: 'Marketing_AI',
        duration: '5m',
        status: 'pending'
      });
    } else {
      // General task fallback
      subtasks.push({
        id: `sub_${stepCount++}`,
        title: 'Research architecture patterns',
        agent: 'Product_AI',
        duration: '5m',
        status: 'pending'
      });
      subtasks.push({
        id: `sub_${stepCount++}`,
        title: 'Prepare executive checklist proposal',
        agent: 'Product_AI',
        duration: '4m',
        status: 'pending'
      });
    }

    // Always append final report step
    subtasks.push({
      id: `sub_${stepCount++}`,
      title: 'Aggregate Results and Render Reports',
      agent: 'Product_AI',
      duration: '2m',
      status: 'pending'
    });

    return subtasks;
  }

  _generateDecisionGraph(goal, analysis, slaRisk, subtasks) {
    const nodes = [
      { id: 'goal', label: 'Goal Input', type: 'input', status: 'completed' },
      { id: 'dep', label: 'Dependency Resolve', type: 'process', status: 'completed' },
      { id: 'risk', label: `SLA Risk: ${slaRisk}`, type: 'metric', status: 'completed', value: slaRisk },
      { id: 'plan', label: `${analysis.type.toUpperCase()} plan`, type: 'decision', status: 'active' },
      ...subtasks.map(s => ({
        id: s.id,
        label: `${s.agent}: ${s.title}`,
        type: 'step',
        status: s.status,
        agent: s.agent
      }))
    ];

    const edges = [
      { from: 'goal', to: 'dep' },
      { from: 'dep', to: 'risk' },
      { from: 'risk', to: 'plan' }
    ];

    // Link subtasks sequentially from the plan node
    if (subtasks.length > 0) {
      edges.push({ from: 'plan', to: subtasks[0].id });
      for (let i = 0; i < subtasks.length - 1; i++) {
        edges.push({ from: subtasks[i].id, to: subtasks[i + 1].id });
      }
    }

    return { nodes, edges };
  }
}

export const cognitiveTaskPlanner = new CognitiveTaskPlanner();
export default CognitiveTaskPlanner;
