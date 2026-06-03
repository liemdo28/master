'use strict';

const fs = require('fs');
const path = require('path');

const MASTER_INDEX_PATH = path.join(__dirname, '../master-indexer/output/MASTER_INDEX.json');

function loadIndex() {
  const raw = fs.readFileSync(MASTER_INDEX_PATH, 'utf8');
  return JSON.parse(raw);
}

/**
 * Query projects with an optional filter function.
 * @param {Function} [filter] - (project) => boolean
 * @returns {{ projects: Array, total: number, source: string }}
 */
function queryProjects(filter) {
  const index = loadIndex();
  const projects = filter ? index.projects.filter(filter) : index.projects;
  return {
    projects,
    total: projects.length,
    source: MASTER_INDEX_PATH,
  };
}

/**
 * Returns total number of projects in the index.
 */
function projectCount() {
  const index = loadIndex();
  return {
    count: index.total_projects,
    source: MASTER_INDEX_PATH,
  };
}

/**
 * Returns the project with the most total_lines.
 */
function largestProject() {
  const index = loadIndex();
  if (!index.projects || index.projects.length === 0) {
    return { project: 'UNKNOWN', source: MASTER_INDEX_PATH };
  }
  const largest = index.projects.reduce((a, b) =>
    (b.total_lines > a.total_lines ? b : a)
  );
  return {
    project: largest,
    metric: 'total_lines',
    source: MASTER_INDEX_PATH,
  };
}

/**
 * Returns projects whose main or secondary language matches (case-insensitive).
 * @param {string} lang
 */
function projectsByLanguage(lang) {
  if (!lang) return { projects: [], total: 0, source: MASTER_INDEX_PATH };
  const lower = lang.toLowerCase();
  return queryProjects(
    (p) =>
      (p.language_main && p.language_main.toLowerCase() === lower) ||
      (p.language_secondary && p.language_secondary.toLowerCase() === lower)
  );
}

/**
 * Returns projects matching a framework (case-insensitive, partial match).
 * @param {string} fw
 */
function projectsByFramework(fw) {
  if (!fw) return { projects: [], total: 0, source: MASTER_INDEX_PATH };
  const lower = fw.toLowerCase();
  return queryProjects(
    (p) => p.framework && p.framework.toLowerCase().includes(lower)
  );
}

/**
 * Returns projects modified within the last `days` days.
 * Uses last_modified field.
 * @param {number} days
 */
function recentProjects(days) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return queryProjects((p) => {
    if (!p.last_modified) return false;
    return new Date(p.last_modified) >= cutoff;
  });
}

/**
 * Returns projects that declare a dependency matching `name` (case-insensitive, partial).
 * @param {string} name
 */
function searchDependencies(name) {
  if (!name) return { projects: [], total: 0, source: MASTER_INDEX_PATH };
  const lower = name.toLowerCase();
  const index = loadIndex();
  const matches = [];
  for (const project of index.projects) {
    const deps = project.dependencies || [];
    const found = deps.filter((d) => d.name && d.name.toLowerCase().includes(lower));
    if (found.length > 0) {
      matches.push({ project, matchedDependencies: found });
    }
  }
  return {
    projects: matches,
    total: matches.length,
    searchTerm: name,
    source: MASTER_INDEX_PATH,
  };
}

module.exports = {
  loadIndex,
  queryProjects,
  projectCount,
  largestProject,
  projectsByLanguage,
  projectsByFramework,
  recentProjects,
  searchDependencies,
};
