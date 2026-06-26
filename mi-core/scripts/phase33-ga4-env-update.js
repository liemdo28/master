const fs = require('fs');

// First, update .env with GA4 property IDs
const envPath = 'D:/Project/Master/mi-core/server/.env';
let env = fs.readFileSync(envPath, 'utf8');

if (!env.includes('GA4_BAKUDAN_PROPERTY_ID')) {
  env += '\n\n# GA4 Revenue Intelligence (Phase 33)\n';
  env += 'GA4_BAKUDAN_PROPERTY_ID=properties/543110659\n';
  env += 'GA4_RAWSUSHI_PROPERTY_ID=properties/532604616\n';
  env += 'GA4_PROPERTY_ID=properties/543110659\n';
}
fs.writeFileSync(envPath, env, 'utf8');
console.log('server/.env updated');

// Also update mi-core/.env (root)
const rootEnvPath = 'D:/Project/Master/mi-core/.env';
let rootEnv = fs.readFileSync(rootEnvPath, 'utf8');
if (!rootEnv.includes('GA4_BAKUDAN_PROPERTY_ID')) {
  rootEnv += '\n\n# GA4 Revenue Intelligence (Phase 33)\n';
  rootEnv += 'GA4_BAKUDAN_PROPERTY_ID=properties/543110659\n';
  rootEnv += 'GA4_RAWSUSHI_PROPERTY_ID=properties/532604616\n';
  rootEnv += 'GA4_PROPERTY_ID=properties/543110659\n';
}
fs.writeFileSync(rootEnvPath, rootEnv, 'utf8');
console.log('mi-core/.env updated');
