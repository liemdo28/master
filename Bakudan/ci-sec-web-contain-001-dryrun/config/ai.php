<?php
/**
 * AI / OpenAI configuration
 *
 * Preferred setup:
 * 1. Environment variables on server/local machine
 * 2. Optional local override file: config/ai.local.php
 */

function openai_config_file_path() {
    return __DIR__ . '/ai.local.php';
}

function openai_external_config_paths() {
    $paths = [];

    $envPath = trim((string) (getenv('OPENAI_CONFIG_FILE') ?: ''));
    if ($envPath !== '') {
        $paths[] = $envPath;
    }

    $home = trim((string) (getenv('HOME') ?: ($_SERVER['HOME'] ?? '')));
    if ($home !== '') {
        $paths[] = rtrim($home, '/\\') . '/.taskflow-ai.php';
        $paths[] = rtrim($home, '/\\') . '/taskflow-ai.php';
    }

    return array_values(array_unique($paths));
}

function openai_load_config() {
    $config = [
        'api_key' => (string) (getenv('OPENAI_API_KEY') ?: ''),
        'model' => (string) (getenv('OPENAI_TASK_MODEL') ?: 'gpt-4o-mini'),
        'base_url' => rtrim((string) (getenv('OPENAI_BASE_URL') ?: 'https://api.openai.com/v1'), '/'),
    ];

    $candidatePaths = array_merge([openai_config_file_path()], openai_external_config_paths());
    foreach ($candidatePaths as $candidatePath) {
        if (!is_file($candidatePath) || !is_readable($candidatePath)) {
            continue;
        }

        $localConfig = require $candidatePath;
        if (is_array($localConfig)) {
            foreach ($localConfig as $key => $value) {
                if ($value !== null && $value !== '') {
                    $config[$key] = $value;
                }
            }
        }

        $config['_source_path'] = $candidatePath;
        break;
    }

    $config['api_key'] = trim((string) ($config['api_key'] ?? ''));
    $config['model'] = trim((string) ($config['model'] ?? 'gpt-4o-mini'));
    $config['base_url'] = rtrim(trim((string) ($config['base_url'] ?? 'https://api.openai.com/v1')), '/');

    if ($config['model'] === '') {
        $config['model'] = 'gpt-4o-mini';
    }
    if ($config['base_url'] === '') {
        $config['base_url'] = 'https://api.openai.com/v1';
    }

    return $config;
}

function openai_api_key() {
    $config = openai_load_config();
    return (string) ($config['api_key'] ?? '');
}

function openai_task_model() {
    $config = openai_load_config();
    return (string) ($config['model'] ?? 'gpt-4o-mini');
}

function openai_base_url() {
    $config = openai_load_config();
    return (string) ($config['base_url'] ?? 'https://api.openai.com/v1');
}

function openai_is_configured() {
    return openai_api_key() !== '';
}

function openai_config_debug() {
    $configPath = openai_config_file_path();
    $rawLocalKey = '';
    $sourcePath = '';

    foreach (array_merge([$configPath], openai_external_config_paths()) as $candidatePath) {
        if (!is_file($candidatePath) || !is_readable($candidatePath)) {
            continue;
        }

        $localConfig = require $candidatePath;
        if (is_array($localConfig)) {
            $rawLocalKey = trim((string) ($localConfig['api_key'] ?? ''));
            $sourcePath = $candidatePath;
            break;
        }
    }

    $effectiveKey = openai_api_key();

    return [
        'config_path' => $configPath,
        'config_exists' => is_file($configPath),
        'config_readable' => is_readable($configPath),
        'external_paths' => openai_external_config_paths(),
        'active_source_path' => $sourcePath,
        'local_key_detected' => $rawLocalKey !== '',
        'effective_key_detected' => $effectiveKey !== '',
        'effective_model' => openai_task_model(),
        'effective_base_url' => openai_base_url(),
        'effective_key_length' => strlen($effectiveKey),
    ];
}

if (!defined('OPENAI_API_KEY')) {
    define('OPENAI_API_KEY', openai_api_key());
}
if (!defined('OPENAI_TASK_MODEL')) {
    define('OPENAI_TASK_MODEL', openai_task_model());
}
if (!defined('OPENAI_BASE_URL')) {
    define('OPENAI_BASE_URL', openai_base_url());
}
