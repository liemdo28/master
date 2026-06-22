// kb/domains/coding-mdn.js — MDN Web Docs articles for the coding domain
// Source: MDN Web Docs (https://developer.mozilla.org)
// License: CC BY-SA 2.5 — Mozilla contributors
// Ingest with: node kb/ingest-mdn.js coding
// These are MDN slug paths, not Wikipedia titles.

export const DOMAIN      = 'coding';
export const DOMAIN_NAME = 'Coding & Software Engineering';
export const SOURCE      = 'mdn';

export const ARTICLES = [
  // JavaScript fundamentals
  { slug: 'Web/JavaScript/Guide/Introduction',                              topic: 'javascript', priority: 1 },
  { slug: 'Web/JavaScript/Guide/Grammar_and_types',                        topic: 'javascript', priority: 1 },
  { slug: 'Web/JavaScript/Reference/Global_Objects/Promise',               topic: 'javascript', priority: 1 },
  { slug: 'Web/JavaScript/Reference/Statements/async_function',            topic: 'javascript', priority: 1 },
  { slug: 'Web/JavaScript/Reference/Operators/await',                      topic: 'javascript', priority: 1 },
  { slug: 'Web/JavaScript/Reference/Global_Objects/Array',                 topic: 'javascript', priority: 1 },
  { slug: 'Web/JavaScript/Reference/Global_Objects/Object',                topic: 'javascript', priority: 1 },
  { slug: 'Web/JavaScript/Reference/Global_Objects/Map',                   topic: 'javascript', priority: 2 },
  { slug: 'Web/JavaScript/Reference/Global_Objects/Set',                   topic: 'javascript', priority: 2 },
  { slug: 'Web/JavaScript/Reference/Classes',                              topic: 'javascript', priority: 1 },
  { slug: 'Web/JavaScript/Reference/Functions/Arrow_functions',            topic: 'javascript', priority: 1 },
  { slug: 'Web/JavaScript/Reference/Operators/Destructuring_assignment',   topic: 'javascript', priority: 2 },
  { slug: 'Web/JavaScript/Reference/Operators/Spread_syntax',              topic: 'javascript', priority: 2 },
  { slug: 'Web/JavaScript/Guide/Modules',                                  topic: 'javascript', priority: 1 },
  { slug: 'Web/JavaScript/Closures',                                       topic: 'javascript', priority: 1 },
  { slug: 'Web/JavaScript/Inheritance_and_the_prototype_chain',            topic: 'javascript', priority: 2 },
  { slug: 'Web/JavaScript/Event_loop',                                     topic: 'javascript', priority: 1 },
  { slug: 'Web/JavaScript/Memory_management',                              topic: 'javascript', priority: 2 },
  { slug: 'Web/JavaScript/Reference/Global_Objects/JSON',                  topic: 'javascript', priority: 1 },
  { slug: 'Web/JavaScript/Guide/Regular_expressions',                      topic: 'javascript', priority: 2 },

  // Web APIs
  { slug: 'Web/API/Fetch_API/Using_Fetch',                                 topic: 'webapi',    priority: 1 },
  { slug: 'Web/API/Web_Storage_API',                                       topic: 'webapi',    priority: 2 },
  { slug: 'Web/API/IndexedDB_API',                                         topic: 'webapi',    priority: 2 },
  { slug: 'Web/API/WebSockets_API',                                        topic: 'webapi',    priority: 2 },
  { slug: 'Web/API/Service_Worker_API',                                    topic: 'webapi',    priority: 2 },
  { slug: 'Web/API/Web_Workers_API',                                       topic: 'webapi',    priority: 2 },
  { slug: 'Web/API/Canvas_API',                                            topic: 'webapi',    priority: 2 },
  { slug: 'Web/API/Intersection_Observer_API',                             topic: 'webapi',    priority: 3 },
  { slug: 'Web/API/MutationObserver',                                      topic: 'webapi',    priority: 3 },
  { slug: 'Web/API/Performance_API',                                       topic: 'webapi',    priority: 2 },

  // CSS
  { slug: 'Web/CSS/CSS_Flexible_Box_Layout/Basic_Concepts_of_Flexbox',     topic: 'css',       priority: 1 },
  { slug: 'Web/CSS/CSS_Grid_Layout/Basic_Concepts_of_Grid_Layout',         topic: 'css',       priority: 1 },
  { slug: 'Web/CSS/CSS_custom_properties',                                 topic: 'css',       priority: 2 },
  { slug: 'Web/CSS/Specificity',                                           topic: 'css',       priority: 2 },
  { slug: 'Web/CSS/position',                                              topic: 'css',       priority: 2 },
  { slug: 'Web/CSS/animation',                                             topic: 'css',       priority: 3 },
  { slug: 'Web/CSS/Media_Queries/Using_media_queries',                     topic: 'css',       priority: 2 },

  // HTML
  { slug: 'Web/HTML/Element',                                              topic: 'html',      priority: 1 },
  { slug: 'Web/HTML/Global_attributes',                                    topic: 'html',      priority: 2 },
  { slug: 'Web/HTML/Element/input',                                        topic: 'html',      priority: 2 },
  { slug: 'Web/Accessibility/ARIA',                                        topic: 'html',      priority: 2 },

  // HTTP & Security
  { slug: 'Web/HTTP/Overview',                                             topic: 'http',      priority: 1 },
  { slug: 'Web/HTTP/Cookies',                                              topic: 'http',      priority: 2 },
  { slug: 'Web/HTTP/Headers',                                              topic: 'http',      priority: 2 },
  { slug: 'Web/HTTP/Status',                                               topic: 'http',      priority: 2 },
  { slug: 'Web/Security/Same-origin_policy',                               topic: 'http',      priority: 2 },
  { slug: 'Web/HTTP/CORS',                                                 topic: 'http',      priority: 2 },
  { slug: 'Web/HTTP/CSP',                                                  topic: 'http',      priority: 3 },
];
