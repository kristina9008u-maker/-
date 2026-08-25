import asyncio
import logging
import sys
from aiogram import Bot, Dispatcher
from aiogram.client.session.aiohttp import AiohttpSession
from config import BOT_TOKEN
import database as db
from handlers import router
logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logging.basicConfig(level=logging.INFO, stream=sys.stdout)

async def auto_reminder_task(bot: Bot):
    while True:
        try:
            # Получаем заказы, выполненные 3 дня назад
            orders = await db.get_orders_for_followup(days_ago=3)
            for order in orders:
                user_id = order['user_id']
                customer_name = order['customer_name']
                order_id = order['id']
                text = (
                    f"Привет, {customer_name}! 👋\n\n"
                    f"Прошло 3 дня с момента получения вашего заказа #{order_id} 🌱\n"
                    "Будем очень рады узнать ваше мнение: всё ли понравилось, как проросла микрозелень?\n\n"
                    "🎁 <b>В качестве комплимента дарим промокод GREEN10 на скидку 10% на следующий заказ!</b>\n"
                    "Просто введите его в комментарии при следующем оформлении."
                )
                try:
                    await bot.send_message(chat_id=user_id, text=text, parse_mode="HTML")
                    # Отмечаем как-то? Пока просто полагаемся на окно времени
                except Exception as e:
                    print(f"Failed to send followup to {user_id}: {e}")
                await asyncio.sleep(1) # Защита от спама
        except Exception as e:
            print(f"Error in auto_reminder_task: {e}")
        
        # Спим 24 часа
        await asyncio.sleep(86400)

async def main():
    if not BOT_TOKEN or len(BOT_TOKEN) < 10:
        print("\n❌ ОШИБКА: Не указан BOT_TOKEN в config.py!\n")
        return
    # 1. Инициализация базы данных
    await db.init_db()
    # 2. Настройка бота
    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher()
    # 3. Регистрация обработчиков
    dp.include_router(router)
    # 4. Сброс старых вебхуков
    try:
        await bot.delete_webhook(drop_pending_updates=True)
    except Exception:
        pass
    print("\n[OK] Бот сити-фермы микрозелени успешно запущен!\n")
    
    import scheduler
    asyncio.create_task(scheduler.check_notifications(bot))
    asyncio.create_task(auto_reminder_task(bot))
    
    # 5. Запуск веб-сервера
    import server
    app_runner = None
    try:
        app_runner = await server.setup_server(bot)
    except Exception as e:
        print(f"\n⚠️ Ошибка при запуске веб-сервера: {e}")
        print("Проверьте, не занят ли порт (обычно 8080) другим процессом.")
        # Не возвращаемся, позволяем боту работать хотя бы в Telegram
        
    try:
        print("⏳ Запуск polling...")
        await dp.start_polling(bot)
    except Exception as e:
        print(f"\n⚠️ Ошибка polling: {e}\n")
    finally:
        print("\n🛑 Остановка бота...")
        await bot.session.close()
        if app_runner:
            try:
                await app_runner.cleanup()
            except:
                pass
if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        print("Бот остановлен.")