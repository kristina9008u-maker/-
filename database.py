import asyncpg
import json
import os
from config import DATABASE_URL

_pool = None

async def get_pool():
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise ValueError("DATABASE_URL is not set in .env")
        _pool = await asyncpg.create_pool(
            DATABASE_URL, 
            min_size=1, 
            max_size=5,
            command_timeout=60,
            max_inactive_connection_lifetime=300
        )
    return _pool

async def init_db():
    """РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ СЃРѕР·РґР°РЅРёРµ С‚Р°Р±Р»РёС† Рё Р·Р°РїРѕР»РЅРµРЅРёРµ РЅР°С‡Р°Р»СЊРЅС‹РјРё С‚РѕРІР°СЂР°РјРё (PostgreSQL)."""
    pool = await get_pool()
    async with pool.acquire() as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                code TEXT PRIMARY KEY,
                name TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                category_code TEXT NOT NULL,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                weight TEXT NOT NULL,
                description TEXT,
                image_url TEXT,
                FOREIGN KEY (category_code) REFERENCES categories (code)
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                customer_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                delivery_type TEXT NOT NULL,
                address TEXT NOT NULL,
                delivery_date TEXT NOT NULL,
                payment_method TEXT NOT NULL,
                items_json TEXT NOT NULL,
                total_price REAL NOT NULL,
                status TEXT DEFAULT 'РќРѕРІС‹Р№',
                local_id TEXT,
                last_status_msg_id BIGINT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # РњРёРіСЂР°С†РёСЏ: РґРѕР±Р°РІР»СЏРµРј РЅРѕРІС‹Рµ РєРѕР»РѕРЅРєРё
        try:
            await db.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
            await db.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT FALSE")
            await db.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT")
            await db.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_iso TIMESTAMP")
            await db.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS notified_1d BOOLEAN DEFAULT FALSE")
            await db.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS notified_1h BOOLEAN DEFAULT FALSE")
                        await db.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_msg_id BIGINT")
            await db.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS plant_time TIMESTAMP")
            await db.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS subscription_stage INTEGER DEFAULT 1")
        except Exception:
            pass
        
        # РџСЂРѕРІРµСЂСЏРµРј, РµСЃС‚СЊ Р»Рё РєР°С‚РµРіРѕСЂРёРё
        count = await db.fetchval("SELECT COUNT(*) FROM categories")
        if count == 0:
            categories = [
                ("live_trays", "рџЊ± Р–РёРІС‹Рµ Р»РѕС‚РєРё (СЂР°СЃС‚СѓС‰РёРµ)"),
                ("cut_greens", "вњ‚пёЏ РЎСЂРµР·Р°РЅРЅР°СЏ РјРёРєСЂРѕР·РµР»РµРЅСЊ"),
                ("sets", "рџЋЃ РќР°Р±РѕСЂС‹ & РџРѕРґРїРёСЃРєРё")
            ]
            await db.executemany("INSERT INTO categories (code, name) VALUES ($1, $2)", categories)
            
            products = [
                ("live_trays", "Р“РѕСЂРѕС€РµРє РњР°С€", 150.0, "1 Р»РѕС‚РѕРє (10x15 СЃРј)", "РЎР»Р°РґРєРёР№ С…СЂСѓСЃС‚СЏС‰РёР№ РјРёРєСЂРѕРіРѕСЂРѕС€РµРє. Р‘РѕРіР°С‚С‹Р№ Р±РµР»РѕРє Рё РІРёС‚Р°РјРёРЅС‹ C, E.", ""),
                ("live_trays", "РџРѕРґСЃРѕР»РЅРµС‡РЅРёРє", 180.0, "1 Р»РѕС‚РѕРє (10x15 СЃРј)", "РЎРѕС‡РЅС‹Рµ СЂРѕСЃС‚РєРё СЃ РѕСЂРµС…РѕРІС‹Рј РІРєСѓСЃРѕРј.", ""),
                ("live_trays", "Р РµРґРёСЃ Р РµРґ РљРѕСЂР°Р»Р»", 160.0, "1 Р»РѕС‚РѕРє (10x15 СЃРј)", "РЇСЂРєРёРµ РїРёРєР°РЅС‚РЅС‹Рµ СЂРѕСЃС‚РєРё СЃ РїСЂРёСЏС‚РЅРѕР№ РѕСЃС‚СЂРѕР№ РЅРѕС‚РєРѕР№.", ""),
                ("live_trays", "Р‘СЂРѕРєРєРѕР»Рё Р Р°РїРёРЅРё", 170.0, "1 Р»РѕС‚РѕРє (10x15 СЃРј)", "РЎСѓРїРµСЂС„СѓРґ СЃ РІС‹СЃРѕРєРѕР№ РєРѕРЅС†РµРЅС‚СЂР°С†РёРµР№ СЃСѓР»СЊС„РѕСЂР°С„Р°РЅР°.", ""),
                ("cut_greens", "РЎСЂРµР· Р“РѕСЂРѕС€РєР°", 200.0, "100 РіСЂР°РјРј", "РЎРІРµР¶РµСЃСЂРµР·Р°РЅРЅС‹Рµ РїРѕР±РµРіРё РіРѕСЂРѕС€РєР° РІ РєРѕРЅС‚РµР№РЅРµСЂРµ.", ""),
                ("cut_greens", "РњРёРєСЃ-РЎСЂРµР· 'Р’РёС‚Р°РјРёРЅРЅС‹Р№'", 250.0, "100 РіСЂР°РјРј", "РђСЃСЃРѕСЂС‚Рё РёР· 3 РІРёРґРѕРІ СЃРІРµР¶РµР№ РјРёРєСЂРѕР·РµР»РµРЅРё.", ""),
                ("sets", "РќР°Р±РѕСЂ 'Р’РёС‚Р°РјРёРЅРЅС‹Р№ СЃС‚Р°СЂС‚'", 500.0, "3 Р»РѕС‚РєР°", "РўСЂРё Р¶РёРІС‹С… Р»РѕС‚РєР° РЅР° РІС‹Р±РѕСЂ СЃРѕ СЃРєРёРґРєРѕР№!", ""),
                ("sets", "РџРѕРґРїРёСЃРєР° 'РњРµСЃСЏС† СЃРІРµР¶РµСЃС‚Рё'", 1800.0, "4 РЅРµРґРµР»Рё", "Р”РѕСЃС‚Р°РІРєР° 3 Р¶РёРІС‹С… Р»РѕС‚РєРѕРІ РєР°Р¶РґСѓСЋ РЅРµРґРµР»СЋ РІ С‚РµС‡РµРЅРёРµ РјРµСЃСЏС†Р°.", "")
            ]
            await db.executemany(
                "INSERT INTO products (category_code, name, price, weight, description, image_url) VALUES ($1, $2, $3, $4, $5, $6)",
                products
            )

