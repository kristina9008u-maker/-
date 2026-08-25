from aiogram import Router, F, Bot
from aiogram.types import Message, CallbackQuery
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
import json
import html as html_lib
from config import ADMIN_ID, CARD_PAYMENT_DETAILS, BOT_TOKEN
import database as db
import keyboards as kb
from states import CancelOrderFSM

router = Router()

def esc(text) -> str:
    """Экранирование HTML-спецсимволов в пользовательских данных."""
    if text is None:
        return ""
    return html_lib.escape(str(text))

# ----------------- УТИЛИТА: ПОЛУЧЕНИЕ ФОТО ПРОФИЛЯ -----------------
async def get_user_photo_url(bot: Bot, user_id: int) -> str:
    """Получает URL фото профиля пользователя через Telegram Bot API."""
    try:
        photos = await bot.get_user_profile_photos(user_id, limit=1)
        if photos.total_count > 0 and photos.photos:
            photo = photos.photos[0][-1]
            file = await bot.get_file(photo.file_id)
            return f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file.file_path}"
    except Exception as e:
        print(f"Ошибка получения фото: {e}")
    return ""

# ----------------- УТИЛИТА: ОТПРАВКА СТАТУСА ПОКУПАТЕЛЮ -----------------
async def send_status_to_user(bot: Bot, order_id: int, user_id: int, msg_text: str, new_status: str, local_id=None):
    """Удаляет старое уведомление о статусе и отправляет новое. Сохраняет msg_id."""
    order = await db.get_order_by_id(order_id)
    order_dict = dict(order) if order else {}
    old_msg_id = order_dict.get('last_status_msg_id')
    
    if old_msg_id:
        try:
            await bot.delete_message(chat_id=user_id, message_id=old_msg_id)
        except Exception:
            pass
    
    try:
        user_chat = await bot.get_chat(user_id)
    except Exception:
        user_chat = None
    
    photo_url = await get_user_photo_url(bot, user_id)
    
    status_kb = kb.user_status_update_keyboard(
        order_id, new_status, local_id=local_id, user=user_chat, photo_url=photo_url
    )
    
    sent = await bot.send_message(
        chat_id=user_id,
        text=msg_text,
        parse_mode="HTML",
        reply_markup=status_kb
    )
    
    await db.update_order_msg_id(order_id, sent.message_id)

# ----------------- КОМАНДЫ -----------------
@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext, bot: Bot):
    await state.clear()
    
    # Удаляем старую Reply клавиатуру (если она осталась у пользователя)
    from aiogram.types import ReplyKeyboardRemove
    tmp_msg = await message.answer("🔄 Обновление меню...", reply_markup=ReplyKeyboardRemove())
    await bot.delete_message(chat_id=message.chat.id, message_id=tmp_msg.message_id)
    
    welcome_text = (
        "🌱 <b>Приветствуем в сити-ферме микрозелени 'Зелёный Урожай'!</b> 🌱\n\n"
        "Мы выращиваем живую, экологически чистую микрозелень без химикатов.\n\n"
        "✨ Нажмите кнопку <b>'🌱 ОТКРЫТЬ ВИТРИНУ'</b> ниже, чтобы зайти в наш интерактивный каталог!"
    )
    await message.answer(welcome_text, parse_mode="HTML", reply_markup=kb.main_menu_keyboard(message.from_user))

@router.message(Command("admin"))
async def cmd_admin(message: Message):
    if str(message.from_user.id) != str(ADMIN_ID):
        return await message.answer("У вас нет прав доступа к панели администратора.")
    
    stats = await db.get_orders_stats()
    orders = await db.get_active_orders()
    
    text = (
        "📊 <b>АДМИН-ПАНЕЛЬ</b>\n\n"
        f"Всего заказов за все время: <b>{stats['total_orders']}</b>\n"
        f"Общая выручка: <b>{int(stats['total_revenue'])} ₽</b>\n\n"
        "🚚 <b>Активные заказы (в работе - последние 10):</b>\n"
    )
    
    if not orders:
        text += "<i>Нет активных заказов.</i>"
    else:
        for o in orders:
            status = o['status']
            price = int(o['total_price'])
            text += f"• Заказ #{o['id']} | {status} | {price} ₽\n"
            
    await message.answer(text, parse_mode="HTML")

