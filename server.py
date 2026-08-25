import json
import logging
import os
from aiohttp import web
import database as db
from config import ADMIN_ID, CARD_PAYMENT_DETAILS
import keyboards as kb
from handlers import esc, get_user_photo_url

async def handle_order(request):
    bot = request.app['bot']
    try:
        data = await request.json()
        
        user_id = data.get('user_id')
        if not user_id:
            return web.json_response({"error": "user_id is required"}, status=400)
            
        try:
            user_id = int(user_id)
        except ValueError:
            pass
            
        username = data.get('username', '')
        local_order_id = data.get("id", 0)
        
        try:
            total_price = float(data.get("total_price", 0.0))
        except ValueError:
            total_price = 0.0
        
        is_subscription = data.get("is_subscription", False)
        promo_code = data.get("promo_code", "")
        
        delivery_iso_raw = data.get("delivery_iso")
        delivery_iso = None
        if delivery_iso_raw:
            from datetime import datetime
            try:
                delivery_iso = datetime.fromisoformat(delivery_iso_raw)
            except Exception:
                pass
        
        # Сохраняем в БД (PostgreSQL)
        order_id = await db.create_order(
            user_id=user_id,
            customer_name=data.get("customer_name", "Не указано"),
            phone=data.get("phone", "Не указано"),
            delivery_type=data.get("delivery_type", "Самовывоз"),
            address=data.get("address", "Самовывоз"),
            delivery_date=data.get("delivery_date", "Ближайшая"),
            payment_method=data.get("payment_method", "При получении"),
            items=data.get("items", []),
            total_price=total_price,
            local_id=local_order_id,
            is_subscription=is_subscription,
            promo_code=promo_code,
            delivery_iso=delivery_iso
        )
        
        # Получаем инфо пользователя для клавиатуры
        try:
            user_chat = await bot.get_chat(user_id)
        except Exception:
            user_chat = None
            
        photo_url = await get_user_photo_url(bot, user_id)
        
        # 1. Отправляем покупателю уведомление
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
            
        sync_kb = kb.user_sync_order_keyboard(order_id, local_order_id, user_chat, photo_url=photo_url)
        sent = await bot.send_message(chat_id=user_id, text=res_text, parse_mode="HTML", reply_markup=sync_kb)
        await db.update_order_msg_id(order_id, sent.message_id)
        
        # 2. Отправляем уведомление админу
        if ADMIN_ID and ADMIN_ID != 0:
            buyer_info = f"@{esc(username)}" if username else f"ID: <code>{user_id}</code>"
            admin_text = (
                f"🔔 <b>НОВЫЙ ЗАКАЗ #{order_id} (из WebApp API)!</b>\n\n"
                f"👤 <b>Покупатель:</b> {esc(data.get('customer_name'))} ({buyer_info})\n"
                f"📞 <b>Телефон:</b> <code>{esc(data.get('phone'))}</code>\n"
                f"📦 <b>Получение:</b> {esc(data.get('delivery_type'))}\n"
                f"📍 <b>Адрес:</b> {esc(data.get('address'))}\n"
                f"📅 <b>Желаемая дата/время:</b> {esc(data.get('delivery_date'))}\n"
                f"💳 <b>Оплата:</b> {esc(data.get('payment_method'))}\n\n"
                f"💰 <b>Сумма заказа: {int(data.get('total_price', 0))} ₽</b>"
            )
            if is_subscription:
                admin_text += "\n\n🔄 <b>ВНИМАНИЕ: Оформлена ЕЖЕНЕДЕЛЬНАЯ ПОДПИСКА!</b>"
            if promo_code:
                admin_text += f"\n🎟 <b>Применен промокод:</b> <code>{esc(promo_code)}</code>"
            msg = await bot.send_message(
                chat_id=ADMIN_ID,
                text=admin_text,
                parse_mode="HTML",
                reply_markup=kb.admin_order_keyboard(order_id, current_status='⚙️ Новый')
            )
            await db.update_admin_msg_id(order_id, msg.message_id)
            
        return web.json_response({"success": True, "order_id": order_id})
        
    except Exception as e:
        print(f"Server Error: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)

@web.middleware
async def cors_middleware(request, handler):
    if request.method == 'OPTIONS':
        response = web.Response()
    else:
        try:
            response = await handler(request)
        except web.HTTPException as ex:
            response = ex
    
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS, GET'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

async def handle_ping(request):
    return web.Response(text="Bot is alive!")

async def setup_server(bot):
    app = web.Application(middlewares=[cors_middleware])
    app['bot'] = bot
    
    # Роуты
    app.router.add_post('/api/order', handle_order)
    app.router.add_get('/', handle_ping)
        
    runner = web.AppRunner(app)
    await runner.setup()
    
    port = int(os.environ.get('PORT', 8080))
    site = web.TCPSite(runner, '0.0.0.0', port)
    await site.start()
    print(f"[OK] HTTP API Server running on port {port}")
    return runner