async def get_categories():
    pool = await get_pool()
    async with pool.acquire() as db:
        return await db.fetch("SELECT * FROM categories")

async def get_products_by_category(category_code: str):
    pool = await get_pool()
    async with pool.acquire() as db:
        return await db.fetch("SELECT * FROM products WHERE category_code = $1", category_code)

async def get_product_by_id(product_id: int):
    pool = await get_pool()
    async with pool.acquire() as db:
        return await db.fetchrow("SELECT * FROM products WHERE id = $1", product_id)

async def create_order(user_id, customer_name, phone, delivery_type, address, delivery_date, payment_method, items, total_price, local_id=None, is_subscription=False, promo_code='', delivery_iso=None) -> int:
    pool = await get_pool()
    async with pool.acquire() as db:
        items_json = json.dumps(items, ensure_ascii=False)
        order_id = await db.fetchval(
            """
            INSERT INTO orders (user_id, customer_name, phone, delivery_type, address, delivery_date, payment_method, items_json, total_price, local_id, is_subscription, promo_code, delivery_iso)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id
            """,
            user_id, customer_name, phone, delivery_type, address, delivery_date, payment_method, items_json, total_price, str(local_id) if local_id else None, is_subscription, promo_code, delivery_iso
        )
        return order_id

async def get_order_by_id(order_id: int):
    pool = await get_pool()
    async with pool.acquire() as db:
        return await db.fetchrow("SELECT * FROM orders WHERE id = $1", order_id)

async def update_order_status(order_id: int, status: str):
    pool = await get_pool()
    async with pool.acquire() as db:
        await db.execute("UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", status, order_id)

async def update_order_msg_id(order_id: int, msg_id: int):
    pool = await get_pool()
    async with pool.acquire() as db:
        await db.execute("UPDATE orders SET last_status_msg_id = $1 WHERE id = $2", msg_id, order_id)

