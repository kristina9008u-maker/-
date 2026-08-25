import os
from dotenv import load_dotenv
# Загружаем .env из корня проекта (на 2 уровня выше Class/)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

# Токен вашего бота MicroLeafBot (обязательно указать в .env)
BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
if not BOT_TOKEN or len(BOT_TOKEN) < 10:
    print("\n[ERROR] Укажите BOT_TOKEN в файле .env!\n")

# Ваш личный Telegram ID от @userinfobot (указать в .env)
ADMIN_ID_RAW = os.getenv("ADMIN_ID", "0").strip()
try:
    ADMIN_ID = int(ADMIN_ID_RAW)
except ValueError:
    ADMIN_ID = 0

# Реквизиты для оплаты по карте/СБП
CARD_PAYMENT_DETAILS = os.getenv(
    "CARD_PAYMENT_DETAILS",
    "Сбербанк / Т-Банк: +7 (900) 000-00-00 (Иван И.)"
)
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN", "")

# Ссылка на веб-витрину Telegram Mini App
WEBAPP_URL = os.getenv(
    "WEBAPP_URL",
    "https://kristina9008u-maker.github.io/-/?v=20"
)

DATABASE_URL = os.getenv("DATABASE_URL")
