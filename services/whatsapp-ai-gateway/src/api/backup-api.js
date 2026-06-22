/**
 * Backup / Restore API Endpoints
 *
 * Mounted at /api/admin/backup/* by src/api/server.js
 * Requires the lazy require pattern so the dashboard still renders if
 * the backup service is unavailable.
 */

module.exports = function backupApiRoutes(app) {
  var backupSvc = (function() {
    try { return require('../backup/backup-service'); } catch (_) { return null; }
  })();
  var fs = require('fs');
  var path = require('path');

  // Wrap an async function to catch promise rejection and send 500
  function safe(fn) {
    return function(req, res) {
      Promise.resolve()
        .then(function() { return fn(req, res); })
        .catch(function(err) {
          res.status(500).json({ ok: false, error: err.message });
        });
    };
  }

  // GET  /api/admin/backup/export  — download the current config as a JSON file
  app.get('/api/admin/backup/export', safe(function(req, res) {
    if (!backupSvc) { res.status(503).json({ error: 'Backup service not available' }); return Promise.resolve(); }
    return backupSvc.writeExportToDisk().then(function(r) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="' + path.basename(r.filePath) + '"');
      res.send(JSON.stringify(r.payload, null, 2));
    });
  }));

  // POST /api/admin/backup/import  — validate + dry-run by default; { apply: true } writes
  app.post('/api/admin/backup/import', safe(function(req, res) {
    if (!backupSvc) { res.status(503).json({ error: 'Backup service not available' }); return Promise.resolve(); }
    var body = req.body || {};
    var apply = !!body.apply;
    var mode = body.mode === 'replace' ? 'replace' : 'merge';
    var payload = body.payload;
    if (!payload && body.file) { payload = backupSvc.readImportFile(path.resolve(body.file)); }
    if (!payload) { res.status(400).json({ ok: false, error: 'payload or file required' }); return Promise.resolve(); }
    if (!apply) {
      return backupSvc.dryRunImport(payload).then(function(dry) {
        res.json({
          ok: dry.validation.ok,
          dry_run: true,
          validation: dry.validation,
          diff: dry.diff,
          message: dry.validation.ok
            ? 'Dry-run only. Pass { apply: true } to actually write to the database.'
            : 'Validation failed. Fix the errors below before applying.',
        });
      });
    }
    return backupSvc.applyImport(payload, { mode: mode }).then(function(r) {
      res.json({ ok: r.ok, dry_run: false, applied: r.applied, mode: r.mode, errors: r.errors });
    });
  }));

  // POST /api/admin/backup/now  — same as Export but response includes the saved file path
  app.post('/api/admin/backup/now', safe(function(req, res) {
    if (!backupSvc) { res.status(503).json({ error: 'Backup service not available' }); return Promise.resolve(); }
    return backupSvc.writeExportToDisk().then(function(r) {
      res.json({
        ok: true,
        filePath: r.filePath,
        schema_version: r.payload.schema_version,
        counts: r.payload.counts,
        template_cache_meta: r.payload.template_cache_meta,
        checksum_sha256: r.payload.checksum_sha256,
        exported_at: r.payload.exported_at,
      });
    });
  }));

  // POST /api/admin/backup/restore  — read an existing backup file, dry-run, apply on confirm
  // body: { file: 'data/backup/waig-config-*.json', mode: 'merge'|'replace', apply: true|false }
  app.post('/api/admin/backup/restore', safe(function(req, res) {
    if (!backupSvc) { res.status(503).json({ error: 'Backup service not available' }); return Promise.resolve(); }
    var b = req.body || {};
    if (!b.file) { res.status(400).json({ ok: false, error: 'file required' }); return Promise.resolve(); }
    var doApply = !!b.apply;
    var m = b.mode === 'replace' ? 'replace' : 'merge';
    var p = backupSvc.readImportFile(path.resolve(b.file));
    if (!doApply) {
      return backupSvc.dryRunImport(p).then(function(d) {
        res.json({
          ok: d.validation.ok,
          dry_run: true,
          file: b.file,
          validation: d.validation,
          diff: d.diff,
          message: d.validation.ok
            ? 'Dry-run only. Pass { apply: true, mode: "' + m + '" } to actually restore.'
            : 'Validation failed. Fix the errors below before applying.',
        });
      });
    }
    return backupSvc.applyImport(p, { mode: m }).then(function(r2) {
      res.json({ ok: r2.ok, dry_run: false, file: b.file, applied: r2.applied, mode: r2.mode, errors: r2.errors });
    });
  }));

  // GET  /api/admin/backup/list  — list existing backups (for the Restore picker)
  app.get('/api/admin/backup/list', safe(function(req, res) {
    if (!backupSvc) { res.status(503).json({ error: 'Backup service not available' }); return Promise.resolve(); }
    var dir = path.resolve('./data/backup');
    if (!fs.existsSync(dir)) { res.json({ ok: true, dir: dir, files: [] }); return Promise.resolve(); }
    var files = fs.readdirSync(dir)
      .filter(function(f) { return f.indexOf('waig-config-') === 0 && f.slice(-5) === '.json'; })
      .map(function(f) {
        var stat = fs.statSync(path.join(dir, f));
        return { file: f, size_bytes: stat.size, mtime: stat.mtime.toISOString() };
      });
    res.json({ ok: true, dir: dir, count: files.length, files: files });
    return Promise.resolve();
  }));
};
