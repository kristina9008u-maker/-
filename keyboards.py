from aiogram.types import (
    ReplyKeyboardMarkup, KeyboardButton,
    InlineKeyboardMarkup, InlineKeyboardButton,
    WebAppInfo
)
from aiogram.utils.keyboard import InlineKeyboardBuilder
from config import WEBAPP_URL
import urllib.parse

# Порядок статусов — каждый следующий «выше» предыдущего
STATUS_FLOW = ['Новый', 'Принят', 'Выращивается', 'Всё выросло', 'В пути', 'Завершён']

# Кнопки для каждого статуса: (текст, callback-статус)
STATUS_BUTTONS = {
    'Принят':       ('✅ Принять заказ',  'Принят'),
    'Выращивается': ('🌱 Готовится',      'Выращивается'),
    'Всё выросло':  ('🌿 Всё выросло!',  'Всё выросло'),
    'В пути':       ('🚚 Курьеру',       'В пути'),
    'Завершён':     ('🏁 Заказ завершён', 'Завершён'),
}

def main_menu_keyboard(user=None):
    """Главное меню (Inline Keyboard) привязанное к сообщению."""
    if user:
        uname = user.username or ''
        fname = user.first_name or ''
        lname = user.last_name or ''
        full_n = f"{fname} {lname}".strip() or uname or 'Покупатель'
        params = {
            'username': uname,
            'name': full_n,
            'id': str(user.id)
        }
        query_string = urllib.parse.urlencode(params)
        separator = '&' if '?' in WEBAPP_URL else '?'
        user_url = f"{WEBAPP_URL}{separator}{query_string}"
    else:
        user_url = WEBAPP_URL
        
    builder = InlineKeyboardBuilder()
    builder.button(text="🌱 ОТКРЫТЬ ВИТРИНУ", web_app=WebAppInfo(url=user_url))
    builder.button(text="ℹ️ О нас", callback_data="show_about")
    builder.button(text="📞 Контакты", callback_data="show_contacts")
    
    builder.adjust(1, 2)
    return builder.as_markup()

def admin_order_keyboard(order_id: int, current_status: str = 'Новый'):
    """Прогрессивная клавиатура менеджера — показывает только кнопки ПОСЛЕ текущего статуса.
    После нажатия нажатая кнопка и все предыдущие исчезают.
    """
    builder = InlineKeyboardBuilder()
    
    # Определяем индекс текущего статуса
    try:
        current_idx = STATUS_FLOW.index(current_status)
    except ValueError:
        current_idx = 0
    
    # Добавляем только кнопки для статусов ПОСЛЕ текущего
    remaining = STATUS_FLOW[current_idx + 1:]
    for status_key in remaining:
        if status_key in STATUS_BUTTONS:
            text, cb_status = STATUS_BUTTONS[status_key]
            builder.button(text=text, callback_data=f"adm_status:{order_id}:{cb_status}")
    
    # Кнопка отмены всегда внизу (если заказ не завершён/не отменён)
    if current_status not in ('Завершён', 'Отменен'):
        builder.button(text="❌ Отменить заказ", callback_data=f"adm_cancel:{order_id}")
    
    # Раскладка: первая кнопка отдельно, остальные по 2-3
    btn_count = len(remaining)
    if current_status not in ('Завершён', 'Отменен'):
        btn_count += 1  # кнопка отмены
    
    if btn_count <= 1:
        builder.adjust(1)
    elif btn_count == 2:
        builder.adjust(1, 1)
    elif btn_count <= 4:
        builder.adjust(1, btn_count - 2, 1)
    else:
        builder.adjust(1, 3, 1, 1)
    
    return builder.as_markup()

def _build_webapp_url(user=None, extra_params=None):
    """Построить URL Mini App с пользовательскими и дополнительными параметрами."""
    params = {}
    if user:
        uname = getattr(user, 'username', '') or ''
        fname = getattr(user, 'first_name', '') or ''
        lname = getattr(user, 'last_name', '') or ''
        full_n = f"{fname} {lname}".strip() or uname or 'Покупатель'
        params['username'] = uname
        params['name'] = full_n
        uid = getattr(user, 'id', '')
        params['id'] = str(uid) if uid else ''
    if extra_params:
        params.update(extra_params)
    query_string = urllib.parse.urlencode(params)
    separator = '&' if '?' in WEBAPP_URL else '?'
    return f"{WEBAPP_URL}{separator}{query_string}"

def user_status_update_keyboard(order_id: int, new_status: str, local_id=None, user=None, photo_url=None):
    """Inline-кнопка 'Открыть Личный кабинет' — открывает Mini App с параметрами обновления статуса."""
    extra = {
        'order_update': f"{order_id}:{new_status}",
        'open_profile': '1'
    }
    if local_id:
        extra['local_id'] = str(local_id)
    if photo_url:
        extra['photo'] = photo_url
    url = _build_webapp_url(user, extra)
    builder = InlineKeyboardBuilder()
    builder.button(
        text="📋 Открыть Личный кабинет",
        web_app=WebAppInfo(url=url)
    )
    return builder.as_markup()

def user_sync_order_keyboard(real_order_id: int, local_order_id, user=None, photo_url=None):
    """Inline-кнопка для привязки реального ID заказа из БД к локальному ID из Mini App."""
    extra = {
        'sync_order_id': str(real_order_id),
        'local_id': str(local_order_id),
        'open_profile': '1'
    }
    if photo_url:
        extra['photo'] = photo_url
    url = _build_webapp_url(user, extra)
    builder = InlineKeyboardBuilder()
    builder.button(
        text="📋 Открыть Личный кабинет",
        web_app=WebAppInfo(url=url)
    )
    return builder.as_markup()

def cancel_confirm_keyboard(order_id: int):
    """Кнопки подтверждения/отмены для отмены заказа (после ввода причины)."""
    builder = InlineKeyboardBuilder()
    builder.button(text="🔙 Не отменять", callback_data=f"adm_cancel_abort:{order_id}")
    return builder.as_markup()