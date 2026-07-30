<!DOCTYPE html>
<html lang="<?= e(current_locale()) ?>">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title><?= e(t('page.register')) ?> - TaskFlow</title>

<link rel="stylesheet" href="<?= APP_URL ?>/assets/css/style.css">
<link rel="manifest" href="<?= APP_URL ?>/manifest.json">

<meta name="theme-color" content="#0a0a0a">

<style>
body.login-page {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background:
        radial-gradient(circle at top, rgba(255, 0, 51, .18), transparent 28%),
        radial-gradient(circle at 20% 20%, rgba(255, 61, 61, .12), transparent 24%),
        linear-gradient(180deg, #050505 0%, #090909 55%, #000000 100%);
    color: #ffffff;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    position: relative;
    overflow: hidden;
}

body.login-page::before {
    content: "";
    position: absolute;
    inset: 18px;
    border: 0;
    pointer-events: none;
}

body.login-page::after {
    display: none;
}

.login-stage {
    width: 100%;
    max-width: 460px;
    position: relative;
    z-index: 1;
}

.login-lang-switcher {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-bottom: 14px;
}

.login-lang-chip {
    min-width: 44px;
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,.12);
    background: rgba(255,255,255,.04);
    color: rgba(255,255,255,.72);
    text-decoration: none;
    text-align: center;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .08em;
}

.login-lang-chip.active {
    color: #ffffff;
    border-color: rgba(255, 48, 79, .55);
    background: rgba(255, 48, 79, .14);
    box-shadow: 0 0 16px rgba(255, 48, 79, .14);
}

.login-stage::before {
    content: "";
    position: absolute;
    inset: -18px;
    background: radial-gradient(circle, rgba(255, 0, 51, .2), transparent 62%);
    filter: blur(18px);
    z-index: -1;
}

.login-card {
    position: relative;
    border: 1px solid rgba(255, 255, 255, .1);
    background:
        linear-gradient(180deg, rgba(20,20,20,.96), rgba(5,5,5,.98)),
        #050505;
    border-radius: 24px;
    padding: 34px 32px 28px;
    box-shadow:
        0 28px 90px rgba(0, 0, 0, .55),
        0 0 40px rgba(255, 0, 51, .12),
        inset 0 1px 0 rgba(255,255,255,.05);
    overflow: hidden;
}

.login-card::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
        linear-gradient(135deg, rgba(255, 0, 51, .18), transparent 26%),
        linear-gradient(315deg, rgba(255,255,255,.05), transparent 30%);
    pointer-events: none;
}

.login-top,
.login-copy,
.login-form-wrap,
.login-bottom {
    position: relative;
    z-index: 1;
}

.login-top {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 22px;
}

.login-mark {
    width: 58px;
    height: 58px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, #1a1a1a, #0b0b0b);
    border: 1px solid rgba(255, 0, 51, .45);
    color: #ff304f;
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -.04em;
    box-shadow: 0 0 22px rgba(255, 0, 51, .18);
}

.login-brandline {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.login-brandline h1 {
    margin: 0;
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 38px;
    line-height: .95;
    letter-spacing: -.05em;
    color: #ffffff;
}

.login-brandline h1 span {
    color: #ff304f;
    text-shadow: 0 0 18px rgba(255, 48, 79, .28);
}

.login-brandline p {
    margin: 0;
    color: rgba(255,255,255,.64);
    font-size: 12px;
    letter-spacing: .16em;
    text-transform: uppercase;
}

.login-copy {
    margin-bottom: 20px;
}

.login-copy .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    padding: 6px 12px;
    border-radius: 999px;
    background: rgba(255, 0, 51, .12);
    border: 1px solid rgba(255, 0, 51, .28);
    color: #ff6379;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .16em;
    text-transform: uppercase;
}

.login-copy .eyebrow::before {
    content: "";
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #ff304f;
    box-shadow: 0 0 12px rgba(255, 48, 79, .7);
}

.login-copy h2 {
    margin: 0;
    color: #ffffff;
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 30px;
    line-height: 1;
    letter-spacing: -.05em;
}

