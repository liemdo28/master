/**
 * i18n — Core translations
 *
 * Multi-language support for all WhatsApp interactions.
 * Staff-facing text — keep it simple, clear, and short.
 *
 * Supported: English, Spanish, Vietnamese
 */

const T = {
  en: {
    // ── Session start ────────────────────────────────────────────────
    greeting:        'Hi {name}, I\'m here to help.\nJust follow the steps.',

    // ── Phase 1.5: Agent welcome (per directive) ─────────────────────
    welcome_agent:   '👋 Hi {name},\nStore: *{store}*',

    // ── Menu ─────────────────────────────────────────────────────────
    menu_intro:      'Hi {name},\nStore: *{store}*',
    menu_choose:     'Choose a workflow:',
    menu_option1:    '1. Daily Entry Log',
    menu_option2:    '2. Broth Count',
    menu_option3:    '3. Temperature Check',
    menu_option4:    '4. Food Safety Review',
    menu_option5:    '5. System Status',
    menu_end:        'Reply with a number or command.\nType END to close.',

    // ── Phase 1.5: Per-directive workflow keys ─────────────────────
    choose_workflow:       'Choose a workflow:',
    workflow_daily_entry:  '1. Daily Entry Log',
    workflow_broth:        '2. Broth Count',
    workflow_temperature:  '3. Temperature Check',
    workflow_food_safety:  '4. Food Safety Review',
    workflow_status:       '5. System Status',
    reply_number_or_command: 'Reply with a number or command.',
    type_end_to_close:     'Type END to close.',

    ask_item_value:        '{item} = ?\n\nReply with a number.',
    target_range:          'Target: {min}–{max}',
    outside_range:         '⚠️ Outside Range\n\n{item}: {value}°F\nExpected: {target}',
    critical_temperature:  '🚨 Critical Temperature\n\n{item}: {value}°F\nExpected: {target}',
    possible_typo:         'Did you mean {value}°F?',
    confirm_actual_reading: '1 — Confirm actual reading',
    re_enter_value:        '2 — Re-enter value',
    skip_item:             '3 — Skip this item',
    please_enter_number:   '⚠️ Please enter a number.\n\n{item}\n\nExample: 35',
    detected_celsius:      '⚠️ Detected {celsius}°C',
    converted_to_fahrenheit: '= {fahrenheit}°F',
    confirm_conversion:    'Use {fahrenheit}°F?',

    saved:                 '✅ Saved.',
    next_item:             'Next: {item}',
    summary:               '📋 Summary — {store}',
    confirm_to_save:       'CONFIRM — save to Google Sheet',
    edit_to_fix:           'EDIT <item> <value> — fix one item',
    cancel_to_discard:     'CANCEL — discard',
    logged_success:        '✅ Daily Entry Logged\n\nStore: {store}\nStatus: PASS',
    logged_with_warnings:  '⚠️ Daily Entry Logged with Warnings\n\nStore: {store}\n\nOut of range:\n{failures}',
    manager_notified:      'Manager has been notified.',
    sheet_queued:          'Saved locally. Google Sheet write queued.',

    session_status:        '📊 *Session Status*\nOwner: {owner}\nStore: {store}\nState: {state}\nWorkflow: {workflow}\nExpires in: {min} min',
    session_closed:        'Session closed. 👋',
    session_timeout:       '⏱️ Session closed due to inactivity.',
    not_owner_session:     'Only the staff who started /ldagent can control this session.',
    group_not_mapped:      'This group is not linked to a store yet. Please ask admin to map this group in Dashboard.',

    voice_not_supported:   'Voice messages are not supported yet. Please type the number.',

    language_set:          'Language set to: {lang}',
    language_supported:    'Supported: en, es, vi, fr',
    language_invalid:      'Unsupported language: {lang}. Supported: en, es, vi, fr',
    language_reset:        'Language preference cleared.',
    language_current:      'Current language: {lang}',

    // ── Manager alert (always English) ──────────────────────────────
    manager_alert_title:   '🚨 Temperature Alert',
    manager_alert_store:   'Store: {store}',
    manager_alert_employee: 'Employee: {employee}',
    manager_alert_language: 'Language: {language}',
    manager_alert_item:    'Item: {item}',
    manager_alert_submitted: 'Submitted: {value}',
    manager_alert_target:  'Target: {target}',
    manager_alert_status:  'Status: {status}',
    manager_alert_original: 'Original input:\n"{original}"',

    // ── Store selection ─────────────────────────────────────────────
    ask_store:       'Which store?',
    ask_store_hint:  '1. Rim\n2. Stone Oak\n3. Bandera',
    bad_store:       '⚠️ Store not recognised.\n\n{askStoreHint}',
    store_selected:  'Store: {store}',

    // ── Confirmation workflow ────────────────────────────────────────
    summary_title:   '📋 Summary — {store}',
    summary_reply:   'CONFIRM — save to Google Sheet\nEDIT <item> <value> — fix one item\nSTATUS — view draft\nCANCEL — discard',

    // ── Confirm / success ───────────────────────────────────────────
    success_saved:   '✅ Daily Entry Logged\n\nStore: {store}\nStatus: PASS\n\n📊 Saved to Google Sheet.',
    success_warning: '⚠️ Daily Entry Logged with Warnings\n\nStore: {store}\n\nOut of range:\n{failures}\n\nPlease re-check.',
    success_queued:  '✅ Daily Entry Logged\n\nStore: {store}\nStatus: PASS\n\n💾 Saved locally. Will sync to Google Sheet shortly.',

    // ── Edit ─────────────────────────────────────────────────────────
    edit_applied:    '✏️ Updated: {item} = {value}',

    // ── Session controls ─────────────────────────────────────────────
    session_help:    '📋 *Session Commands*\n\nYES / MENU — Return to menu\nNO / END   — Close session\nSTATUS     — Show session status\nCANCEL     — Cancel current workflow (keep session)\nCONFIRM    — Save to Google Sheet',

    session_status:  '📊 *Session Status*\nOwner: {owner}\nStore: {store}\nState: {state}\nWorkflow: {workflow}\nExpires in: {min} min\n\nType MENU to return, END to close.',

    session_closing: 'Thank you, {name}. Session closed. 👋',
    session_timeout: '⏱️ Session closed due to inactivity.\nThank you, {name}.',

    // ── Waiting for more ─────────────────────────────────────────────
    more_prompt:     'Do you need anything else?\nYES — continue\nNO — close session',

    // ── Breadcrumb (one-at-a-time) ──────────────────────────────────
    breadcrumb_ask:  '{item} = ?\n\nReply with a number.',
    breadcrumb_ask_with_range: '{item} = ?\n\nTarget: {min}–{max}',
    breadcrumb_missing_remaining: 'Still needed:\n{items}\n\nReply in order (comma-separated):\n{placeholders}',
    breadcrumb_all_collected: '✅ All items collected.',

    // ── Error prevention (out-of-range) ─────────────────────────────────────
    out_of_range:    '⚠️ Outside Range\n\n{item}: {value}°F\nExpected: {target}',
    range_confirm_choices: '1 — Confirm actual reading\n2 — Re-enter value\n3 — Skip this item',
    range_confirm_choices_critical: '1 — Confirm actual reading\n2 — Re-enter value\n\n⚠️ This may require manager attention.',
    critical_temperature: '🚨 Critical Temperature\n\n{item}: {value}°F\nExpected: {target}',
    celsius_conversion_ask: '⚠️ Detected {celsius}°C = {fahrenheit}°F.\n\n{item}:\nUse {fahrenheit}°F?',
    confirm_1: 'Confirm',
    reenter_2: 'Re-enter value',
    skip_3: 'Skip this item',
    invalid_number:  '⚠️ Not understood. Please enter a number.\n\n{item}\n\nExample: 35',

    // ── Invalid input ───────────────────────────────────────────────
    invalid_number_legacy:  '⚠️ Not a valid number.\n\n{item}: "{raw}"\n\nPlease enter a number.',

    // ── Temperature check (one-at-a-time) ──────────────────────────
    temp_welcome:    '🌡 Temperature Check\n\n{store}\n\nI will ask for each item one at a time.\n\nReply with a number for each item.',

    temp_ask:        '{item}\n\nTemperature?',
    temp_ask_range:  '{item}\n\nTemperature? (Target: {min}–{max})',
    temp_out_of_range: '⚠️ Temperature out of range.\n\n{item}: {value}°\nTarget: {target}\n\nConfirm?\n1. Correct\n2. Re-enter',

    temp_confirm_choices: '1. Correct\n2. Re-enter',

    temp_summary:    '📋 Temperature Summary\n\n{rows}\n\nOut of range:\n{failures}\n\nReply:\nCONFIRM — save\nEDIT <item> <value> — fix\nCANCEL — discard',

    temp_success:    '✅ Temperature Logged\n\n{store}\nStatus: PASS\n\n📊 Saved to Google Sheet.',
    temp_success_warn: '⚠️ Temperature Logged with Warnings\n\n{store}\n\nOut of range:\n{failures}\n\nPlease re-check.',

    // ── /help ────────────────────────────────────────────────────────
    help_direct:     '📋 *Available Commands*\n\n*/help* — Show this list.\n*/broth* — Start Daily Entry Log (bot asks store).\n*/broth Stone Oak* — Start Daily Entry Log for Stone Oak.\n*/template* — Show template sync status and item list.\n*/log* — Show Google Sheet log status.\n*/status* — Show all system status.\n\n*During /broth:*\nSTATUS — Show draft\nEDIT 6 42 — Change item #6 to 42\nCONFIRM — Save to Google Sheet\nCANCEL — Discard',

    help_group:      '📋 *Available Commands*\n\n*/ldagent* — Start a session in this group.\n*/help* — Show this list.\n*/status* — Show bot/system status.\n\n*During a session:*\nYES / MENU — Return to workflow menu\nNO / END   — Close session\nSTATUS     — Show session status\nCANCEL     — Cancel current workflow\n\n*(Only the staff member who started /ldagent can control the session.)*',

    // ── Non-owner ────────────────────────────────────────────────────
    non_owner_busy:  '⚠️ Agent is currently assisting {owner}.\nPlease wait until the session is closed.',

    // ── Out-of-range store warning ───────────────────────────────────
    store_warning:   '⚠️ DAILY ENTRY WARNING\n\nStore: {store}\nSubmitted by: {staff}\n\nOut of range:\n{issues}\n\nPlease re-check. If the reading is correct, notify manager immediately.',

    // ── Missing submission reminder ───────────────────────────────────
    reminder_subject: '⏰ Reminder: Daily Entry Log not submitted',
    reminder_body:    'Your store ({store}) has not submitted the daily entry log yet.\n\nReply:\n/ldagent\n\nThen select "Daily Entry Log" to submit.',

    // ── /status ──────────────────────────────────────────────────────
    status_title:    '📊 System Status',
    status_wa:       'WhatsApp: {status}',
    status_wa_ready: 'WhatsApp: ✅ Ready',
    status_wa_qr:    'WhatsApp: 📱 Scan QR to connect',
    status_wa_off:   'WhatsApp: ⚠️ Disconnected',
    status_template:  'Template: {status} ({count} items)',
    status_template_ok: 'Template: ✅ Synced ({count} items)',
    status_template_stale: 'Template: ⚠️ Not synced',
    status_last_log: 'Last log: {time}',

    // ── Unmapped group ───────────────────────────────────────────────
    unmapped_group:  'This group is not linked to a store yet.\nPlease ask admin to map this group in Dashboard.',

    // ── System unavailable ───────────────────────────────────────────
    sys_unavailable: '⚠️ This feature is not available yet.\nPlease choose option 1 or 2.',

    // ── Skip reason ───────────────────────────────────────────────
    skip_ask_reason: 'Reason?\n1. Thermometer broken\n2. Item not available\n3. Other',
    skip_reason_broken: 'Thermometer broken',
    skip_reason_not_available: 'Item not available',
    skip_reason_other: 'Other',
    skipped_item: '⏭️ Skipped: {item}',
  },

  es: {
    greeting:        'Hola {name}, estoy aquí para ayudarte.\nSolo sigue los pasos.',

    menu_intro:      'Hola {name},\nTienda: *{store}*',
    menu_choose:     'Elige una opción:',
    menu_option1:    '1. Registro Diario',
    menu_option2:    '2. Contador de Caldo',
    menu_option3:    '3. Control de Temperatura',
    menu_option4:    '4. Seguridad Alimentaria',
    menu_option5:    '5. Estado del Sistema',
    menu_end:        'Responde con un número.\nEscribe END para cerrar.',

    ask_store:       '¿Qué tienda?',
    ask_store_hint:  '1. Rim\n2. Stone Oak\n3. Bandera',
    bad_store:       '⚠️ Tienda no reconocida.\n\n{askStoreHint}',
    store_selected:  'Tienda: {store}',

    summary_title:   '📋 Resumen — {store}',
    summary_reply:   'CONFIRM — guardar en Google Sheet\nEDIT <ítem> <valor> — corregir uno\nSTATUS — ver borrador\nCANCEL — descartar',

    success_saved:   '✅ Registro Diario Guardado\n\nTienda: {store}\nEstado: PASS\n\n📊 Guardado en Google Sheet.',
    success_warning: '⚠️ Registro Diario Guardado con Advertencias\n\nTienda: {store}\n\nFuera de rango:\n{failures}\n\nPor favor verificar.',
    success_queued:  '✅ Registro Diario Guardado\n\nTienda: {store}\nEstado: PASS\n\n💾 Guardado localmente. Se sincronizará pronto.',

    edit_applied:    '✏️ Actualizado: {item} = {value}',

    session_help:    '📋 *Comandos de Sesión*\n\nYES / MENU — Volver al menú\nNO / END   — Cerrar sesión\nSTATUS     — Mostrar estado\nCANCEL     — Cancelar flujo actual (mantener sesión)\nCONFIRM    — Guardar en Google Sheet',

    session_status:  '📊 *Estado de Sesión*\nResponsable: {owner}\nTienda: {store}\nEstado: {state}\nFlujo: {workflow}\nExpira en: {min} min\n\nEscribe MENU para volver, END para cerrar.',

    session_closing: 'Gracias, {name}. Sesión cerrada. 👋',
    session_timeout: '⏱️ Sesión cerrada por inactividad.\nGracias, {name}.',

    more_prompt:     '¿Necesitas algo más?\nYES — continuar\nNO — cerrar sesión',

    breadcrumb_ask:  '{item} = ?\n\nResponde con un número.',
    breadcrumb_ask_with_range: '{item} = ?\n\nRango: {min}–{max}',
    breadcrumb_missing_remaining: 'Aún falta:\n{items}\n\nResponde en orden (separado por comas):\n{placeholders}',
    breadcrumb_all_collected: '✅ Todos los ítems capturados.',

    out_of_range:    '⚠️ Fuera de rango\n\n{item}: {value}°F\nEsperado: {target}',
    range_confirm_choices: '1 — Confirmar lectura real\n2 — Ingresar de nuevo\n3 — Omitir este ítem',
    range_confirm_choices_critical: '1 — Confirmar lectura real\n2 — Ingresar de nuevo\n\n⚠️ Esto puede requerir atención del gerente.',
    critical_temperature: '🚨 Temperatura Crítica\n\n{item}: {value}°F\nEsperado: {target}',
    celsius_conversion_ask: '⚠️ Detectado {celsius}°C = {fahrenheit}°F.\n\n{item}:\n¿Usar {fahrenheit}°F?',
    confirm_1: 'Confirmar',
    reenter_2: 'Ingresar de nuevo',
    skip_3: 'Omitir este ítem',
    invalid_number:  '⚠️ No comprendido. Por favor ingresa un número.\n\n{item}\n\nEjemplo: 35',

    invalid_number_legacy:  '⚠️ No es un número válido.\n\n{item}: "{raw}"\n\nPor favor ingresa un número.',

    temp_welcome:    '🌡 Control de Temperatura\n\n{store}\n\nTe preguntaré uno por uno.\n\nResponde con un número para cada ítem.',

    temp_ask:        '{item}\n\n¿Temperatura?',
    temp_ask_range:  '{item}\n\n¿Temperatura? (Rango: {min}–{max})',
    temp_out_of_range: '⚠️ Temperatura fuera de rango.\n\n{item}: {value}°\nRango: {target}\n\n¿Confirmar?\n1. Es correcto\n2. Volver a escribir',

    temp_confirm_choices: '1. Es correcto\n2. Volver a escribir',

    temp_summary:    '📋 Resumen de Temperatura\n\n{rows}\n\nFuera de rango:\n{failures}\n\nResponde:\nCONFIRM — guardar\nEDIT <ítem> <valor> — corregir\nCANCEL — descartar',

    temp_success:    '✅ Temperatura Registrada\n\n{store}\nEstado: PASS\n\n📊 Guardado en Google Sheet.',
    temp_success_warn: '⚠️ Temperatura Registrada con Advertencias\n\n{store}\n\nFuera de rango:\n{failures}\n\nPor favor verificar.',

    help_direct:     '📋 *Comandos Disponibles*\n\n*/help* — Mostrar esta lista.\n*/broth* — Iniciar Registro Diario (el bot pregunta la tienda).\n*/broth Stone Oak* — Iniciar Registro Diario para Stone Oak.\n*/template* — Mostrar estado y lista de plantilla.\n*/log* — Mostrar estado del registro de Google Sheet.\n*/status* — Mostrar estado del sistema.\n\n*Durante /broth:*\nSTATUS — Mostrar borrador\nEDIT 6 42 — Cambiar ítem #6 a 42\nCONFIRM — Guardar en Google Sheet\nCANCEL — Descartar',

    help_group:      '📋 *Comandos Disponibles*\n\n*/ldagent* — Iniciar una sesión en este grupo.\n*/help* — Mostrar esta lista.\n*/status* — Mostrar estado del bot/sistema.\n\n*Durante una sesión:*\nYES / MENU — Volver al menú de flujo\nNO / END   — Cerrar sesión\nSTATUS     — Mostrar estado de sesión\nCANCEL     — Cancelar flujo actual\n\n*(Solo el miembro del personal que inició /ldagent puede controlar la sesión.)*',

    non_owner_busy:  '⚠️ El agente está ayudando a {owner} actualmente.\nPor favor espera hasta que la sesión se cierre.',

    store_warning:   '⚠️ ADVERTENCIA DE REGISTRO DIARIO\n\nTienda: {store}\nEnviado por: {staff}\n\nFuera de rango:\n{issues}\n\nPor favor verificar. Si la lectura es correcta, notifica al gerente inmediatamente.',

    reminder_subject: '⏰ Recordatorio: Registro Diario no enviado',
    reminder_body:    'Tu tienda ({store}) no ha enviado el registro diario aún.\n\nResponde:\n/ldagent\n\nLuego selecciona "Registro Diario" para enviar.',

    status_title:    '📊 Estado del Sistema',
    status_wa:       'WhatsApp: {status}',
    status_wa_ready: 'WhatsApp: ✅ Listo',
    status_wa_qr:    'WhatsApp: 📱 Escanea QR para conectar',
    status_wa_off:   'WhatsApp: ⚠️ Desconectado',
    status_template:  'Plantilla: {status} ({count} ítems)',
    status_template_ok: 'Plantilla: ✅ Sincronizada ({count} ítems)',
    status_template_stale: 'Plantilla: ⚠️ No sincronizada',
    status_last_log: 'Último registro: {time}',

    unmapped_group:  'Este grupo no está vinculado a una tienda aún.\nPor favor pide al administrador que configure este grupo en el Dashboard.',

    sys_unavailable: '⚠️ Esta función no está disponible aún.\nPor favor elige opción 1 o 2.',

    skip_ask_reason: '¿Razón?\n1. Termómetro roto\n2. Ítem no disponible\n3. Otro',
    skip_reason_broken: 'Termómetro roto',
    skip_reason_not_available: 'Ítem no disponible',
    skip_reason_other: 'Otro',
    skipped_item: '⏭️ Omitido: {item}',

    // ── Phase 1.5 keys (es) ────────────────────────────────────────
    welcome_agent:   '👋 Hola {name},\nTienda: *{store}*',
    choose_workflow: 'Elige un flujo de trabajo:',
    workflow_daily_entry: '1. Registro Diario',
    workflow_broth:       '2. Conteo de Caldo',
    workflow_temperature: '3. Control de Temperatura',
    workflow_food_safety: '4. Revisión de Seguridad Alimentaria',
    workflow_status:      '5. Estado del Sistema',
    reply_number_or_command: 'Responde con un número o comando.',
    type_end_to_close: 'Escribe END para cerrar.',
    ask_item_value:        '{item} = ?\n\nResponde con un número.',
    target_range:          'Rango: {min}–{max}',
    outside_range:         '⚠️ Fuera de Rango\n\n{item}: {value}°F\nEsperado: {target}',
    critical_temperature:  '🚨 Temperatura Crítica\n\n{item}: {value}°F\nEsperado: {target}',
    possible_typo:         '¿Quisiste decir {value}°F?',
    confirm_actual_reading: '1 — Confirmar lectura real',
    re_enter_value:        '2 — Ingresar de nuevo',
    skip_item:             '3 — Omitir este ítem',
    please_enter_number:   '⚠️ Por favor ingresa un número.\n\n{item}\n\nEjemplo: 35',
    detected_celsius:      '⚠️ Detectado {celsius}°C',
    converted_to_fahrenheit: '= {fahrenheit}°F',
    confirm_conversion:    '¿Usar {fahrenheit}°F?',
    saved:                 '✅ Guardado.',
    next_item:             'Siguiente: {item}',
    summary:               '📋 Resumen — {store}',
    confirm_to_save:       'CONFIRM — guardar en Google Sheet',
    edit_to_fix:           'EDIT <ítem> <valor> — corregir uno',
    cancel_to_discard:     'CANCEL — descartar',
    logged_success:        '✅ Registro Diario Guardado\n\nTienda: {store}\nEstado: PASS',
    logged_with_warnings:  '⚠️ Registro Diario Guardado con Advertencias\n\nTienda: {store}\n\nFuera de rango:\n{failures}',
    manager_notified:      'El gerente ha sido notificado.',
    sheet_queued:          'Guardado localmente. Escritura en Google Sheet en cola.',
    session_status:        '📊 *Estado de Sesión*\nResponsable: {owner}\nTienda: {store}\nEstado: {state}\nFlujo: {workflow}\nExpira en: {min} min',
    session_closed:        'Sesión cerrada. 👋',
    session_timeout:       '⏱️ Sesión cerrada por inactividad.',
    not_owner_session:     'Solo el personal que inició /ldagent puede controlar esta sesión.',
    group_not_mapped:      'Este grupo no está vinculado a una tienda. Pide al admin mapear este grupo.',
    voice_not_supported:   'Los mensajes de voz aún no están disponibles. Escriba el número.',
    language_set:          'Idioma configurado: {lang}',
    language_supported:    'Idiomas admitidos: en, es, vi, fr',
    language_invalid:      'Idioma no admitido: {lang}. Admitidos: en, es, vi, fr',
    language_reset:        'Preferencia de idioma eliminada.',
    language_current:      'Idioma actual: {lang}',
  },

  vi: {
    greeting:        'Xin chào {name}, tôi sẵn sàng hỗ trợ.\nChỉ cần làm theo từng bước.',

    menu_intro:      'Xin chào {name},\nCửa hàng: *{store}*',
    menu_choose:     'Chọn một mục:',
    menu_option1:    '1. Nhật Ký Hàng Ngày',
    menu_option2:    '2. Đếm Nước Dùng',
    menu_option3:    '3. Kiểm Tra Nhiệt Độ',
    menu_option4:    '4. An Toàn Thực Phẩm',
    menu_option5:    '5. Trạng Thái Hệ Thống',
    menu_end:        'Trả lời bằng số.\nGõ END để đóng.',

    ask_store:       'Chọn cửa hàng:',
    ask_store_hint:  'Chọn cửa hàng:\n\n1 Rim\n2 Stone Oak\n3 Bandera',
    bad_store:       '⚠️ Không nhận diện được cửa hàng.\n\n{askStoreHint}',
    store_selected:  'Cửa hàng: {store}',

    summary_title:   '📋 Tóm Tắt — {store}',
    summary_reply:   'CONFIRM — lưu vào Google Sheet\nEDIT <mục> <giá trị> — sửa một mục\nSTATUS — xem bản nháp\nCANCEL — hủy',

    success_saved:   '✅ Nhật Ký Hàng Ngày Đã Lưu\n\nCửa hàng: {store}\nTrạng thái: PASS\n\n📊 Đã lưu vào Google Sheet.',
    success_warning: '⚠️ Nhật Ký Hàng Ngày Đã Lưu Với Cảnh Báo\n\nCửa hàng: {store}\n\nNgoài phạm vi:\n{failures}\n\nVui lòng kiểm tra lại.',
    success_queued:  '✅ Nhật Ký Hàng Ngày Đã Lưu\n\nCửa hàng: {store}\nTrạng thái: PASS\n\n💾 Đã lưu cục bộ. Sẽ đồng bộ sang Google Sheet sớm.',

    edit_applied:    '✏️ Đã cập nhật: {item} = {value}',

    session_help:    '📋 *Lệnh Phiên*\n\nYES / MENU — Quay về menu\nNO / END   — Đóng phiên\nSTATUS     — Xem trạng thái\nCANCEL     — Hủy quy trình hiện tại (giữ phiên)\nCONFIRM    — Lưu vào Google Sheet',

    session_status:  '📊 *Trạng Thái Phiên*\nNgười dùng: {owner}\nCửa hàng: {store}\nTrạng thái: {state}\nQuy trình: {workflow}\nHết hạn: {min} phút\n\nGõ MENU để quay lại, END để đóng.',

    session_closing: 'Cảm ơn, {name}. Phiên đã đóng. 👋',
    session_timeout: '⏱️ Phiên đã đóng do không hoạt động.\nCảm ơn, {name}.',

    more_prompt:     'Bạn cần thêm gì không?\nYES — tiếp tục\nNO — đóng phiên',

    breadcrumb_ask:  '{item} = ?\n\nTrả lời bằng số.',
    breadcrumb_ask_with_range: '{item} = ?\n\nPhạm vi: {min}–{max}',
    breadcrumb_missing_remaining: 'Còn thiếu:\n{items}\n\nTrả lời theo thứ tự (phân cách bằng dấu phẩy):\n{placeholders}',
    breadcrumb_all_collected: '✅ Đã thu thập đủ các mục.',

    out_of_range:    '⚠️ Ngoài phạm vi\n\n{item}: {value}°F\nDự kiến: {target}',
    range_confirm_choices: '1 — Xác nhận đọc thực tế\n2 — Nhập lại giá trị\n3 — Bỏ qua mục này',
    range_confirm_choices_critical: '1 — Xác nhận đọc thực tế\n2 — Nhập lại giá trị\n\n⚠️ Điều này có thể cần quản lý xử lý.',
    critical_temperature: '🚨 Nhiệt Độ Nguy Hiểm\n\n{item}: {value}°F\nDự kiến: {target}',
    celsius_conversion_ask: '⚠️ Phát hiện {celsius}°C = {fahrenheit}°F.\n\n{item}:\nDùng {fahrenheit}°F?',
    confirm_1: 'Xác nhận',
    reenter_2: 'Nhập lại giá trị',
    skip_3: 'Bỏ qua mục này',
    invalid_number:  '⚠️ Không hiểu. Vui lòng nhập một số.\n\n{item}\n\nVí dụ: 35',

    invalid_number_legacy:  '⚠️ Không phải số hợp lệ.\n\n{item}: "{raw}"\n\nVui lòng nhập một số.',

    temp_welcome:    '🌡 Kiểm Tra Nhiệt Độ\n\n{store}\n\nTôi sẽ hỏi từng mục một.\n\nTrả lời bằng số cho từng mục.',

    temp_ask:        '{item}\n\nNhiệt độ?',
    temp_ask_range:  '{item}\n\nNhiệt độ? (Phạm vi: {min}–{max})',
    temp_out_of_range: '⚠️ Nhiệt độ ngoài phạm vi.\n\n{item}: {value}°\nPhạm vi: {target}\n\nXác nhận?\n1. Đúng rồi\n2. Nhập lại',

    temp_confirm_choices: '1. Đúng rồi\n2. Nhập lại',

    temp_summary:    '📋 Tóm Tắt Nhiệt Độ\n\n{rows}\n\nNgoài phạm vi:\n{failures}\n\nTrả lời:\nCONFIRM — lưu\nEDIT <mục> <giá trị> — sửa\nCANCEL — hủy',

    temp_success:    '✅ Nhiệt Độ Đã Ghi Nhận\n\n{store}\nTrạng thái: PASS\n\n📊 Đã lưu vào Google Sheet.',
    temp_success_warn: '⚠️ Nhiệt Độ Đã Ghi Nhận Với Cảnh Báo\n\n{store}\n\nNgoài phạm vi:\n{failures}\n\nVui lòng kiểm tra.',

    help_direct:     '📋 *Các Lệnh*\n\n*/help* — Hiển thị danh sách này.\n*/broth* — Bắt đầu Nhật Ký Hàng Ngày (bot hỏi cửa hàng).\n*/broth Stone Oak* — Bắt đầu cho Stone Oak.\n*/template* — Xem trạng thái và danh sách mẫu.\n*/log* — Xem trạng thái Google Sheet.\n*/status* — Xem trạng thái hệ thống.\n\n*Trong /broth:*\nSTATUS — Xem bản nháp\nEDIT 6 42 — Đổi mục #6 thành 42\nCONFIRM — Lưu vào Google Sheet\nCANCEL — Hủy',

    help_group:      '📋 *Các Lệnh*\n\n*/ldagent* — Bắt đầu phiên trong nhóm này.\n*/help* — Hiển thị danh sách này.\n*/status* — Xem trạng thái bot/hệ thống.\n\n*Trong phiên:*\nYES / MENU — Quay về menu quy trình\nNO / END   — Đóng phiên\nSTATUS     — Xem trạng thái phiên\nCANCEL     — Hủy quy trình hiện tại\n\n*(Chỉ nhân viên bắt đầu /ldagent mới điều khiển được phiên.)*',

    non_owner_busy:  '⚠️ Agent đang hỗ trợ {owner} lúc này.\nVui lòng đợi đến khi phiên đóng.',

    store_warning:   '⚠️ CẢNH BÁO NHẬT KÝ HÀNG NGÀY\n\nCửa hàng: {store}\nGửi bởi: {staff}\n\nNgoài phạm vi:\n{issues}\n\nVui lòng kiểm tra. Nếu số đọc đúng, báo ngay quản lý.',

    reminder_subject: '⏰ Nhắc nhở: Nhật Ký Hàng Ngày chưa gửi',
    reminder_body:    'Cửa hàng của bạn ({store}) chưa gửi nhật ký hàng ngày.\n\nTrả lời:\n/ldagent\n\nSau đó chọn "Nhật Ký Hàng Ngày" để gửi.',

    status_title:    '📊 Trạng Thái Hệ Thống',
    status_wa:       'WhatsApp: {status}',
    status_wa_ready: 'WhatsApp: ✅ Sẵn sàng',
    status_wa_qr:    'WhatsApp: 📱 Quét QR để kết nối',
    status_wa_off:   'WhatsApp: ⚠️ Đã ngắt kết nối',
    status_template:  'Mẫu: {status} ({count} mục)',
    status_template_ok: 'Mẫu: ✅ Đã đồng bộ ({count} mục)',
    status_template_stale: 'Mẫu: ⚠️ Chưa đồng bộ',
    status_last_log: 'Lần ghi cuối: {time}',

    unmapped_group:  'Nhóm này chưa được liên kết với cửa hàng.\nVui lòng nhờ admin liên kết nhóm này trong Dashboard.',

    sys_unavailable: '⚠️ Tính năng này chưa có sẵn.\nVui lòng chọn mục 1 hoặc 2.',

    skip_ask_reason: 'Lý do?\n1. Nhiệt kế hỏng\n2. Mục không có sẵn\n3. Khác',
    skip_reason_broken: 'Nhiệt kế hỏng',
    skip_reason_not_available: 'Mục không có sẵn',
    skip_reason_other: 'Khác',
    skipped_item: '⏭️ Đã bỏ qua: {item}',

    // ── Phase 1.5 keys (vi) ────────────────────────────────────────
    welcome_agent:   '👋 Xin chào {name},\nCửa hàng: *{store}*',
    choose_workflow: 'Chọn một quy trình:',
    workflow_daily_entry: '1. Nhật Ký Hàng Ngày',
    workflow_broth:       '2. Đếm Nước Dùng',
    workflow_temperature: '3. Kiểm Tra Nhiệt Độ',
    workflow_food_safety: '4. An Toàn Thực Phẩm',
    workflow_status:      '5. Trạng Thái Hệ Thống',
    reply_number_or_command: 'Trả lời bằng số hoặc lệnh.',
    type_end_to_close: 'Gõ END để đóng.',
    ask_item_value:        '{item} = ?\n\nTrả lời bằng số.',
    target_range:          'Phạm vi: {min}–{max}',
    outside_range:         '⚠️ Ngoài Phạm Vi\n\n{item}: {value}°F\nDự kiến: {target}',
    critical_temperature:  '🚨 Nhiệt Độ Nguy Hiểm\n\n{item}: {value}°F\nDự kiến: {target}',
    possible_typo:         'Có phải ý bạn là {value}°F?',
    confirm_actual_reading: '1 — Xác nhận đọc thực tế',
    re_enter_value:        '2 — Nhập lại giá trị',
    skip_item:             '3 — Bỏ qua mục này',
    please_enter_number:   '⚠️ Vui lòng nhập một số.\n\n{item}\n\nVí dụ: 35',
    detected_celsius:      '⚠️ Phát hiện {celsius}°C',
    converted_to_fahrenheit: '= {fahrenheit}°F',
    confirm_conversion:    'Dùng {fahrenheit}°F?',
    saved:                 '✅ Đã lưu.',
    next_item:             'Tiếp theo: {item}',
    summary:               '📋 Tóm Tắt — {store}',
    confirm_to_save:       'CONFIRM — lưu vào Google Sheet',
    edit_to_fix:           'EDIT <mục> <giá trị> — sửa một mục',
    cancel_to_discard:     'CANCEL — hủy',
    logged_success:        '✅ Nhật Ký Hàng Ngày Đã Lưu\n\nCửa hàng: {store}\nTrạng thái: PASS',
    logged_with_warnings:  '⚠️ Nhật Ký Hàng Ngày Đã Lưu Với Cảnh Báo\n\nCửa hàng: {store}\n\nNgoài phạm vi:\n{failures}',
    manager_notified:      'Quản lý đã được thông báo.',
    sheet_queued:          'Đã lưu cục bộ. Đang chờ ghi vào Google Sheet.',
    session_status:        '📊 *Trạng Thái Phiên*\nNgười dùng: {owner}\nCửa hàng: {store}\nTrạng thái: {state}\nQuy trình: {workflow}\nHết hạn: {min} phút',
    session_closed:        'Phiên đã đóng. 👋',
    session_timeout:       '⏱️ Phiên đã đóng do không hoạt động.',
    not_owner_session:     'Chỉ nhân viên đã bắt đầu /ldagent mới điều khiển được phiên này.',
    group_not_mapped:      'Nhóm này chưa được liên kết với cửa hàng. Vui lòng nhờ admin liên kết nhóm.',
    voice_not_supported:   'Hiện chưa hỗ trợ tin nhắn thoại. Vui lòng nhập số.',
    language_set:          'Đã đặt ngôn ngữ: {lang}',
    language_supported:    'Ngôn ngữ hỗ trợ: en, es, vi, fr',
    language_invalid:      'Ngôn ngữ không hỗ trợ: {lang}. Hỗ trợ: en, es, vi, fr',
    language_reset:        'Đã xóa tùy chọn ngôn ngữ.',
    language_current:      'Ngôn ngữ hiện tại: {lang}',
  },

  // ─── French (fr) ─ Phase 1.5 ─────────────────────────────────────
  fr: {
    greeting:        'Bonjour {name}, je suis là pour aider.\nSuivez simplement les étapes.',

    welcome_agent:   '👋 Bonjour {name},\nMagasin: *{store}*',

    menu_intro:      'Bonjour {name},\nMagasin: *{store}*',
    menu_choose:     'Choisissez un flux de travail:',
    menu_option1:    '1. Journal quotidien',
    menu_option2:    '2. Compte de bouillon',
    menu_option3:    '3. Contrôle de température',
    menu_option4:    '4. Revue de sécurité alimentaire',
    menu_option5:    '5. Statut du système',
    menu_end:        'Répondez avec un numéro ou une commande.\nTapez FIN pour fermer.',

    choose_workflow: 'Choisissez un flux de travail:',
    workflow_daily_entry: '1. Journal quotidien',
    workflow_broth:       '2. Compte de bouillon',
    workflow_temperature: '3. Contrôle de température',
    workflow_food_safety: '4. Revue de sécurité alimentaire',
    workflow_status:      '5. Statut du système',
    reply_number_or_command: 'Répondez avec un numéro ou une commande.',
    type_end_to_close: 'Tapez FIN pour fermer.',

    ask_store:       'Quel magasin?',
    ask_store_hint:  '1. Rim\n2. Stone Oak\n3. Bandera',
    bad_store:       '⚠️ Magasin non reconnu.\n\n{askStoreHint}',
    store_selected:  'Magasin: {store}',

    ask_item_value:        '{item} = ?\n\nRépondez avec un nombre.',
    target_range:          'Plage: {min}–{max}',
    outside_range:         '⚠️ Hors plage\n\n{item}: {value}°F\nAttendu: {target}',
    critical_temperature:  '🚨 Température Critique\n\n{item}: {value}°F\nAttendu: {target}',
    possible_typo:         'Vouliez-vous dire {value}°F?',
    confirm_actual_reading: '1 — Confirmer la lecture réelle',
    re_enter_value:        '2 — Entrer à nouveau',
    skip_item:             '3 — Ignorer cet élément',
    please_enter_number:   '⚠️ Veuillez entrer un nombre.\n\n{item}\n\nExemple: 35',
    detected_celsius:      '⚠️ Détecté {celsius}°C',
    converted_to_fahrenheit: '= {fahrenheit}°F',
    confirm_conversion:    'Utiliser {fahrenheit}°F?',

    summary_title:   '📋 Résumé — {store}',
    summary_reply:   'CONFIRM — enregistrer dans Google Sheet\nEDIT <élément> <valeur> — corriger un élément\nSTATUS — voir le brouillon\nCANCEL — annuler',

    confirm_to_save: 'CONFIRM — enregistrer dans Google Sheet',
    edit_to_fix:     'EDIT <élément> <valeur> — corriger un élément',
    cancel_to_discard: 'CANCEL — annuler',

    success_saved:   '✅ Journal Quotidien Enregistré\n\nMagasin: {store}\nStatut: PASS\n\n📊 Enregistré dans Google Sheet.',
    success_warning: '⚠️ Journal Quotidien Enregistré avec Avertissements\n\nMagasin: {store}\n\nHors plage:\n{failures}\n\nVeuillez vérifier.',
    success_queued:  '✅ Journal Quotidien Enregistré\n\nMagasin: {store}\nStatut: PASS\n\n💾 Enregistré localement. Synchronisation bientôt.',

    saved:                 '✅ Enregistré.',
    next_item:             'Suivant: {item}',
    summary:               '📋 Résumé — {store}',
    logged_success:        '✅ Journal Quotidien Enregistré\n\nMagasin: {store}\nStatut: PASS',
    logged_with_warnings:  '⚠️ Journal Quotidien Enregistré avec Avertissements\n\nMagasin: {store}\n\nHors plage:\n{failures}',
    manager_notified:      'Le gérant a été notifié.',
    sheet_queued:          'Enregistré localement. Écriture Google Sheet en file.',

    edit_applied:    '✏️ Mis à jour: {item} = {value}',

    session_help:    '📋 *Commandes de Session*\n\nYES / MENU — Retour au menu\nNO / END   — Fermer la session\nSTATUS     — Afficher le statut\nCANCEL     — Annuler le flux actuel (conserver la session)\nCONFIRM    — Enregistrer dans Google Sheet',

    session_status:  '📊 *Statut de Session*\nPropriétaire: {owner}\nMagasin: {store}\nÉtat: {state}\nFlux: {workflow}\nExpire dans: {min} min\n\nTapez MENU pour revenir, FIN pour fermer.',

    session_closing: 'Merci, {name}. Session fermée. 👋',
    session_timeout: '⏱️ Session fermée pour inactivité.\nMerci, {name}.',

    more_prompt:     'Avez-vous besoin d’autre chose?\nYES — continuer\nNO — fermer la session',

    breadcrumb_ask:  '{item} = ?\n\nRépondez avec un nombre.',
    breadcrumb_ask_with_range: '{item} = ?\n\nPlage: {min}–{max}',
    breadcrumb_missing_remaining: 'Il manque encore:\n{items}\n\nRépondez dans l’ordre (séparé par des virgules):\n{placeholders}',
    breadcrumb_all_collected: '✅ Tous les éléments collectés.',

    out_of_range:    '⚠️ Hors plage\n\n{item}: {value}°F\nAttendu: {target}',
    range_confirm_choices: '1 — Confirmer la lecture réelle\n2 — Entrer à nouveau\n3 — Ignorer cet élément',
    range_confirm_choices_critical: '1 — Confirmer la lecture réelle\n2 — Entrer à nouveau\n\n⚠️ Cela peut nécessiter l’attention du gérant.',
    celsius_conversion_ask: '⚠️ Détecté {celsius}°C = {fahrenheit}°F.\n\n{item}:\nUtiliser {fahrenheit}°F?',
    confirm_1: 'Confirmer',
    reenter_2: 'Entrer à nouveau',
    skip_3: 'Ignorer cet élément',
    invalid_number:  '⚠️ Non compris. Veuillez entrer un nombre.\n\n{item}\n\nExemple: 35',
    invalid_number_legacy:  '⚠️ Nombre invalide.\n\n{item}: "{raw}"\n\nVeuillez entrer un nombre.',

    temp_welcome:    '🌡 Contrôle de Température\n\n{store}\n\nJe demanderai un par un.\n\nRépondez avec un nombre pour chaque élément.',

    temp_ask:        '{item}\n\nTempérature?',
    temp_ask_range:  '{item}\n\nTempérature? (Plage: {min}–{max})',
    temp_out_of_range: '⚠️ Température hors plage.\n\n{item}: {value}°\nPlage: {target}\n\nConfirmer?\n1. Correct\n2. Entrer à nouveau',
    temp_confirm_choices: '1. Correct\n2. Entrer à nouveau',

    temp_summary:    '📋 Résumé Température\n\n{rows}\n\nHors plage:\n{failures}\n\nRépondez:\nCONFIRM — enregistrer\nEDIT <élément> <valeur> — corriger\nCANCEL — annuler',
    temp_success:    '✅ Température Enregistrée\n\n{store}\nStatut: PASS\n\n📊 Enregistré dans Google Sheet.',
    temp_success_warn: '⚠️ Température Enregistrée avec Avertissements\n\n{store}\n\nHors plage:\n{failures}\n\nVeuillez vérifier.',

    help_direct:     '📋 *Commandes Disponibles*\n\n*/help* — Afficher cette liste.\n*/broth* — Démarrer Journal quotidien (bot demande le magasin).\n*/broth Stone Oak* — Démarrer pour Stone Oak.\n*/template* — Afficher l’état du modèle et la liste des éléments.\n*/log* — Afficher l’état du journal Google Sheet.\n*/status* — Afficher l’état du système.\n\n*Pendant /broth:*\nSTATUS — Afficher le brouillon\nEDIT 6 42 — Modifier l’élément #6 à 42\nCONFIRM — Enregistrer dans Google Sheet\nCANCEL — Annuler',

    help_group:      '📋 *Commandes Disponibles*\n\n*/ldagent* — Démarrer une session dans ce groupe.\n*/help* — Afficher cette liste.\n*/status* — Afficher l’état du bot/système.\n\n*Pendant une session:*\nYES / MENU — Retour au menu de flux\nNO / END   — Fermer la session\nSTATUS     — Afficher le statut de session\nCANCEL     — Annuler le flux actuel\n\n*(Seul le personnel qui a démarré /ldagent peut contrôler la session.)*',

    non_owner_busy:  '⚠️ L’agent assiste {owner} actuellement.\nVeuillez attendre la fin de la session.',

    store_warning:   '⚠️ AVERTISSEMENT JOURNAL QUOTIDIEN\n\nMagasin: {store}\nEnvoyé par: {staff}\n\nHors plage:\n{issues}\n\nVeuillez vérifier. Si la lecture est correcte, avertissez le gérant immédiatement.',

    reminder_subject: '⏰ Rappel: Journal Quotidien non soumis',
    reminder_body:    'Votre magasin ({store}) n’a pas encore soumis le journal quotidien.\n\nRépondez:\n/ldagent\n\nPuis sélectionnez « Journal quotidien » pour soumettre.',

    status_title:    '📊 Statut du Système',
    status_wa:       'WhatsApp: {status}',
    status_wa_ready: 'WhatsApp: ✅ Prêt',
    status_wa_qr:    'WhatsApp: 📱 Scannez le QR pour connecter',
    status_wa_off:   'WhatsApp: ⚠️ Déconnecté',
    status_template:  'Modèle: {status} ({count} éléments)',
    status_template_ok: 'Modèle: ✅ Synchronisé ({count} éléments)',
    status_template_stale: 'Modèle: ⚠️ Non synchronisé',
    status_last_log: 'Dernier enregistrement: {time}',

    unmapped_group:  'Ce groupe n’est pas encore lié à un magasin.\nVeuillez demander à l’admin de mapper ce groupe dans le Dashboard.',

    sys_unavailable: '⚠️ Cette fonctionnalité n’est pas encore disponible.\nVeuillez choisir l’option 1 ou 2.',

    skip_ask_reason: 'Raison?\n1. Thermomètre cassé\n2. Élément non disponible\n3. Autre',
    skip_reason_broken: 'Thermomètre cassé',
    skip_reason_not_available: 'Élément non disponible',
    skip_reason_other: 'Autre',
    skipped_item: '⏭️ Ignoré: {item}',

    session_closed:        'Session fermée. 👋',
    not_owner_session:     'Seul le personnel qui a démarré /ldagent peut contrôler cette session.',
    group_not_mapped:      'Ce groupe n’est pas lié à un magasin. Demandez à l’admin de le mapper.',
    voice_not_supported:   'Les messages vocaux ne sont pas encore pris en charge. Veuillez taper le nombre.',

    language_set:          'Langue définie: {lang}',
    language_supported:    'Langues prises en charge: en, es, vi, fr',
    language_invalid:      'Langue non prise en charge: {lang}. Prises en charge: en, es, vi, fr',
    language_reset:        'Préférence de langue effacée.',
    language_current:      'Langue actuelle: {lang}',
  },
};

const FALLBACK = 'en';

function t(key, lang, vars = {}) {
  const dict = T[lang] || T[FALLBACK];
  let text = dict[key] || T[FALLBACK][key] || key;

  // Replace {var} placeholders
  text = text.replace(/\{(\w+)\}/g, (match, name) => {
    return vars[name] !== undefined ? String(vars[name]) : match;
  });

  return text;
}

function supported(lang) {
  return lang in T;
}

function getAllKeys() {
  return Object.keys(T.en);
}

module.exports = { T, t, supported, getAllKeys, FALLBACK };
