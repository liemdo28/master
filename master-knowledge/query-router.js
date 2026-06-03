'use strict';

const engine = require('./knowledge-engine');

/**
 * Routes a natural language question to the correct knowledge-engine function.
 * Returns a structured JSON result.
 *
 * @param {string} question
 * @returns {{ question: string, answer: any, evidence: any, source: string, timestamp: string }}
 */
function route(question) {
  const q = (question || '').trim().toLowerCase();
  const timestamp = new Date().toISOString();
  const source = 'MASTER_INDEX.json';

  // ── How many projects? ───────────────────────────────────────────────────
  if (/how many project|count.*project|project.*count|total.*project/.test(q)) {
    const result = engine.projectCount();
    return {
      question,
      answer: `There are ${result.count} projects.`,
      evidence: { count: result.count },
      source,
      timestamp,
    };
  }

  // ── Largest project ───────────────────────────────────────────────────────
  if (/largest project|biggest project|most lines|most files/.test(q)) {
    const result = engine.largestProject();
    const p = result.project;
    if (p === 'UNKNOWN') {
      return { question, answer: 'UNKNOWN', evidence: null, source, timestamp };
    }
    return {
      question,
      answer: `The largest project is "${p.display_name}" (${p.project_name}) with ${p.total_lines.toLocaleString()} lines across ${p.total_files.toLocaleString()} files.`,
      evidence: {
        project_name: p.project_name,
        display_name: p.display_name,
        total_lines: p.total_lines,
        total_files: p.total_files,
        size_bytes: p.size_bytes,
      },
      source,
      timestamp,
    };
  }

  // ── Projects modified this week / recently ────────────────────────────────
  if (/this week|last week|modified.*week|recent|past.*day|last.*day/.test(q)) {
    let days = 7;
    const daysMatch = q.match(/(\d+)\s*day/);
    if (daysMatch) days = parseInt(daysMatch[1], 10);
    const result = engine.recentProjects(days);
    const names = result.projects.map((p) => p.display_name || p.project_name);
    return {
      question,
      answer:
        result.total === 0
          ? `No projects were modified in the last ${days} days.`
          : `${result.total} project(s) modified in the last ${days} days: ${names.join(', ')}.`,
      evidence: { days, total: result.total, projects: names },
      source,
      timestamp,
    };
  }

  // ── Projects using a specific framework / tool ────────────────────────────
  const frameworkPatterns = [
    { pattern: /playwright/, fw: 'Playwright' },
    { pattern: /docker/, fw: 'Docker' },
    { pattern: /next\.?js|nextjs/, fw: 'Next' },
    { pattern: /express/, fw: 'Express' },
    { pattern: /react/, fw: 'React' },
    { pattern: /vue/, fw: 'Vue' },
    { pattern: /nuxt/, fw: 'Nuxt' },
    { pattern: /laravel/, fw: 'Laravel' },
    { pattern: /django/, fw: 'Django' },
    { pattern: /fastapi/, fw: 'FastAPI' },
  ];

  for (const { pattern, fw } of frameworkPatterns) {
    if (pattern.test(q) && !/dependenc|package|npm/.test(q)) {
      const result = engine.projectsByFramework(fw);
      const names = result.projects.map((p) => p.display_name || p.project_name);
      return {
        question,
        answer:
          result.total === 0
            ? `No projects found using framework "${fw}".`
            : `${result.total} project(s) using ${fw}: ${names.join(', ')}.`,
        evidence: { framework: fw, total: result.total, projects: names },
        source,
        timestamp,
      };
    }
  }

  // ── Projects with a specific dependency ──────────────────────────────────
  // e.g. "projects with docker", "show payroll dependencies", "which projects use express"
  const depPatterns = [
    /show (.+?) dependenc/,
    /dependenc.*(?:of|for|in) (.+)/,
    /projects.*(?:with|using|that use) (.+)/,
    /which projects.*use (.+)/,
    /(.+?) dependenc/,
  ];

  let depTerm = null;
  for (const pat of depPatterns) {
    const m = q.match(pat);
    if (m) {
      const candidate = m[1].trim().replace(/[?\.]+$/, '');
      // skip overly generic words
      if (!['a', 'the', 'any', 'some', 'what', 'which'].includes(candidate)) {
        depTerm = candidate;
        break;
      }
    }
  }

  if (depTerm) {
    const result = engine.searchDependencies(depTerm);
    if (result.total > 0) {
      const summary = result.projects.map((r) => ({
        project: r.project.display_name || r.project.project_name,
        deps: r.matchedDependencies.map((d) => `${d.name}@${d.version}`),
      }));
      return {
        question,
        answer: `${result.total} project(s) depend on "${depTerm}": ${summary.map((s) => s.project).join(', ')}.`,
        evidence: { searchTerm: depTerm, total: result.total, matches: summary },
        source,
        timestamp,
      };
    }
  }

  // ── Language queries ───────────────────────────────────────────────────────
  const langPatterns = [
    { pattern: /javascript|js(?:\s|$)/, lang: 'JavaScript' },
    { pattern: /typescript|ts(?:\s|$)/, lang: 'TypeScript' },
    { pattern: /python/, lang: 'Python' },
    { pattern: /php/, lang: 'PHP' },
    { pattern: /go(?:lang)?/, lang: 'Go' },
    { pattern: /rust/, lang: 'Rust' },
    { pattern: /java(?!script)/, lang: 'Java' },
  ];

  for (const { pattern, lang } of langPatterns) {
    if (pattern.test(q)) {
      const result = engine.projectsByLanguage(lang);
      const names = result.projects.map((p) => p.display_name || p.project_name);
      return {
        question,
        answer:
          result.total === 0
            ? `No projects found using ${lang}.`
            : `${result.total} project(s) using ${lang}: ${names.join(', ')}.`,
        evidence: { language: lang, total: result.total, projects: names },
        source,
        timestamp,
      };
    }
  }

  // ── List all projects ─────────────────────────────────────────────────────
  if (/list.*project|all project|show.*project/.test(q)) {
    const result = engine.queryProjects();
    const names = result.projects.map((p) => p.display_name || p.project_name);
    return {
      question,
      answer: `All ${result.total} projects: ${names.join(', ')}.`,
      evidence: { total: result.total, projects: names },
      source,
      timestamp,
    };
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return {
    question,
    answer: 'UNKNOWN — query not recognized. Try: "How many projects?", "Largest project?", "Projects using Playwright?", "Projects with Docker?", "Projects modified this week?", "Show payroll dependencies".',
    evidence: null,
    source,
    timestamp,
  };
}

module.exports = { route };
