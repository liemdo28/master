<!DOCTYPE html>
<html lang="<?= e(current_locale()) ?>">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title><?= e(t('page.login')) ?> - TaskFlow</title>
<meta name="description" content="Sign in to TaskFlow — Bakudan Ramen operations dashboard.">
<meta name="robots" content="noindex, nofollow">

<!-- Open Graph -->
<meta property="og:type"        content="website">
<meta property="og:site_name"   content="TaskFlow">
<meta property="og:title"       content="<?= e(t('page.login')) ?> - TaskFlow">
<meta property="og:description" content="Sign in to TaskFlow — Bakudan Ramen operations dashboard.">

<!-- Canonical -->
<link rel="canonical" href="<?= e(APP_URL) ?>/login">

<link rel="stylesheet" href="<?= APP_URL ?>/assets/css/style.css">
<link rel="stylesheet" href="<?= APP_URL ?>/assets/css/pages/auth.css">
<link rel="manifest" href="<?= APP_URL ?>/manifest.json">

<meta name="theme-color" content="#0a0a0a">
</head>

<body class="login-page">
<div class="login-stage">
    <div class="login-lang-switcher">
        <a href="<?= e(language_switch_url('vi')) ?>" class="login-lang-chip <?= current_locale() === 'vi' ? 'active' : '' ?>">VI</a>
        <a href="<?= e(language_switch_url('en')) ?>" class="login-lang-chip <?= current_locale() === 'en' ? 'active' : '' ?>">EN</a>
    </div>
    <div class="login-card">
        <div class="login-top">
            <div class="login-mark">TF</div>
            <div class="login-brandline">
                <h1>Task<span>Flow</span></h1>
                <p><?= e(t('auth.brand_tagline')) ?></p>
            </div>
        </div>

        <div class="login-copy">
            <div class="eyebrow"><?= e(t('auth.secure_access')) ?></div>
            <h2><?= e(t('auth.sign_in_continue')) ?></h2>
        </div>

        <?php if ($msg = flash('error')): ?>
        <div class="alert alert-error"><?= e($msg) ?></div>
        <?php endif; ?>

        <?php if ($msg = flash('success')): ?>
        <div class="alert alert-success"><?= e($msg) ?></div>
        <?php endif; ?>

        <div class="login-form-wrap">
            <form method="POST" action="<?= APP_URL ?>/login">
                <div class="form-group">
                    <label for="email"><?= e(t('auth.email')) ?></label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        class="form-control"
                        placeholder="you@company.com"
                        required
                        autofocus
                    >
                </div>

                <div class="form-group">
                    <label for="password"><?= e(t('auth.password')) ?></label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        class="form-control"
                        placeholder="••••••••"
                        required
                    >
                </div>

                <div class="form-group" style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                    <input type="checkbox" id="remember_me" name="remember_me" value="1"
                           style="width:16px;height:16px;accent-color:#3b82f6;cursor:pointer;flex-shrink:0">
                    <label for="remember_me" style="margin:0;font-size:14px;color:#a1a1aa;cursor:pointer;font-weight:400">
                        <?= e(t('auth.remember_me')) ?>
                    </label>
                </div>

                <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                <button type="submit" class="btn login-submit"><?= e(t('auth.sign_in')) ?></button>
            </form>
        </div>

        <div class="login-bottom">
            <span><?= e(t('auth.no_account')) ?></span>
            <a href="<?= APP_URL ?>/register"><?= e(t('auth.register_now')) ?></a>
        </div>
    </div>
</div>
</body>
</html>