# ----------------- ОБРАБОТЧИК ДАННЫХ ИЗ TELEGRAM MINI APP -----------------
@router.message(F.web_app_data)
async def process_web_app_data(message: Message, bot: Bot):
    """Прием данных о заказе, сформированных в Telegram Mini App."""
    try:
        data = json.loads(message.web_app_data.data)
        user_id = message.from_user.id
        username = message.from_user.username or ""
        
        local_order_id = data.get("id", 0)
        
        order_id = await db.create_order(
            user_id=user_id,
            customer_name=data.get("customer_name", "Не указано"),
            phone=data.get("phone", "Не указано"),
            delivery_type=data.get("delivery_type", "Самовывоз"),
            address=data.get("address", "Самовывоз"),
            delivery_date=data.get("delivery_date", "Ближайшая"),
            payment_method=data.get("payment_method", "При получении"),
            items=data.get("items", []),
            total_price=data.get("total_price", 0.0),
            local_id=local_order_id
        )
        
        photo_url = await get_user_photo_url(bot, user_id)
        
        res_text = (
            f"🎉 <b>Заказ #{order_id} из WebApp витрины успешно оформлен!</b>\n\n"
            f"👤 <b>Покупатель:</b> {esc(data.get('customer_name'))}\n"
            f"📞 <b>Телефон:</b> <code>{esc(data.get('phone'))}</code>\n"
            f"📦 <b>Способ получения:</b> {esc(data.get('delivery_type'))}\n"
            f"📍 <b>Адрес:</b> {esc(data.get('address'))}\n"
            f"📅 <b>Дата/время получения:</b> {esc(data.get('delivery_date'))}\n"
            f"💳 <b>Способ оплаты:</b> {esc(data.get('payment_method'))}\n\n"
            f"💰 <b>Итого к оплате: {int(data.get('total_price', 0))} ₽</b>\n\n"
            f"📋 Нажмите кнопку ниже, чтобы отслеживать статус в Личном кабинете:"
        )
        if data.get("payment_method") == "💳 Перевод по реквизитам":
            res_text += f"\n\nℹ️ <b>Реквизиты для перевода:</b> <code>{esc(CARD_PAYMENT_DETAILS)}</code>"
        
        sync_kb = kb.user_sync_order_keyboard(order_id, local_order_id, message.from_user, photo_url=photo_url)
        sent = await message.answer(res_text, parse_mode="HTML", reply_markup=sync_kb)
        
        await db.update_order_msg_id(order_id, sent.message_id)
        
        if ADMIN_ID and ADMIN_ID != 0:
            if username:
                buyer_info = f"@{esc(username)}"
            else:
                buyer_info = f"ID: <code>{user_id}</code>"
            
            admin_text = (
                f"🔔 <b>НОВЫЙ ЗАКАЗ #{order_id} (из Mini App)!</b>\n\n"
                f"👤 <b>Покупатель:</b> {esc(data.get('customer_name'))} ({buyer_info})\n"
                f"📞 <b>Телефон:</b> <code>{esc(data.get('phone'))}</code>\n"
                f"📦 <b>Получение:</b> {esc(data.get('delivery_type'))}\n"
                f"📍 <b>Адрес:</b> {esc(data.get('address'))}\n"
                f"📅 <b>Желаемая дата/время:</b> {esc(data.get('delivery_date'))}\n"
                f"💳 <b>Оплата:</b> {esc(data.get('payment_method'))}\n\n"
                f"💰 <b>Сумма заказа: {int(data.get('total_price', 0))} ₽</b>"
            )
            await bot.send_message(
                chat_id=ADMIN_ID,
                text=admin_text,
                parse_mode="HTML",
                reply_markup=kb.admin_order_keyboard(order_id, current_status='Новый')
            )
    except Exception as e:
        await message.answer(f"⚠️ Ошибка при обработке заказа из Mini App: {e}")