async def get_active_orders():
    """РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє РІСЃРµС… Р·Р°РєР°Р·РѕРІ, РєРѕС‚РѕСЂС‹Рµ РЅРµ РѕС‚РјРµРЅРµРЅС‹ Рё РЅРµ Р·Р°РІРµСЂС€РµРЅС‹."""
    pool = await get_pool()
    async with pool.acquire() as db:
        return await db.fetch("SELECT * FROM orders WHERE status NOT IN ('Р—Р°РІРµСЂС€С‘РЅ', 'РћС‚РјРµРЅРµРЅ') ORDER BY created_at DESC LIMIT 10")

async def get_orders_stats():
    """РџРѕР»СѓС‡РёС‚СЊ РѕР±С‰СѓСЋ СЃС‚Р°С‚РёСЃС‚РёРєСѓ Р·Р°РєР°Р·РѕРІ."""
    pool = await get_pool()
    async with pool.acquire() as db:
        total_orders = await db.fetchval("SELECT COUNT(*) FROM orders")
        total_revenue = await db.fetchval("SELECT SUM(total_price) FROM orders WHERE status = 'Р—Р°РІРµСЂС€С‘РЅ'")
        return {"total_orders": total_orders or 0, "total_revenue": total_revenue or 0.0}

async def get_orders_for_followup(days_ago: int = 3):
    """РџРѕР»СѓС‡РёС‚СЊ Р·Р°РєР°Р·С‹, РєРѕС‚РѕСЂС‹Рµ Р±С‹Р»Рё РІС‹РїРѕР»РЅРµРЅС‹ СЂРѕРІРЅРѕ X РґРЅРµР№ РЅР°Р·Р°Рґ."""
    pool = await get_pool()
    async with pool.acquire() as db:
        return await db.fetch(
            "SELECT * FROM orders WHERE status = 'Р—Р°РІРµСЂС€С‘РЅ' AND updated_at >= CURRENT_DATE - $1::integer AND updated_at < CURRENT_DATE - ($1::integer - 1)",
            days_ago
        )

async def get_pending_notifications():
    pool = await get_pool()
    async with pool.acquire() as db:
        return await db.fetch("SELECT * FROM orders WHERE status NOT IN ('✅ Завершен', '❌ Отменен', 'Отменен') AND delivery_iso IS NOT NULL AND (notified_1d = FALSE OR notified_1h = FALSE)")

async def mark_notified(order_id: int, flag_name: str):
    pool = await get_pool()
    async with pool.acquire() as db:
        if flag_name == '1d':
            await db.execute("UPDATE orders SET notified_1d = TRUE WHERE id = $1", order_id)
        elif flag_name == '1h':
            await db.execute("UPDATE orders SET notified_1h = TRUE WHERE id = $1", order_id)

async def update_admin_msg_id(order_id: int, msg_id: int):
    pool = await get_pool()
    async with pool.acquire() as db:
        await db.execute("UPDATE orders SET admin_msg_id = $1 WHERE id = $2", msg_id, order_id)

async def update_delivery_time(order_id: int, new_iso):
    pool = await get_pool()
    async with pool.acquire() as db:
        await db.execute("UPDATE orders SET delivery_iso = $1 WHERE id = $2", new_iso, order_id)

async def create_clone_order(orig, stage: int, plant_time):
    pool = await get_pool()
    async with pool.acquire() as db:
        await db.execute('''
            INSERT INTO orders (user_id, customer_name, phone, delivery_type, address, delivery_date, payment_method, items_json, total_price, is_subscription, subscription_stage, plant_time, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ''', orig['user_id'], orig['customer_name'], orig['phone'], orig['delivery_type'], orig['address'], orig['delivery_date'], orig['payment_method'], orig['items_json'], orig['total_price'], True, stage, plant_time, "Ожидает посадки")

async def get_pending_clones(now_local):
    pool = await get_pool()
    async with pool.acquire() as db:
        return await db.fetch("SELECT * FROM orders WHERE status = 'Ожидает посадки' AND plant_time <= $1", now_local)

async def activate_clone(order_id: int):
    pool = await get_pool()
    async with pool.acquire() as db:
        await db.execute("UPDATE orders SET status = '⚙️ Новый' WHERE id = $1", order_id)
