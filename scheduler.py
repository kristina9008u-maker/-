import asyncio
import database as db
from config import ADMIN_ID
import keyboards as kb
from aiogram import Bot
from datetime import datetime, timedelta
import logging
import json

async def check_notifications(bot: Bot):
    while True:
        try:
            # Render использует время UTC, поэтому прибавляем 7 часов для твоего часового пояса
            now = datetime.utcnow() + timedelta(hours=7)
            # --- ЛОГИКА ПОДПИСОК (КЛОНЫ) ---
            clones = await db.get_pending_clones(now)
            for clone in clones:
                stage = clone.get('subscription_stage', 2)
                await db.activate_clone(clone['id'])
                
                try:
                    chat_info = await bot.get_chat(clone['user_id'])
                    username = chat_info.username
                except Exception:
                    username = None
                buyer_info = f"@{username}" if username else f"ID: <code>{clone['user_id']}</code>"
                
                text = (
                    f"🔄 <b>ПОДПИСКА (Неделя {stage} из 4)!</b>\\n"
                    f"🌱 <b>Пора сажать новую партию для клиента!</b>\\n\\n"
                    f"👤 <b>Покупатель:</b> {clone.get('customer_name', 'Не указан')} ({buyer_info})\\n"
                    f"📞 <b>Телефон:</b> <code>{clone.get('phone', 'Не указан')}</code>\\n"
                    f"📦 <b>Получение:</b> {clone.get('delivery_type', 'Самовывоз')}\\n"
                    f"📍 <b>Адрес:</b> {clone.get('address', 'Самовывоз')}\\n"
                    f"💳 <b>Оплата:</b> {clone.get('payment_method', 'При получении')}\\n"
                )
                
                try:
                    msg = await bot.send_message(
                        chat_id=ADMIN_ID,
                        text=text,
                        reply_markup=kb.admin_order_keyboard(clone['id'], current_status='⚙️ Новый'),
                        parse_mode="HTML"
                    )
                    await db.update_admin_msg_id(clone['id'], msg.message_id)
                except Exception as e:
                    logging.error(f"Failed to send clone msg: {e}")
            # -------------------------------
            orders = await db.get_pending_notifications()
            for order in orders:
                if 'Выращивается' not in order.get('status', ''):
                    continue
                delivery_time = order['delivery_iso']
                time_diff = delivery_time - now
                hours_left = time_diff.total_seconds() / 3600
                
                msg_id = order.get('admin_msg_id')
                if not msg_id:
                    # Fallback to old behavior just in case
                    msg_id = order.get('last_status_msg_id')
                if not msg_id:
                    continue

                prefix = None
                flag_to_update = None

                if hours_left <= 1.0 and not order['notified_1h']:
                    prefix = '🔥 ВНИМАНИЕ: ДО ОТПРАВКИ 1 ЧАС!'
                    flag_to_update = '1h'
                elif 1.0 < hours_left <= 24.0 and not order['notified_1d']:
                    prefix = '⏳ ВНИМАНИЕ: ДО ОТПРАВКИ 1 ДЕНЬ!'
                    flag_to_update = '1d'

                if prefix:
                    # Формируем старый текст заказа
                    try:
                        chat_info = await bot.get_chat(order['user_id'])
                        username = chat_info.username
                    except Exception:
                        username = None
                        
                    buyer_info = f"@{username}" if username else f"ID: <code>{order['user_id']}</code>"
                    
                    text = (
                        f"🔔 <b>НОВЫЙ ЗАКАЗ #{order['id']} (из WebApp API)!</b>\n\n"
                        f"👤 <b>Покупатель:</b> {order.get('customer_name', 'Не указан')} ({buyer_info})\n"
                        f"📞 <b>Телефон:</b> <code>{order.get('phone', 'Не указан')}</code>\n"
                        f"📦 <b>Получение:</b> {order.get('delivery_type', 'Самовывоз')}\n"
                        f"📍 <b>Адрес:</b> {order.get('address', 'Самовывоз')}\n"
                        f"📆 <b>Желаемая дата/время:</b> {order.get('delivery_date', 'Как можно скорее')}\n"
                        f"💳 <b>Оплата:</b> {order.get('payment_method', 'При получении')}\n\n"
                        f"💰 <b>Сумма заказа: {int(order.get('total_price', 0))} ₽</b>"
                    )

                    new_text = f"<b>{prefix}</b>\n\n{text}"
                    
                    try:
                        await bot.send_message(
                            chat_id=ADMIN_ID,
                            text=new_text,
                            reply_markup=kb.admin_order_keyboard(order['id'], order['status']),
                            parse_mode="HTML"
                        )
                        await db.mark_notified(order['id'], flag_to_update)
                    except Exception as e:
                        logging.error(f"Failed to update notification msg for order {order['id']}: {e}")
        except Exception as e:
            logging.error(f"Error in scheduler: {e}")
        
        await asyncio.sleep(300)  # проверяем раз в 5 минут