# ----------------- ИНФОРМАЦИОННЫЕ КНОПКИ (ИЗ СТАРОГО МЕНЮ И НОВОГО) -----------------
@router.message(F.text == "ℹ️ О нас и Доставка")
@router.callback_query(F.data == "show_about")
async def show_about(event):
    text = "🌱 <b>О нашей эко-ферме:</b>\nДоставка от 1000 ₽ бесплатно, срезка каждое утро!"
    if isinstance(event, Message):
        await event.answer(text, parse_mode="HTML")
    else:
        await event.message.answer(text, parse_mode="HTML")
        await event.answer()

@router.message(F.text == "📞 Контакты")
@router.callback_query(F.data == "show_contacts")
async def show_contacts(event):
    text = "📞 <b>Контакты:</b> @microgreens_farm_manager | +7 (900) 123-45-67"
    if isinstance(event, Message):
        await event.answer(text, parse_mode="HTML")
    else:
        await event.message.answer(text, parse_mode="HTML")
        await event.answer()

# ----------------- АДМИН: УПРАВЛЕНИЕ СТАТУСАМИ ЗАКАЗОВ -----------------
@router.callback_query(F.data.startswith("adm_status:"))
async def callback_admin_status(callback: CallbackQuery, bot: Bot):
    if callback.from_user.id != ADMIN_ID:
        await callback.answer("Нет прав.", show_alert=True)
        return
    _, order_id_str, new_status = callback.data.split(":")
    order_id = int(order_id_str)
    order = await db.get_order_by_id(order_id)
    if not order:
        await callback.answer("Заказ не найден.", show_alert=True)
        return
    
    await db.update_order_status(order_id, new_status)
    await callback.answer(f"✅ Статус #{order_id} → {new_status}")
    
    # Обновляем клавиатуру у менеджера — убираем нажатую кнопку и все предыдущие
    if new_status == "Завершён":
        try:
            await callback.message.delete()
        except Exception:
            pass
            
        if order.get('is_subscription'):
            stage = order.get('subscription_stage', 1)
            if stage == 4:
                try:
                    await bot.send_message(
                        chat_id=order['user_id'],
                        text="🎉 <b>Ваш «Месяц свежести» подошел к концу!</b>

Надеемся, вам было вкусно и полезно 🌿

Оформите новую подписку в нашем меню, чтобы витамины всегда были у вас на столе!",
                        parse_mode="HTML"
                    )
                except Exception as e:
                    print(f"Failed to send sub end msg: {e}")
    else:
        try:
            updated_kb = kb.admin_order_keyboard(order_id, current_status=new_status)
            await callback.message.edit_reply_markup(reply_markup=updated_kb)
        except Exception:
            pass
    
    order_dict = dict(order)
    del_date = esc(order_dict.get('delivery_date') or 'согласно графику')
    user_id = order_dict.get('user_id')
    local_id = order_dict.get('local_id')
    
    if new_status == "Принят":
        msg_text = (
            f"✅ <b>Ваш заказ #{order_id} принят!</b>\n\n"
            f"Мы начнём подготовку в ближайшее время.\n\n"
            f"📋 Нажмите кнопку ниже, чтобы увидеть обновлённый статус:"
        )
    elif new_status == "Выращивается":
        msg_text = (
            f"🌱 <b>Ваша микрозелень поставлена на выращивание!</b>\n\n"
            f"📦 <b>Заказ #{order_id}</b> успешно запущен в рост на нашей сити-ферме.\n"
            f"📅 <b>Планируемая дата готовности:</b> {del_date}.\n\n"
            f"Мы срежем микрозелень прямо перед доставкой, чтобы вы получили самые свежие и сочные витамины! 🌿✨\n\n"
            f"📋 Нажмите кнопку ниже, чтобы увидеть обновлённый статус:"
        )
    elif new_status == "Всё выросло":
        msg_text = (
            f"🌿 <b>Ваша микрозелень по заказу #{order_id} полностью выросла!</b>\n\n"
            f"Урожай собран и готов к отправке. Скоро передадим курьеру! 🎉\n\n"
            f"📋 Нажмите кнопку ниже, чтобы увидеть обновлённый статус:"
        )
    elif new_status == "В пути":
        msg_text = (
            f"🚚 <b>Ваш заказ #{order_id} передан курьеру!</b>\n\n"
            f"Ожидайте доставку: {del_date}.\n\n"
            f"📋 Нажмите кнопку ниже, чтобы увидеть обновлённый статус:"
        )
    elif new_status == "Завершён":
        msg_text = (
            f"🏁 <b>Заказ #{order_id} завершён!</b>\n\n"
            f"Спасибо за покупку! Приятного аппетита и будьте здоровы! 🌿💚\n\n"
            f"📋 Нажмите кнопку ниже, чтобы увидеть обновлённый статус:"
        )
    else:
        msg_text = (
            f"ℹ️ Статус вашего заказа <b>#{order_id}</b> изменен на: <b>{esc(new_status)}</b>\n\n"
            f"📋 Нажмите кнопку ниже, чтобы увидеть обновлённый статус:"
        )
    
    if user_id:
        try:
            await send_status_to_user(bot, order_id, user_id, msg_text, new_status, local_id)
        except Exception as e:
            print(f"Ошибка отправки покупателю: {e}")