.login-form-wrap .form-group {
    margin-bottom: 14px;
}

.login-form-wrap label {
    display: block;
    margin-bottom: 8px;
    color: rgba(255,255,255,.72);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .12em;
    text-transform: uppercase;
}

.login-form-wrap .form-control {
    width: 100%;
    min-height: 54px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,.12);
    background: rgba(0,0,0,.92);
    color: #ffffff;
    padding: 14px 16px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
}

.login-form-wrap .form-control::placeholder {
    color: rgba(255,255,255,.32);
}

.login-form-wrap .form-control:focus {
    outline: none;
    border-color: #ff304f;
    box-shadow:
        0 0 0 3px rgba(255, 48, 79, .12),
        0 0 24px rgba(255, 48, 79, .14);
}

.login-submit {
    width: 100%;
    min-height: 54px;
    margin-top: 8px;
    border: 0;
    border-radius: 14px;
    background: linear-gradient(180deg, #ff2d4d 0%, #d50f2f 100%);
    color: #ffffff;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -.02em;
    box-shadow:
        0 16px 30px rgba(213, 15, 47, .3),
        inset 0 1px 0 rgba(255,255,255,.12);
}

.login-submit:hover {
    background: linear-gradient(180deg, #ff4663 0%, #e21436 100%);
    transform: translateY(-1px);
}

.login-bottom {
    margin-top: 18px;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: rgba(255,255,255,.42);
    font-size: 14px;
}

.login-bottom a {
    color: #ff304f;
    font-weight: 700;
    text-decoration: none;
}

.login-bottom a:hover {
    color: #ff5a72;
}

.login-card .alert {
    margin-bottom: 16px;
}

@media (max-width: 640px) {
    body.login-page {
        padding: 16px;
    }

    .login-card {
        padding: 26px 22px 22px;
        border-radius: 20px;
    }

    .login-brandline h1 {
        font-size: 32px;
    }

    .login-copy h2 {
        font-size: 24px;
    }

    .login-bottom {
        flex-direction: column;
        align-items: flex-start;
    }
}
</style>
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
                <p>Hoang Le Team</p>
            </div>
        </div>

        <div class="login-copy">
            <div class="eyebrow"><?= e(t('auth.create_account')) ?></div>
            <h2><?= e(t('auth.register_heading')) ?></h2>
        </div>

        <?php if ($msg = flash('error')): ?>
        <div class="alert alert-error"><?= e($msg) ?></div>
        <?php endif; ?>

        <?php if ($msg = flash('success')): ?>
        <div class="alert alert-success"><?= e($msg) ?></div>
        <?php endif; ?>

        <div class="login-form-wrap">
            <form method="POST" action="<?= APP_URL ?>/register">
                <div class="form-group">
                    <label for="name"><?= e(t('auth.full_name')) ?></label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        class="form-control"
                        placeholder="Nguyễn Văn A"
                        required
                        autofocus
                    >
                </div>
                <div class="form-group">
                    <label for="email"><?= e(t('auth.email')) ?></label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        class="form-control"
                        placeholder="you@company.com"
                        required
                    >
                </div>
                <div class="form-group">
                    <label for="password"><?= e(t('auth.password')) ?></label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        class="form-control"
                        placeholder="<?= e(t('auth.password_min')) ?>"
                        required
                        minlength="6"
                    >
                </div>
                <div class="form-group">
                    <label for="password_confirm"><?= e(t('auth.confirm_password')) ?></label>
                    <input
                        type="password"
                        id="password_confirm"
                        name="password_confirm"
                        class="form-control"
                        placeholder="<?= e(t('auth.reenter_password')) ?>"
                        required
                        minlength="6"
                    >
                </div>
                <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                <button type="submit" class="btn login-submit"><?= e(t('auth.register')) ?></button>
            </form>
        </div>

        <div class="login-bottom">
            <span><?= e(t('auth.have_account')) ?></span>
            <a href="<?= APP_URL ?>/login"><?= e(t('auth.sign_in')) ?></a>
        </div>
    </div>
</div>
</body>
</html>
