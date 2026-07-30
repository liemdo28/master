#!/usr/bin/env python3
"""Generate lang/{en-US,es-US,vi-VN}.php from config/i18n.php + new keys."""
import re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
I18N = os.path.join(ROOT, 'config', 'i18n.php')
LANG = os.path.join(ROOT, 'lang')
os.makedirs(LANG, exist_ok=True)

with open(I18N, 'r', encoding='utf-8') as f:
    src = f.read()

def extract(loc):
    if loc == 'vi':
        pat = re.compile(r"'vi'\s*=>\s*\[(.*?)\],\s*'en'", re.DOTALL)
    else:
        pat = re.compile(r"'en'\s*=>\s*\[(.*?)\]\s*;", re.DOTALL)
    m = pat.search(src)
    if not m: return {}
    p = {}
    for ln in m.group(1).split('\n'):
        ln = ln.strip()
        if not ln or ln.startswith('//'): continue
        km = re.match(r"'([^']+)'\s*=>\s*'(.*)',?\s*$", ln)
        if km: p[km.group(1)] = km.group(2)
    return p

en = extract('en')
vi = extract('vi')
print(f"Extracted: {len(en)} EN, {len(vi)} VI")

# New keys with translations for all 3 locales
# Format: key => (en, es, vi)
NK = {
    'lang.en-US': ('English', 'English', 'English'),
    'lang.es-US': ('Espanol', 'Espanol', 'Espanol'),
    'lang.vi-VN': ('Tieng Viet', 'Tieng Viet', 'Tieng Viet'),
    'nav.ceo_dashboard': ('CEO Dashboard', 'Panel del CEO', 'Tong giam doc'),
    'nav.store_health': ('Store Health', 'Salud de Tienda', 'Suc khoe cua hang'),
    'nav.store_command': ('Command Center', 'Centro de Comando', 'Trung tam Dieu khien'),
    'nav.penalties': ('Penalties', 'Sanciones', 'Ky luat'),
    'nav.releases': ('Release Center', 'Centro de Lanzamientos', 'Phat hanh'),
    'nav.permissions': ('Permissions', 'Permisos', 'Quyen han'),
    'page.ceo_dashboard': ('CEO Dashboard', 'Panel del CEO', 'Tong giam doc'),
    'page.store_health': ('Store Health', 'Salud de Tienda', 'Suc khoe cua hang'),
    'page.store_command': ('Store Command Center', 'Centro de Comando de Tiendas', 'Trung tam Dieu khien cua hang'),
    'page.penalties': ('Penalties', 'Sanciones', 'Ky luat'),
    'page.releases': ('Release Center', 'Centro de Lanzamientos', 'Phat hanh'),
    'page.permissions': ('Permissions', 'Permisos', 'Quyen han'),
    'settings.preferred_language': ('Preferred Language', 'Idioma Preferido', 'Ngon ngu uu tien'),
    'settings.preferred_language_desc': ('Choose the language for system notifications, emails, and UI.', 'Elija el idioma para notificaciones, correos e interfaz.', 'Chon ngon ngu cho thong bao, email va giao dien.'),
    'dashboard.kpi.cash_risk': ('Total Cash Risk', 'Riesgo de Efectivo Total', 'Tong rui ro tien mat'),
    'dashboard.kpi.compliance_risk': ('Compliance Risk', 'Riesgo de Cumplimiento', 'Rui ro phap ly'),
    'dashboard.kpi.critical_tasks': ('Critical Tasks', 'Tareas Criticas', 'Cong viec nghiem trong'),
    'dashboard.finance.payment_risk_board': ('Payment Risk Board', 'Panel de Riesgo de Pagos', 'Bang rui ro thanh toan'),
    'dashboard.finance.recommended_payment_order': ('Recommended Payment Order', 'Orden de Pago Recomendado', 'Thu tu thanh toan de xuat'),
    'dashboard.finance.recommended_payment_desc': ('Pay these bills first to minimize risk', 'Pague estas facturas primero para minimizar el riesgo', 'Thanh toan nhung hoa don nay truoc de giam thieu rui ro'),
    'dashboard.operations.store_health_issues': ('Store Health Issues', 'Problemas de Salud de Tienda', 'Van de suc khoe cua hang'),
    'executive.overdue_tasks_risks': ('Overdue Tasks (Risks)', 'Tareas Vencidas (Riesgos)', 'Cong viec qua han (Rui ro)'),
    'executive.store_checklists_today': ('Store Checklists Today', 'Listas de Verificacion de Tienda Hoy', 'Checklist cua hang hom nay'),
    'executive.summary': ('Executive Summary', 'Resumen Ejecutivo', 'Tom tat dieu hanh'),
    'executive.action_items': ('Action Items', 'Acciones Pendientes', 'Hang muc hanh dong'),
    'executive.revenue_trend': ('Revenue Trend', 'Tendencia de Ingresos', 'Xu huong doanh thu'),
    'ceo.dashboard_title': ('CEO Dashboard', 'Panel del CEO', 'Bang tong giam doc'),
    'ceo.business_overview': ('Business Overview', 'Resumen del Negocio', 'Tong quan kinh doanh'),
    'ceo.financial_summary': ('Financial Summary', 'Resumen Financiero', 'Tom tat tai chinh'),
    'ceo.operational_health': ('Operational Health', 'Salud Operativa', 'Suc khoe van hanh'),
    'status.critical': ('Critical', 'Critico', 'Nghiem trong'),
    'status.high': ('High', 'Alta', 'Cao'),
    'status.medium': ('Medium', 'Media', 'Trung binh'),
    'status.low': ('Low', 'Baja', 'Thap'),
    'status.pending': ('Pending', 'Pendiente', 'Dang cho'),
    'status.completed': ('Completed', 'Completada', 'Hoan thanh'),
    'status.overdue': ('Overdue', 'Vencida', 'Qua han'),
    'status.paid': ('Paid', 'Pagada', 'Da thanh toan'),
    'status.unpaid': ('Unpaid', 'No Pagada', 'Chua thanh toan'),
    'status.on_track': ('On Track', 'En Curso', 'Dung tien do'),
    'status.at_risk': ('At Risk', 'En Riesgo', 'Co rui ro'),
    'status.blocked': ('Blocked', 'Bloqueada', 'Bi chan'),
    'status.needs_review': ('Needs Review', 'Requiere Revision', 'Can xem xet'),
    'status.watch': ('Watch', 'Vigilar', 'Theo doi'),
    'status.stable': ('Stable', 'Estable', 'On dinh'),
    'status.active': ('Active', 'Activa', 'Hoat dong'),
    'status.inactive': ('Inactive', 'Inactiva', 'Ngung hoat dong'),
    'status.archived': ('Archived', 'Archivada', 'Luu tru'),
    'status.needs_business_data': ('Needs Business Data', 'Requiere Datos del Negocio', 'Can du lieu kinh doanh'),
    'button.create_new': ('Create New', 'Crear Nuevo', 'Tao moi'),
    'button.upload_docs': ('Upload Documents', 'Subir Documentos', 'Tai tai lieu'),
    'button.view_details': ('View Details', 'Ver Detalles', 'Xem chi tiet'),
    'button.save': ('Save', 'Guardar', 'Luu'),
    'button.cancel': ('Cancel', 'Cancelar', 'Huy'),
    'button.delete': ('Delete', 'Eliminar', 'Xoa'),
    'button.edit': ('Edit', 'Editar', 'Chinh sua'),
    'button.close': ('Close', 'Cerrar', 'Dong'),
    'button.confirm': ('Confirm', 'Confirmar', 'Xac nhan'),
    'button.back': ('Back', 'Volver', 'Quay lai'),
    'button.next': ('Next', 'Siguiente', 'Tiep'),
    'button.refresh': ('Refresh', 'Actualizar', 'Lam moi'),
    'empty.no_vendor_data': ('No vendor data available', 'No hay datos de proveedores', 'Chua co du lieu nha cung cap'),
    'empty.no_store_data': ('No store data available', 'No hay datos de tiendas', 'Chua co du lieu cua hang'),
    'empty.no_task_data': ('No task data available', 'No hay datos de tareas', 'Chua co du lieu cong viec'),
    'empty.no_bill_data': ('No bill data available', 'No hay datos de facturas', 'Chua co du lieu hoa don'),
    'empty.no_results': ('No results found', 'No se encontraron resultados', 'Khong tim thay ket qua'),
    'error.internal': ('An internal error occurred', 'Ocurrio un error interno', 'Da xay ra loi noi bo'),
    'error.not_found': ('Page not found', 'Pagina no encontrada', 'Khong tim thay trang'),
    'error.permission_denied': ('You do not have permission', 'No tiene permiso', 'Ban khong co quyen'),
    'error.connection_failed': ('Connection failed', 'Conexion fallida', 'Ket noi that bai'),
    'notification.task_assigned': ('Task assigned to you', 'Tarea asignada a usted', 'Task duoc giao cho ban'),
    'notification.task_completed': ('Task completed', 'Tarea completada', 'Task da hoan thanh'),
    'notification.bill_due_reminder': ('Bill due reminder', 'Recordatorio de factura por vencer', 'Nhac nho hoa don den han'),
    'notification.penalty_alert': ('Penalty alert', 'Alerta de sancion', 'Canh bao ky luat'),
    'drawer.store_overview': ('Store Overview', 'Resumen de Tienda', 'Tong quan cua hang'),
    'drawer.recent_activity': ('Recent Activity', 'Actividad Reciente', 'Hoat dong gan day'),
    'drawer.quick_actions': ('Quick Actions', 'Acciones Rapidas', 'Thao tac nhanh'),
    'mobile.nav.home': ('Home', 'Inicio', 'Trang chu'),
    'mobile.nav.tasks': ('Tasks', 'Tareas', 'Viec can lam'),
    'mobile.nav.calendar': ('Calendar', 'Calendario', 'Lich'),
    'mobile.nav.inbox': ('Inbox', 'Bandeja', 'Hop thu'),
    'mobile.nav.more': ('More', 'Mas', 'Them'),
    'penalty.late_task': ('Late Task', 'Tarea Tardia', 'Task tre han'),
    'penalty.missed_deadline': ('Missed Deadline', 'Fecha Limite Perdida', 'Bo qua han chot'),
    'penalty.assessment': ('Penalty Assessment', 'Evaluacion de Sancion', 'Danh gia ky luat'),
    'release.new_version': ('New Version', 'Nueva Version', 'Phien ban moi'),
    'release.changelog': ('Changelog', 'Registro de Cambios', 'Nhat ky thay doi'),
    'release.deploy': ('Deploy', 'Desplegar', 'Trien khai'),
    'inbox.mark_all_read': ('Mark all as read', 'Marcar todo como leido', 'Doc het'),
    'inbox.empty': ('Inbox is empty', 'La bandeja esta vacia', 'Hop thu trong'),
    'inbox.empty_desc': ('You will receive notifications when tasks are assigned, commented, or due soon.', 'Recibira notificaciones cuando se asignen, comenten o esten por vencer tareas.', 'Ban se nhan thong bao khi co ai giao cong viec, binh luan, hoac cong viec sap den han.'),
}

# Merge: use all keys from en + vi + new
all_keys = sorted(set(list(en.keys()) + list(vi.keys()) + list(NK.keys())))
idx_map = {'en': 0, 'es': 1, 'vi': 2}

def esc(s):
    return s.replace('\\', '\\\\').replace("'", "\\'")

def gen(locale):
    loc_idx = idx_map.get(locale, 0)
    lines = []
    for k in all_keys:
        if k in NK:
            val = NK[k][loc_idx]
        elif locale in ('en', 'vi'):
            val = (en if locale == 'en' else vi).get(k, k)
        else:
            val = en.get(k, k)
        lines.append(f"    '{esc(k)}' => '{esc(val)}',")
    return lines

for loc, fname in [('en', 'en-US.php'), ('es', 'es-US.php'), ('vi', 'vi-VN.php')]:
    lines = gen(loc)
    content = f"<?php\n/**\n * Language Pack: {fname}\n * Keys: {len(lines)}\n */\nreturn [\n" + "\n".join(lines) + "\n];\n"
    path = os.path.join(LANG, fname)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Generated {fname} ({len(lines)} keys)")

print(f"\nTotal unique keys: {len(all_keys)}")