# ----------------- АДМИН: ОТМЕНА ЗАКАЗА С ПРИЧИНОЙ -----------------
@router.callback_query(F.data.startswith("adm_cancel:"))
async def callback_admin_cancel_start(callback: CallbackQuery, state: FSMContext, bot: Bot):
    """Первый шаг отмены — запрос причины у менеджера."""
    if callback.from_user.id != ADMIN_ID:
        await callback.answer("Нет прав.", show_alert=True)
        return
    
    order_id_str = callback.data.split(":")[1]
    order_id = int(order_id_str)
    order = await db.get_order_by_id(order_id)
    if not order:
        await callback.answer("Заказ не найден.", show_alert=True)
        return
    
    await state.set_state(CancelOrderFSM.waiting_for_reason)
    await state.update_data(cancel_order_id=order_id)
    
    await callback.answer()
    await callback.message.answer(
        f"❌ <b>Отмена заказа #{order_id}</b>\n\n"
        f"Напишите причину отмены в следующем сообщении.\n"
        f"Эта причина будет отправлена покупателю.\n\n"
        f"<i>Или нажмите кнопку ниже, чтобы не отменять:</i>",
        parse_mode="HTML",
        reply_markup=kb.cancel_confirm_keyboard(order_id)
    )

@router.callback_query(F.data.startswith("adm_cancel_abort:"))
async def callback_admin_cancel_abort(callback: CallbackQuery, state: FSMContext):
    """Менеджер передумал отменять заказ."""
    await state.clear()
    await callback.answer("Отмена отклонена.", show_alert=False)
    await callback.message.edit_text("✅ Отмена заказа отклонена. Заказ не изменён.")

@router.message(CancelOrderFSM.waiting_for_reason)
async def process_cancel_reason(message: Message, state: FSMContext, bot: Bot):
    """Второй шаг — менеджер ввёл причину отмены."""
    if message.from_user.id != ADMIN_ID:
        return
    
    data = await state.get_data()
    order_id = data.get('cancel_order_id')
    reason = message.text.strip()
    
    if not order_id:
        await state.clear()
        await message.answer("⚠️ Ошибка: заказ не найден. Попробуйте ещё раз.")
        return
    
    order = await db.get_order_by_id(order_id)
    if not order:
        await state.clear()
        await message.answer("⚠️ Заказ не найден в базе данных.")
        return
    
    await db.update_order_status(order_id, "Отменен")
    await state.clear()
    
    await message.answer(
        f"❌ <b>Заказ #{order_id} отменён.</b>\n"
        f"📝 Причина: <i>{esc(reason)}</i>\n\n"
        f"Покупатель уведомлён.",
        parse_mode="HTML"
    )
    
    order_dict = dict(order)
    user_id = order_dict.get('user_id')
    local_id = order_dict.get('local_id')
    
    if user_id:
        try:
            msg_text = (
                f"❌ <b>Ваш заказ #{order_id} отменён.</b>\n\n"
                f"📝 <b>Причина:</b> {esc(reason)}\n\n"
                f"Если у вас есть вопросы, свяжитесь с нами.\n\n"
                f"📋 Нажмите кнопку ниже, чтобы увидеть обновлённый статус:"
            )
            await send_status_to_user(bot, order_id, user_id, msg_text, "Отменен", local_id)
        except Exception as e:
            print(f"Ошибка отправки покупателю об отмене: {e}")