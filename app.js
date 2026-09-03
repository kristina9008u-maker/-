// Инициализация Telegram WebApp SDK
const tg = window.Telegram?.WebApp;

// --- ГЛОБАЛЬНЫЙ СБРОС (ВАЙП) ДАННЫХ КЛИЕНТОВ ---
const RESET_VERSION = "3.0"; // Смена версии приведет к полному сбросу у всех
if (localStorage.getItem('micro_reset_version') !== RESET_VERSION) {
    // Очищаем все данные приложения (история заказов, прогресс, сохраненные адреса)
    localStorage.removeItem('micro_orders_history');
    localStorage.removeItem('micro_orders_count');
    localStorage.removeItem('micro_trays_count');
    localStorage.removeItem('micro_phone');
    localStorage.removeItem('micro_address');
    localStorage.removeItem('micro_street');
    localStorage.removeItem('micro_house');
    localStorage.removeItem('micro_apt');
    localStorage.removeItem('micro_user_name');
    localStorage.removeItem('micro_photo_url');
    localStorage.setItem('micro_reset_version', RESET_VERSION);
    console.log("🔥 Выполнен полный вайп базы на стороне клиента!");
}
// ----------------------------------------------

// Декодирование любых уровней URL-кодирования
function safeDecode(str) {
    if (!str) return '';
    let res = str;
    for (let i = 0; i < 3; i++) {
        if (res.includes('%')) {
            try { res = decodeURIComponent(res); } catch (e) {}
        }
    }
    return res;
}
// HTML-экранирование для защиты от XSS
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// Универсальная маска форматирования телефона
function formatPhoneNumber(value) {
    if (!value) return '';
    let digits = value.replace(/\D/g, '');
    
    if (digits.startsWith('7') || digits.startsWith('8')) {
        digits = digits.substring(1);
    }
    
    digits = digits.substring(0, 10);
    if (digits.length === 0) return '';
    
    let res = '+7 (';
    if (digits.length > 0) {
        res += digits.substring(0, 3);
    }
    if (digits.length >= 3) {
        res += ') ' + digits.substring(3, 6);
    }
    if (digits.length >= 6) {
        res += '-' + digits.substring(6, 8);
    }
    if (digits.length >= 8) {
        res += '-' + digits.substring(8, 10);
    }
    return res;
}
// Прямой парсер хэша Telegram Mini App (#tgWebAppData=...)
function getTelegramUser() {
    if (tg?.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user;
        if (u.first_name || u.username || u.id) return u;
    }
    if (window.TelegramDataUnsafe?.user) {
        return window.TelegramDataUnsafe.user;
    }
    try {
        const hash = window.location.hash || window.location.search || '';
        if (hash) {
            const decoded = safeDecode(hash);
            
            const match = decoded.match(/user=({.*?})/);
            if (match && match[1]) {
                const parsed = JSON.parse(match[1]);
                if (parsed && (parsed.first_name || parsed.username || parsed.id)) {
                    return parsed;
                }
            }
            const params = new URLSearchParams(decoded.replace(/^[#?]/, ''));
            const webAppData = params.get('tgWebAppData') || params.get('initData');
            if (webAppData) {
                const innerDecoded = safeDecode(webAppData);
                const innerParams = new URLSearchParams(innerDecoded);
                const userStr = innerParams.get('user');
                if (userStr) {
                    const parsed = JSON.parse(safeDecode(userStr));
                    if (parsed) return parsed;
                }
            }
        }
    } catch (e) {
        console.error('Hash decode error:', e);
    }
    try {
        const searchParams = new URLSearchParams(window.location.search);
        const uUsername = searchParams.get('username');
        const uName = searchParams.get('name');
        const uId = searchParams.get('id');
        const uPhoto = searchParams.get('photo');
        if (uUsername || uName || uId) {
            return {
                first_name: uName || uUsername || 'Покупатель',
                username: uUsername || '',
                id: uId || '',
                photo_url: uPhoto || ''
            };
        }
    } catch (e) {}
    const savedName = localStorage.getItem('micro_user_name');
    if (savedName) {
        return { first_name: savedName };
    }
    return null;
}

// =================== MMORPG СИСТЕМА РАНГОВ ===================
const RANKS = [
    { minOrders: 0,  name: '🌰 Зёрнышко',         subtitle: 'Новичок',      cssClass: 'rank-seed',    nextAt: 1   },
    { minOrders: 1,  name: '🌱 Росток',            subtitle: 'Первые шаги',  cssClass: 'rank-sprout',  nextAt: 3   },
    { minOrders: 3,  name: '🌿 Эко-Ценитель',      subtitle: 'Постоянный',   cssClass: 'rank-eco',     nextAt: 6   },
    { minOrders: 6,  name: '🍀 Зелёный Гурман',    subtitle: 'Опытный',      cssClass: 'rank-gourmet', nextAt: 11  },
    { minOrders: 11, name: '🌳 Мастер Урожая',     subtitle: 'Продвинутый',  cssClass: 'rank-master',  nextAt: 21  },
    { minOrders: 21, name: '🏆 Легенда Фермы',     subtitle: 'Элита',        cssClass: 'rank-legend',  nextAt: 51  },
    { minOrders: 51, name: '👑 Зелёный Император',  subtitle: 'Максимум!',    cssClass: 'rank-emperor', nextAt: null }
];

function getRankInfo(ordersCount) {
    let rank = RANKS[0];
    for (let i = RANKS.length - 1; i >= 0; i--) {
        if (ordersCount >= RANKS[i].minOrders) {
            rank = RANKS[i];
            break;
        }
    }
    // Прогресс до следующего ранга
    let progressPercent = 100;
    let ordersToNext = 0;
    let nextRankName = null;
    if (rank.nextAt !== null) {
        const rangeStart = rank.minOrders;
        const rangeEnd = rank.nextAt;
        const progressInRange = ordersCount - rangeStart;
        const totalRange = rangeEnd - rangeStart;
        progressPercent = Math.min(100, Math.round((progressInRange / totalRange) * 100));
        ordersToNext = rangeEnd - ordersCount;
        // Найти следующий ранг
        const nextIdx = RANKS.indexOf(rank) + 1;
        if (nextIdx < RANKS.length) {
            nextRankName = RANKS[nextIdx].name;
        }
    }
    return { rank, progressPercent, ordersToNext, nextRankName };
}

function updateRankUI(ordersCount) {
    const { rank, progressPercent, ordersToNext, nextRankName } = getRankInfo(ordersCount);
    
    const badgeEl = document.getElementById('rank-badge');
    const fillEl = document.getElementById('rank-progress-fill');
    const textEl = document.getElementById('rank-progress-text');
    const containerEl = document.getElementById('rank-progress-container');
    
    if (badgeEl) {
        badgeEl.textContent = `${rank.name} — ${rank.subtitle}`;
        // Убираем все rank- классы и добавляем текущий
        badgeEl.className = 'status-badge';
        badgeEl.classList.add(rank.cssClass);
    }
    
    if (fillEl) {
        fillEl.style.width = `${progressPercent}%`;
    }
    
    if (textEl) {
        if (rank.nextAt === null) {
            textEl.textContent = '🎊 Максимальный ранг достигнут!';
        } else {
            const orderWord = getOrderWord(ordersToNext);
            textEl.textContent = `До «${nextRankName}»: ещё ${ordersToNext} ${orderWord}`;
        }
    }
}

function getOrderWord(n) {
    const abs = Math.abs(n) % 100;
    const lastDigit = abs % 10;
    if (abs >= 11 && abs <= 19) return 'заказов';
    if (lastDigit === 1) return 'заказ';
    if (lastDigit >= 2 && lastDigit <= 4) return 'заказа';
    return 'заказов';
}

// =================== СИНХРОНИЗАЦИЯ СТАТУСОВ ЗАКАЗОВ ===================
function processUrlSyncParams() {
    try {
        const searchParams = new URLSearchParams(window.location.search);
        const localIdFromUrl = searchParams.get('local_id');
        
        // 0. Сохраняем фото профиля из URL параметра (передаётся ботом)
        const photoFromUrl = searchParams.get('photo');
        if (photoFromUrl) {
            localStorage.setItem('micro_photo_url', photoFromUrl);
        }
        
        // 1. Привязка реального ID заказа к локальному (после оформления)
        const syncOrderId = searchParams.get('sync_order_id');
        if (syncOrderId && localIdFromUrl) {
            const historyJSON = localStorage.getItem('micro_orders_history');
            if (historyJSON) {
                let history = JSON.parse(historyJSON);
                const localIdNum = parseInt(localIdFromUrl);
                const realId = parseInt(syncOrderId);
                const order = history.find(o => o.id === localIdNum || o.id === String(localIdNum));
                if (order) {
                    order.real_id = realId;
                    localStorage.setItem('micro_orders_history', JSON.stringify(history));
                    console.log(`Sync: local #${localIdFromUrl} → real #${syncOrderId}`);
                }
            }
        }
        
        // 2. Обновление статуса заказа
        const orderUpdate = searchParams.get('order_update');
        if (orderUpdate) {
            const colonIdx = orderUpdate.indexOf(':');
            if (colonIdx > 0) {
                const updateOrderId = parseInt(orderUpdate.substring(0, colonIdx));
                const newStatus = orderUpdate.substring(colonIdx + 1);
                
                const historyJSON = localStorage.getItem('micro_orders_history');
                if (historyJSON) {
                    let history = JSON.parse(historyJSON);
                    
                    // Ищем заказ: сначала по real_id, потом по local_id из URL, потом по id
                    let order = history.find(o => o.real_id === updateOrderId);
                    if (!order && localIdFromUrl) {
                        const lid = parseInt(localIdFromUrl);
                        order = history.find(o => o.id === lid || o.id === String(lid));
                    }
                    if (!order) {
                        order = history.find(o => o.id === updateOrderId || o.id === String(updateOrderId));
                    }
                    // Последний шанс — берём самый последний заказ
                    if (!order && history.length > 0) {
                        order = history[history.length - 1];
                    }
                    
                    if (order) {
                        // Привязываем real_id если ещё не привязан
                        if (!order.real_id) {
                            order.real_id = updateOrderId;
                        }
                        // Маппинг статусов из бота в отображаемые
                        const statusMap = {
                            'Выращивается': '🌱 Выращивается',
                            'Принят': '✅ Принят',
                            'Всё выросло': '🌿 Всё выросло!',
                            'В пути': '🚚 В пути (передан курьеру)',
                            'Завершён': '🏁 Заказ завершён',
                            'Выполнен': '🎉 Выполнен',
                            'Отменен': '❌ Отменён'
                        };
                        order.status = statusMap[newStatus] || newStatus;
                        localStorage.setItem('micro_orders_history', JSON.stringify(history));
                        console.log(`Status updated: order #${updateOrderId} → ${newStatus}`);
                    }
                }
            }
        }
        
        // 3. Автоматически открыть профиль, если запрошено
        const openProfile = searchParams.get('open_profile');
        if (openProfile === '1') {
            setTimeout(() => {
                window.openProfileView();
            }, 300);
        }
    } catch (err) {
        console.error('URL sync error:', err);
    }
}

// Глобальные функции открытия и закрытия полноэкранных форм
window.openProfileView = function() {
    initProfile();
    const el = document.getElementById('view-profile');
    if (el) {
        el.classList.remove('hidden');
        el.style.display = 'flex';
        document.body.classList.add('modal-open');
    }
};
window.closeProfileView = function() {
    const el = document.getElementById('view-profile');
    if (el) {
        el.classList.add('hidden');
        el.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
};
window.openCartView = function() {
    const el = document.getElementById('view-cart');
    if (el) {
        el.classList.remove('hidden');
        el.style.display = 'flex';
        document.body.classList.add('modal-open');
    }
};
window.closeCartView = function() {
    const el = document.getElementById('view-cart');
    if (el) {
        el.classList.add('hidden');
        el.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
};
// Список товаров микрозелени с ВРЕМЕННЫМИ РАМКАМИ роста (growth_min и growth_max)
let INVENTORY = {};
const demoImages = [
    "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80",
    "https://images.unsplash.com/photo-1515589654513-3331002ec7bc?w=400&q=80",
    "https://images.unsplash.com/photo-1574316071802-0d684efa7ab5?w=400&q=80"
];
const PRODUCTS = [
    {"id": 1, "category": "spicy_herbs", "name": "Щавель \"красножильный\"", "price": 250, "weight": "1 лоток (10x15 см)", "growth_min": 40, "growth_max": 45, "img": "Images/zhyavel.jpg", "images": ["Images/zhyavel.jpg"], "description": "Не просто зелень, а самый настоящий вкусовой взрыв. Острая, пикантная кислинка, от которой мгновенно просыпаются вкусовые рецепторы.\n\nИдеально для:\n✨ Салатов и сэндвичей\n✨ Украшения супов и сырных тарелок\n\nКисло и сочно🤩"},
    {"id": 2, "category": "spicy_herbs", "name": "Мелиса \"Ароматный лимон\"", "price": 250, "weight": "1 лоток (10x15 см)", "growth_min": 40, "growth_max": 45, "img": "Images/limon1.jpg", "images": ["Images/limon1.jpg", "Images/limon2.jpg", "Images/limon3.jpg"], "description": "Освежающий лимонно-мятный бриз на вашей тарелке! Нежный аромат и легкая сладость.\n\nИдеально для:\n✨ Домашних лимонадов и чая\n✨ Украшения десертов и выпечки\n\nСвежо и сладко🍋"},
    {"id": 3, "category": "spicy_herbs", "name": "Мелиса \"Турецкая\"", "price": 250, "weight": "1 лоток (10x15 см)", "growth_min": 40, "growth_max": 45, "img": "Images/turkey1.jpeg", "images": ["Images/turkey1.jpeg", "Images/turkey2.jpeg"], "description": "Восточная сказка с прохладными мятными нотками. Успокаивает и придает блюдам неповторимый шарм.\n\nИдеально для:\n✨ Напитков и коктейлей\n✨ Фруктовых салатов\n\nАроматно и свежо🌱"},
    {"id": 4, "category": "spicy_herbs", "name": "Базилик \"Зеленый - генуэзский\"", "price": 250, "weight": "1 лоток (10x15 см)", "growth_min": 40, "growth_max": 45, "img": "Images/genyess1.jpg", "images": ["Images/genyess1.jpg", "Images/genyess2.jpg", "Images/genyess3.jpg"], "description": "Классика итальянской кухни в миниатюре! Тот самый сладковато-пряный вкус, который мы все так любим.\n\nИдеально для:\n✨ Пиццы и пасты\n✨ Капрезе и брускетт\n\nЯрко и пряно🍕"},
    {"id": 5, "category": "spicy_herbs", "name": "Базилик \"Маргарет\"", "price": 250, "weight": "1 лоток (10x15 см)", "growth_min": 40, "growth_max": 45, "img": "Images/margaret1.jpg", "images": ["Images/margaret1.jpg", "Images/margaret2.jpg"], "description": "Сладкий, насыщенный и невероятно ароматный. Настоящая находка для гурманов!\n\nИдеально для:\n✨ Мясных блюд\n✨ Соусов и маринадов\n\nСочно и вкусно🥩"},
    {"id": 6, "category": "spicy_herbs", "name": "Базилик \"Итальянский лимонный\"", "price": 250, "weight": "1 лоток (10x15 см)", "growth_min": 40, "growth_max": 45, "img": "Images/italia1.jpg", "images": ["Images/italia1.jpg", "Images/italia2.jpg"], "description": "Микс пряного базилика и яркой цитрусовой цедры. Необычное сочетание, которое удивляет!\n\nИдеально для:\n✨ Запеченной рыбы и морепродуктов\n✨ Летних салатов\n\nДерзко и цитрусово🐟"},
    {"id": 7, "category": "spicy_herbs", "name": "Базилик \"Красный рубин\"", "price": 150, "weight": "1 лоток (10x15 см)", "growth_min": 10, "growth_max": 15, "img": "Images/rubin1.jpg", "images": ["Images/rubin1.jpg", "Images/rubin2.jpg", "Images/rubin3.jpg", "Images/rubin4.jpg"], "description": "Роскошный темно-бордовый цвет и легкая гвоздичная остринка. Блюда с ним выглядят как из ресторана!\n\nИдеально для:\n✨ Эстетичной подачи блюд\n✨ Свежих салатов\n\nКрасиво и пикантно🍷"},
    {"id": 8, "category": "spicy_herbs", "name": "Кинза", "price": 180, "weight": "1 лоток (10x15 см)", "growth_min": 25, "growth_max": 30, "img": "Images/kinza1.jpg", "images": ["Images/kinza1.jpg"], "description": "Яркий, узнаваемый и дерзкий вкус кориандра! Только самые нежные и сочные листочки без жестких стеблей.\n\nИдеально для:\n✨ Мяса и шашлыков\n✨ Тако, супов и азиатских блюд\n\nПряно и насыщенно🌮"},
    {"id": 9, "category": "spicy_herbs", "name": "Руккола", "price": 150, "weight": "1 лоток (10x15 см)", "growth_min": 7, "growth_max": 9, "img": "Images/ryccola1.jpg", "images": ["Images/ryccola1.jpg"], "description": "Королева салатов! Благородный орехово-горчичный вкус с приятной пикантной ноткой.\n\nИдеально для:\n✨ Салатов с черри и пармезаном\n✨ Пиццы и брускетт\n\nХрустяще и пикантно🥗"},
    {"id": 10, "category": "salads", "name": "Салат \"Вишневая дымка - мини\"", "price": 250, "weight": "1 лоток (10x15 см)", "growth_min": 40, "growth_max": 45, "img": "Images/dimka1.jpg", "images": ["Images/dimka1.jpg", "Images/dimka2.jpg"], "description": "Нежнейшие хрустящие листочки с мягким вкусом. Идеальная база для любого блюда!\n\nИдеально для:\n✨ Легких салатов\n✨ Сэндвичей и бургеров\n\nСвежо и хрустяще🥪"},
    {"id": 11, "category": "salads", "name": "Салат \"Американский коричневый кудрявый\"", "price": 250, "weight": "1 лоток (10x15 см)", "growth_min": 40, "growth_max": 45, "img": "Images/american1.jpg", "images": ["Images/american1.jpg", "Images/american2.jpg", "Images/american3.jpg", "Images/american4.jpg"], "description": "Легкий ореховый оттенок и сочный хруст. Красивые резные листочки, которые так и просятся в тарелку!\n\nИдеально для:\n✨ Овощных боулов\n✨ Закусок\n\nНежно и сочно🥑"},
    {"id": 12, "category": "salads", "name": "Капуста \"Мизуна\"", "price": 180, "weight": "1 лоток (10x15 см)", "growth_min": 10, "growth_max": 15, "img": "Images/mizuna1.jpg", "images": ["Images/mizuna1.jpg", "Images/mizuna2.jpg", "Images/mizuma3.jpg", "Images/mizuna4.jpg"], "description": "Японская гостья с легкой, едва уловимой перечной остринкой.\n\nИдеально для:\n✨ Салатов и поке\n✨ Морепродуктов и суши\n\nХрустяще и необычно🍱"},
    {"id": 13, "category": "salads", "name": "Кресс - салат \"Кучерявый\"", "price": 130, "weight": "1 лоток (10x15 см)", "growth_min": 7, "growth_max": 9, "img": "Images/kecher1.jpg", "images": ["Images/kecher1.jpg", "Images/kecher2.jpg"], "description": "Бодрящая микрозелень с приятной горчичной остринкой! Заряжает витаминами и вкусом.\n\nИдеально для:\n✨ Мясных блюд\n✨ Бутербродов с творожным сыром\n\nОстро и витаминно🔥"},
    {"id": 14, "category": "salads", "name": "Кресс - салат \"Крупнолистовой\"", "price": 130, "weight": "1 лоток (10x15 см)", "growth_min": 7, "growth_max": 9, "img": "Images/krupnolist1.jpg", "images": ["Images/krupnolist1.jpg", "Images/krupnolist2.jpg"], "description": "Сочные листочки с выраженным пряно-перечным вкусом. Настоящий суперфуд на вашем столе!\n\nИдеально для:\n✨ Омлетов и яичниц\n✨ Овощных смузи\n\nПряно и полезно🍳"},
    {"id": 15, "category": "salads", "name": "Брокколи", "price": 130, "weight": "1 лоток (10x15 см)", "growth_min": 7, "growth_max": 9, "img": "Images/brok1.jpg", "images": ["Images/brok1.jpg", "Images/brok2.jpg", "Images/brok3.jpg", "Images/brok4.jpg"], "description": "Мягкий, землистый вкус капусты брокколи в нежной форме. Рекордсмен по содержанию витаминов и пользы!\n\nИдеально для:\n✨ Здоровых завтраков\n✨ Смузи и крем-супов\n\nПолезно и сочно🥦"},
    {"id": 16, "category": "salads", "name": "Кольраби \"Фиолетово - пурпурный\"", "price": 150, "weight": "1 лоток (10x15 см)", "growth_min": 7, "growth_max": 9, "img": "Images/kolrab1.jpg", "images": ["Images/kolrab1.jpg", "Images/kolrab2.jpg"], "description": "Сладковатый вкус молодой капусты и потрясающий фиолетовый цвет стебельков!\n\nИдеально для:\n✨ Украшения блюд\n✨ Хрустящих салатов\n\nЯрко и сладко💜"},
    {"id": 17, "category": "salads", "name": "Горчица красная \"Рэд леон\"", "price": 180, "weight": "1 лоток (10x15 см)", "growth_min": 10, "growth_max": 15, "img": "Images/RLeon1.jpg", "images": ["Images/RLeon1.jpg"], "description": "Настоящий огонь! Резкая, жгучая горчичная пикантность и роскошные красные листочки.\n\nИдеально для:\n✨ Стейков и бургеров\n✨ Острых соусов\n\nОстро и мощно🍔"},
    {"id": 18, "category": "salads", "name": "Горчица салатная \"Веснушка\"", "price": 180, "weight": "1 лоток (10x15 см)", "growth_min": 10, "growth_max": 15, "img": "Images/vesnyh1.jpg", "images": ["Images/vesnyh1.jpg"], "description": "Приятная, согревающая пикантность без лишней жгучести. Мгновенно пробуждает аппетит!\n\nИдеально для:\n✨ Сэндвичей с ветчиной\n✨ Холодных закусок\n\nПикантно и вкусно🥪"},
    {"id": 19, "category": "classic", "name": "Редис \"Санго\"", "price": 150, "weight": "1 лоток (10x15 см)", "growth_min": 7, "growth_max": 9, "img": "Images/sango1.jpg", "images": ["Images/sango1.jpg", "Images/sango2.jpg"], "description": "Глубокий пурпурный цвет и тот самый сочный, островатый вкус свежей редиски!\n\nИдеально для:\n✨ Мяса и гарниров\n✨ Ярких салатов\n\nСочно и с остринкой🥩"},
    {"id": 20, "category": "classic", "name": "Редис \"Ред коралл\"", "price": 150, "weight": "1 лоток (10x15 см)", "growth_min": 7, "growth_max": 9, "img": "Images/koral1.jpg", "images": ["Images/koral1.jpg", "Images/koral2.jpg", "Images/koral3.jpg"], "description": "Ярко-розовые стебельки и зеленые листочки. Хрустящая текстура и свежий вкус с приятной жгучестью.\n\nИдеально для:\n✨ Украшения любых блюд\n✨ Завтраков с яйцом пашот\n\nЯрко и хрустяще🍳"},
    {"id": 21, "category": "classic", "name": "Амарант \"Пэшн\"", "price": 250, "weight": "1 лоток (10x15 см)", "growth_min": 40, "growth_max": 45, "img": "Images/pehn1.jpg", "images": ["Images/pehn1.jpg"], "description": "Визуальный шедевр! Невероятный цвет фуксии и легкий свежий, свекольно-землистый вкус.\n\nИдеально для:\n✨ Ресторанной подачи блюд\n✨ Украшения десертов и салатов\n\nСтильно и нежно🌸"},
    {"id": 22, "category": "classic", "name": "Амарант \"Легенда\"", "price": 150, "weight": "1 лоток (10x15 см)", "growth_min": 7, "growth_max": 9, "img": "Images/amarant1.jpg", "images": ["Images/amarant1.jpg", "Images/amarant2.jpg", "Images/amarant3.jpg"], "description": "Утонченные красные листочки с мягким вкусом. Добавит роскоши и цвета в любую тарелку!\n\nИдеально для:\n✨ Праздничных блюд\n✨ Закусок с морепродуктами\n\nКрасиво и эстетично✨"},
    {"id": 23, "category": "classic", "name": "Горох \"Элита\"", "price": 150, "weight": "1 лоток (10x15 см)", "growth_min": 10, "growth_max": 13, "img": "Images/gor1.jpg", "images": ["Images/gor1.jpg", "Images/gor2.jpg", "Images/gor3.jpg"], "description": "Сладкий, невероятно хрустящий и сочный! По вкусу — как молодой зеленый горошек прямо с грядки. Любимец детей!\n\nИдеально для:\n✨ Салатов и гарниров\n✨ Хрустеть просто так\n\nСладко и сочно🫛"},
    {"id": 24, "category": "classic", "name": "Подсолнечник", "price": 150, "weight": "1 лоток (10x15 см)", "growth_min": 10, "growth_max": 13, "img": "Images/Pod1.jpg", "images": ["Images/Pod1.jpg", "Images/Pod2.jpg", "Images/Pod3.jpg", "Images/Pod4.jpg"], "description": "Плотные, мясистые листочки с ярким ореховым вкусом свежих семечек! Очень сытно и вкусно.\n\nИдеально для:\n✨ Овощных салатов\n✨ Тостов с авокадо\n\nОрехово и сытно🌻"},
];
let cart = {};
let currentCategory = 'all';
let isSubmitting = false;
window.appliedPromo = null;

// Динамический расчёт МИНИМАЛЬНОЙ даты готовности заказа (по growth_min)
function setupDatePicker() {
    const delDateInput = document.getElementById('del-date');
    const growthHintEl = document.getElementById('growth-hint');
    if (!delDateInput) return;
    
    let maxMinDays = 0;
    let hasInstock = false;
    let maxGrowingDays = 0;
    
    Object.keys(cart).forEach(id => {
        const qty = cart[id] || 0;
        const p = PRODUCTS.find(prod => prod.id == id);
        if (p) {
            if (p.category === 'instock') hasInstock = true;
            
            let actualGrowthMin = p.growth_min || 0;
            if (p.category === 'instock' && qty > p.stock_qty) {
                const originalId = String(id).replace('stock_', '');
                const originalP = PRODUCTS.find(prod => prod.id == originalId);
                if (originalP && originalP.growth_min) {
                    actualGrowthMin = originalP.growth_min;
                }
            } else if (p.category !== 'instock' && actualGrowthMin === 0 && p.id) {
                 actualGrowthMin = p.growth_min || 1; // fallback
            }
            
            if (actualGrowthMin > maxGrowingDays) {
                maxGrowingDays = actualGrowthMin;
            }
        }
    });
    
    // Если в корзине есть ХОТЯ БЫ ОДИН товар из наличия, разрешаем выбрать сегодняшнюю дату (0 дней)!
    if (hasInstock) {
        maxMinDays = 0;
    } else {
        maxMinDays = maxGrowingDays;
    }
    
    window.maxGrowingDaysForCheckout = maxGrowingDays; // Сохраняем для отправки заказа
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + maxMinDays);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const minStr = `${yyyy}-${mm}-${dd}`;
    delDateInput.min = minStr;
    if (!delDateInput.value || delDateInput.value < minStr) {
        delDateInput.value = minStr;
    }
    if (growthHintEl) {
        const monthNames = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
        const formattedMinDate = `${targetDate.getDate()} ${monthNames[targetDate.getMonth()]}`;
        
        growthHintEl.innerHTML = `🌱 Минимальный срок выращивания заказа: <strong>${maxMinDays} дн.</strong><br>Ближайшая возможная дата готовности: <strong>${formattedMinDate}</strong>`;
    }
}
async function initProfile() {
    try {
        const nameEl = document.getElementById('user-full-name');
        const usernameEl = document.getElementById('user-username');
        const avatarEl = document.getElementById('user-avatar');
        const topAvatarEl = document.getElementById('top-avatar-img');
        const phoneEl = document.getElementById('saved-phone');
        const addressEl = document.getElementById('saved-address');
        
        let fullName = '';
        let userHandle = '';
        let avatarSrc = '';
        let userId = null;
        
        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
            const u = tg.initDataUnsafe.user;
            userId = u.id;
            if (u.first_name || u.last_name) {
                fullName = [u.first_name, u.last_name].filter(Boolean).join(' ');
            } else {
                fullName = 'Покупатель';
            }
            if (u.username) {
                userHandle = u.username.startsWith('@') ? u.username : `@${u.username}`;
            } else if (u.id) {
                userHandle = `ID: ${u.id}`;
            } else {
                userHandle = '@telegram_user';
            }
            if (u.photo_url) {
                avatarSrc = u.photo_url;
                localStorage.setItem('micro_photo_url', u.photo_url);
            } else {
                const savedPhoto = localStorage.getItem('micro_photo_url');
                avatarSrc = savedPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'User')}&background=2e7d32&color=fff&size=200&font-size=0.4`;
            }
        } else {
            fullName = 'Покупатель';
            userHandle = '@telegram_user';
            const savedPhoto = localStorage.getItem('micro_photo_url');
            avatarSrc = savedPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=2e7d32&color=fff&size=200`;
        }
        
        if (nameEl) nameEl.textContent = fullName;
        if (usernameEl) usernameEl.textContent = userHandle;
        if (avatarEl) avatarEl.src = avatarSrc;
        if (topAvatarEl) topAvatarEl.src = avatarSrc;
        
        const custNameInput = document.getElementById('cust-name');
        if (custNameInput && fullName !== 'Покупатель') {
            custNameInput.value = fullName;
        }
        
        const savedPhone = localStorage.getItem('micro_phone');
        const savedAddress = localStorage.getItem('micro_address');
        // Восстанавливаем раздельные поля адреса
        const savedStreet = localStorage.getItem('micro_street');
        const savedHouse = localStorage.getItem('micro_house');
        const savedApt = localStorage.getItem('micro_apt');
        const streetInput = document.getElementById('cust-street');
        const houseInput = document.getElementById('cust-house');
        const aptInput = document.getElementById('cust-apt');
        if (savedStreet && streetInput) streetInput.value = savedStreet;
        if (savedHouse && houseInput) houseInput.value = savedHouse;
        if (savedApt && aptInput) aptInput.value = savedApt;
        // Fetch real stats from server
        if (userId) {
            try {
                const resp = await fetch(`https://microleaf-oe4o.onrender.com/api/profile?user_id=${userId}`);
                const data = await resp.json();
                if (data.success) {
                    localStorage.setItem('micro_orders_count', data.data.orders_count);
                    localStorage.setItem('micro_orders_history', JSON.stringify(data.data.recent_orders.reverse()));
                }
            } catch (e) {
                console.error("Failed to fetch profile from server", e);
            }
        }
        
        const ordersCount = parseInt(localStorage.getItem('micro_orders_count') || '0');
        const traysCount = localStorage.getItem('micro_trays_count') || '0';
        
        const statOrd = document.getElementById('stat-orders-count');
        if (statOrd) statOrd.textContent = ordersCount;
        
        const statTr = document.getElementById('stat-trays-count');
        if (statTr) statTr.textContent = traysCount;
        
        // Обновление MMORPG ранга
        updateRankUI(ordersCount);
        
        renderOrderHistory();
    } catch (err) {
        console.error('Profile init error:', err);
    }
}
function renderOrderHistory() {
    try {
        const container = document.getElementById('orders-history-container');
        if (!container) return;
        const historyJSON = localStorage.getItem('micro_orders_history');
        if (!historyJSON) {
            container.innerHTML = '<p style="font-size: 12px; color: var(--hint-color); text-align: center; padding: 12px;">История заказов пока пуста.<br>Оформите свой первый заказ в каталоге! 🌱</p>';
            return;
        }
        const orders = JSON.parse(historyJSON);
        container.innerHTML = '';
        orders.slice().reverse().forEach(order => {
            const card = document.createElement('div');
            card.className = 'order-history-card';
            
            let statusClass = 'status-processing';
            const st = order.status || '';
            if (st.includes('Выращивается') || st.includes('Готовится')) statusClass = 'status-growing';
            else if (st.includes('Выполняется') || st.includes('Принят')) statusClass = 'status-in-progress';
            else if (st.includes('доставку') || st.includes('пути')) statusClass = 'status-delivering';
            else if (st.includes('Выполнен') || st.includes('Получен') || st.includes('выросло') || st.includes('завершён') || st.includes('Завершён')) statusClass = 'status-completed';
            else if (st.includes('Отменён') || st.includes('Отменен')) statusClass = 'status-cancelled';
            
            // Показываем реальный ID если есть, иначе локальный
            const displayId = order.real_id || order.id;
            let clientItemsMap = {};
            (order.items || []).forEach(i => {
                let cleanName = i.name.replace(' (УЖЕ ВЫРОСЛО)', '').replace(' (НА ДОСАДКУ)', '');
                clientItemsMap[cleanName] = (clientItemsMap[cleanName] || 0) + i.quantity;
            });
            let itemsTextArr = [];
            for (let name in clientItemsMap) {
                itemsTextArr.push(`${name} x${clientItemsMap[name]}`);
            }
            let itemsText = itemsTextArr.join(', ');
            card.innerHTML = `
                <div class="order-card-header">
                    <span class="order-id-title">Заказ #${escapeHtml(String(displayId))}</span>
                    <span class="order-date">${escapeHtml(order.date)}</span>
                </div>
                <div>
                    <span class="order-status-tag ${statusClass}">${escapeHtml(st)}</span>
                </div>
                <div class="order-items-list">📦 ${escapeHtml(itemsText)}</div>
                <div class="order-total-price">💰 ${escapeHtml(String(order.total_price))} ₽</div>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error('Order history error:', err);
    }
}
function handleSearch() {
    renderCatalog(document.querySelector('.cat-btn.active').dataset.category);
}

function toggleFavorite(event, productId) {
    event.stopPropagation();
    // Convert productId to number because PRODUCTS uses integer IDs
    const idNum = Number(productId);
    let favs = JSON.parse(localStorage.getItem('micro_favorites') || '[]').map(Number);
    if (favs.includes(idNum)) {
        favs = favs.filter(id => id !== idNum);
    } else {
        favs.push(idNum);
    }
    localStorage.setItem('micro_favorites', JSON.stringify(favs));
    renderCatalog(document.querySelector('.cat-btn.active').dataset.category);
}

function renderCatalog(category = 'all') {
    try {
        const catalogContainer = document.getElementById('catalog-container');
        if (!catalogContainer) return;
        catalogContainer.innerHTML = '';
        
        const searchQuery = (document.getElementById('search-input') ? document.getElementById('search-input').value.toLowerCase() : '');
        const favs = JSON.parse(localStorage.getItem('micro_favorites') || '[]').map(Number);
        
        let filtered = PRODUCTS;
        if (category === 'favorites') {
            filtered = filtered.filter(p => favs.includes(p.id));
        } else if (category !== 'all') {
            filtered = filtered.filter(p => p.category === category);
        }
        
        if (searchQuery) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(searchQuery));
        }
        
        if (filtered.length === 0) {
            catalogContainer.innerHTML = '<p style="text-align: center; color: var(--hint-color); padding: 20px; grid-column: 1/-1;">Ничего не найдено 😔</p>';
            return;
        }
        
        filtered.forEach(p => {
            const qty = cart[p.id] || 0;
            const card = document.createElement('div');
            card.className = 'product-card';
            card.style.position = 'relative';
            
            const isFav = favs.includes(p.id);
            const favIcon = isFav ? '❤️' : '🤍';
            
            let growthText = p.growth_min === p.growth_max ? `${p.growth_min} дн.` : `${p.growth_min}—${p.growth_max} дн.`;
            if (p.category === 'instock') {
                growthText = `🚀 Уже выросло (Остаток: ${p.stock_qty} шт.)`;
            } else {
                growthText = `🌱 Срок роста: ${growthText}`;
            }
            
            let imagesHtml = '';
            let dotsHtml = '';
            const images = p.images || [p.img];
            images.forEach((imgUrl, idx) => {
                imagesHtml += `<img class="product-img-slide" src="${imgUrl}" alt="${p.name}">`;
                dotsHtml += `<div class="gallery-dot ${idx === 0 ? 'active' : ''}"></div>`;
            });
            
            card.innerHTML = `
                <button class="btn-fav ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, '${p.id}')">${favIcon}</button>
                <div class="product-clickable-area" onclick="openProductModal('${p.id}')" style="cursor: pointer;">
                    <div class="product-gallery-container">
                        <div class="product-gallery" id="gallery-${p.id}" onscroll="updateGalleryDots('${p.id}')">
                            ${imagesHtml}
                        </div>
                        ${images.length > 1 ? `<div class="gallery-dots" id="dots-${p.id}">${dotsHtml}</div>` : ''}
                    </div>
                    <h3 class="product-title">${p.name}</h3>
                    <p class="product-weight">${p.weight}</p>
                    <p class="product-growth" ${p.category === 'instock' ? 'style="color:#d32f2f;font-weight:bold;font-size:12px;"' : ''}>${growthText}</p>
                    <p class="product-price">${p.price} ₽</p>
                </div>
                <div class="product-actions">
                    ${qty === 0 ? `
                        <button class="btn-add" onclick="updateQty('${p.id}', 1)">+ Добавить</button>
                    ` : `
                        <div class="qty-control">
                            <button class="btn-qty" onclick="updateQty('${p.id}', ${qty - 1})">-</button>
                            <span class="qty-num">${qty} шт</span>
                            <button class="btn-qty" onclick="updateQty('${p.id}', ${qty + 1})">+</button>
                        </div>
                    `}
                </div>
            `;
            catalogContainer.appendChild(card);
        });
    } catch (err) {
        console.error('Catalog render error:', err);
    }
}
window.updateQty = function(id, qty) {
    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
    
    if (qty > 99) {
        if (tg && tg.showAlert) {
            tg.showAlert('Максимальное количество: 99 шт.');
        }
        return;
    }
    
    const p = PRODUCTS.find(prod => prod.id == id);
    if (p && p.category === 'instock') {
        const currentQty = cart[id] || 0;
        if (qty === p.stock_qty + 1 && currentQty === p.stock_qty) {
//             if(tg && tg.showAlert) { tg.showAlert(`В наличии сейчас только ${p.stock_qty} шт.\n\nВы можете заказать больше, но всё, что свыше этого количества, нужно будет подождать (потребуется время на выращивание).`); } else { alert(`В наличии сейчас только ${p.stock_qty} шт.\n\nВы можете заказать больше, но всё, что свыше этого количества, нужно будет подождать (потребуется время на выращивание).`); }
        }
    }
    
    if (qty <= 0) {
        delete cart[id];
    } else {
        cart[id] = qty;
    }
    updateCartUI();
    const activeCat = document.querySelector('.cat-btn.active')?.dataset.category || 'all';
    renderCatalog(activeCat);
};
window.updateGalleryDots = function(id) {
    const gallery = document.getElementById(`gallery-${id}`);
    const dotsContainer = document.getElementById(`dots-${id}`);
    if (!gallery || !dotsContainer) return;
    
    // Calculate the index of the currently visible image
    const scrollLeft = gallery.scrollLeft;
    const width = gallery.clientWidth;
    const index = Math.round(scrollLeft / width);
    
    // Update dots
    const dots = dotsContainer.children;
    for (let i = 0; i < dots.length; i++) {
        if (i === index) {
            dots[i].classList.add('active');
        } else {
            dots[i].classList.remove('active');
        }
    }
};
function updateCartUI() {
    let totalItems = 0;
    let totalPrice = 0;
    Object.keys(cart).forEach(id => {
        const p = PRODUCTS.find(prod => prod.id == id);
        if (p) {
            const count = cart[id];
            totalItems += count;
            totalPrice += p.price * count;
        }
    });
    const topBadge = document.getElementById('top-cart-badge');
    if (topBadge) {
        if (totalItems > 0) {
            topBadge.textContent = totalItems;
            topBadge.classList.remove('hidden');
        } else {
            topBadge.classList.add('hidden');
        }
    }
    const cartBar = document.getElementById('cart-bar');
    if (cartBar) {
        if (totalItems > 0) {
            document.getElementById('cart-count').textContent = `${totalItems} товаров`;
            document.getElementById('cart-total').textContent = `${totalPrice} ₽`;
            cartBar.classList.remove('hidden');
        } else {
            cartBar.classList.add('hidden');
        }
    }
    renderCartPage(totalItems, totalPrice);
    if (typeof syncCart === 'function') syncCart();
}
function renderCartPage(totalItems, totalPrice) {
    const container = document.getElementById('cart-items-container');
    const totalBox = document.getElementById('cart-total-box');
    if (!container) return;
    container.innerHTML = '';
    if (totalItems === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--hint-color); margin-top: 40px; font-size: 14px;">🛒 Ваша корзина пока пуста.<br>Выберите товары в каталоге!</p>';
        if (totalBox) totalBox.classList.add('hidden');
        return;
    }
    if (totalBox) totalBox.classList.remove('hidden');
    const pageTotal = document.getElementById('cart-page-total');
    if (pageTotal) pageTotal.textContent = `${totalPrice} ₽`;
    Object.keys(cart).forEach(id => {
        const p = PRODUCTS.find(prod => prod.id == id);
        if (p) {
            const row = document.createElement('div');
            row.className = 'cart-item-row';
            const rangeStr = p.growth_min === p.growth_max ? `${p.growth_min} дн.` : `${p.growth_min}–${p.growth_max} дн.`;
            row.innerHTML = `
                <div class="cart-item-info">
                    <h4>${p.name}</h4>
                    <p>${p.weight} • ⏱ ${rangeStr} • ${p.price} ₽</p>
                </div>
                <div class="qty-control" style="width: 100px;">
                    <button class="btn-qty" onclick="updateQty('${p.id}', ${cart[id] - 1})">-</button>
                    <span class="qty-num">${cart[id]} шт</span>
                    <button class="btn-qty" onclick="updateQty('${p.id}', ${cart[id] + 1})">+</button>
                </div>
            `;
            container.appendChild(row);
        }
    });
}
function initEvents() {
    const phoneInput = document.getElementById('cust-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            phoneInput.value = formatPhoneNumber(e.target.value);
        });
        phoneInput.addEventListener('focus', () => {
            if (!phoneInput.value) {
                phoneInput.value = '+7 (';
            }
        });
    }
    const btnPromo = document.getElementById('btn-apply-promo');
    if (btnPromo) {
        btnPromo.onclick = async () => {
            const codeInput = document.getElementById('promo-code');
            if (codeInput) {
                const code = codeInput.value.trim().toUpperCase();
                if (!code) return;
                
                try {
                    btnPromo.disabled = true;
                    const response = await fetch(`https://microleaf-oe4o.onrender.com/api/check_promo?code=${encodeURIComponent(code)}`);
                    const result = await response.json();
                    
                    if (result.valid) {
                        window.appliedPromo = code;
                        window.appliedPromoDiscount = result.discount;
                        if(tg && tg.showAlert) { tg.showAlert(`✅ Промокод ${code} применен! Скидка ${result.discount}% на все товары.`); } else { alert(`✅ Промокод ${code} применен! Скидка ${result.discount}% на все товары.`); }
                        updateModalSummary();
                    } else {
                        if(tg && tg.showAlert) { tg.showAlert(`❌ ${result.error || 'Неверный промокод'}`); } else { alert(`❌ ${result.error || 'Неверный промокод'}`); }
                        window.appliedPromo = '';
                        window.appliedPromoDiscount = 0;
                        updateModalSummary();
                    }
                } catch (e) {
                    if(tg && tg.showAlert) { tg.showAlert('❌ Ошибка проверки промокода. Проверьте интернет.'); } else { alert('❌ Ошибка проверки промокода.'); }
                } finally {
                    btnPromo.disabled = false;
                }
            }
        };
    }
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            renderCatalog(e.currentTarget.dataset.category);
        };
    });
    const delType = document.getElementById('del-type');
    const addrGrp = document.getElementById('address-group');
    if (delType) {
        const checkAddressRequirement = () => {
            const isDelivery = delType.value.includes('Доставка') || delType.value.includes('курьер');
            if (addrGrp) addrGrp.style.display = isDelivery ? 'block' : 'none';
            const streetInput = document.getElementById('cust-street');
            const houseInput = document.getElementById('cust-house');
            if (streetInput) streetInput.required = isDelivery;
            if (houseInput) houseInput.required = isDelivery;
            if (typeof updateModalSummary === 'function') updateModalSummary();
        };
        delType.onchange = checkAddressRequirement;
        checkAddressRequirement();
    }
    
    // Глобальный обработчик MainButton
    if (tg && tg.MainButton) {
        tg.MainButton.onClick(() => {
            if (document.activeElement) document.activeElement.blur();
            const modalEl = document.getElementById('checkout-modal');
            if (modalEl && !modalEl.classList.contains('hidden')) {
                triggerUpsellOrSubmit();
            }
        });
    }
    
    const btnCheckout1 = document.getElementById('btn-cart-checkout');
    if (btnCheckout1) {
        btnCheckout1.onclick = openCheckoutModal;
    }
    const btnCloseModal = document.getElementById('btn-close-modal');
    if (btnCloseModal) btnCloseModal.onclick = () => {
        document.getElementById('checkout-modal').classList.add('hidden');
        if (tg && tg.MainButton) tg.MainButton.hide();
    };
    const orderForm = document.getElementById('order-form');
    if (orderForm) {
        orderForm.onsubmit = (e) => {
            e.preventDefault();
            
            // Защита от двойного клика (двойных сообщений)
            const btnSubmit = orderForm.querySelector('button[type="submit"]');
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.textContent = "Отправка...";
            }
            
            const name = document.getElementById('cust-name').value.trim();
            const phone = document.getElementById('cust-phone').value.trim();
            if (phone.length < 18) {
                if(tg && tg.showAlert) { tg.showAlert('Пожалуйста, введите полный номер телефона в формате: +7 (965) 901-12-61'); } else { alert('Пожалуйста, введите полный номер телефона в формате: +7 (965) 901-12-61'); }
                return;
            }
            const dType = document.getElementById('del-type').value;
            const streetVal = (document.getElementById('cust-street')?.value || '').trim();
            const houseVal = (document.getElementById('cust-house')?.value || '').trim();
            const aptVal = (document.getElementById('cust-apt')?.value || '').trim();
            if (!dType.includes('Самовывоз')) {
                if (!streetVal || streetVal.length < 2) {
                    if(tg && tg.showAlert) { tg.showAlert('⚠️ Введите название улицы'); } else { alert('⚠️ Введите название улицы'); }
                    document.getElementById('cust-street')?.focus();
                    return;
                }
                if (!houseVal || !/\d/.test(houseVal)) {
                    if(tg && tg.showAlert) { tg.showAlert('⚠️ Введите номер дома'); } else { alert('⚠️ Введите номер дома'); }
                    document.getElementById('cust-house')?.focus();
                    return;
                }
            }
            let address;
            if (dType.includes('Самовывоз')) {
                address = 'Самовывоз (3 микрорайон дом 37)';
            } else {
                address = `ул. ${streetVal}, д. ${houseVal}`;
                if (aptVal) address += `, кв. ${aptVal}`;
            }
            
            const commentVal = (document.getElementById('order-comment')?.value || '').trim();
            if (commentVal) {
                address += ` | Комментарий: ${commentVal}`;
            }
            
            const rawDate = document.getElementById('del-date').value;
            const selectedTime = document.getElementById('del-time').value;
            let dateFormatted = rawDate;
            let deliveryIso = null;
            if (rawDate && rawDate.includes('-')) {
                const [y, m, d] = rawDate.split('-');
                const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
                dateFormatted = `${parseInt(d)} ${months[parseInt(m)-1]}`;
                if (selectedTime) {
                    const timeMatch = selectedTime.match(/(\d{2}:\d{2})/);
                    const extTime = timeMatch ? timeMatch[1] : "12:00";
                    deliveryIso = `${y}-${m}-${d}T${extTime}:00`;
                }
            }
            const delDateCombined = `${dateFormatted}, ${selectedTime}`;
            const payMethod = document.getElementById('pay-method').value;
            localStorage.setItem('micro_phone', phone);
            localStorage.setItem('micro_address', address);
            localStorage.setItem('micro_street', streetVal);
            localStorage.setItem('micro_house', houseVal);
            localStorage.setItem('micro_apt', aptVal);
            if (name) {
                localStorage.setItem('micro_user_name', name);
            }
            const isSubscription = document.getElementById('is-subscription')?.checked || false;
            let itemsArr = [];
            let productsTotal = 0;
            let totalTraysCount = 0;
            let hasInstock = false;
            let hasGrowing = false;
            
            Object.keys(cart).forEach(id => {
                const qty = cart[id];
                const p = PRODUCTS.find(prod => prod.id == id);
                if (p) {
                    if (p.category === 'instock' && qty > p.stock_qty) {
                        // Split into instock and growing
                        hasInstock = true;
                        hasGrowing = true;
                        
                        const sum1 = p.price * p.stock_qty;
                        productsTotal += sum1;
                        totalTraysCount += p.stock_qty;
                        itemsArr.push({ product_id: p.id, name: p.name, weight: p.weight, price: p.price, quantity: p.stock_qty, total: sum1 });
                        
                        const extraQty = qty - p.stock_qty;
                        const originalId = String(p.id).replace('stock_', '');
                        const origP = PRODUCTS.find(prod => prod.id == originalId);
                        if (origP) {
                            const sum2 = origP.price * extraQty;
                            productsTotal += sum2;
                            totalTraysCount += extraQty;
                            itemsArr.push({ product_id: origP.id, name: origP.name + ' (НА ДОСАДКУ)', weight: origP.weight, price: origP.price, quantity: extraQty, total: sum2 });
                        }
                    } else {
                        if (p.category === 'instock') hasInstock = true;
                        else hasGrowing = true;
                        
                        const sum = p.price * qty;
                        productsTotal += sum;
                        totalTraysCount += qty;
                        itemsArr.push({ product_id: p.id, name: p.name, weight: p.weight, price: p.price, quantity: qty, total: sum });
                    }
                }
            });
            
            let discount = 0;
            if (window.appliedPromo && window.appliedPromoDiscount > 0) {
                discount = Math.floor(productsTotal * (window.appliedPromoDiscount / 100));
                itemsArr.push({ product_id: 'promo', name: `Скидка по промокоду ${window.appliedPromo} (${window.appliedPromoDiscount}%)`, weight: '-', price: -discount, quantity: 1, total: -discount });
            }
            
            let totalPrice = productsTotal - discount;
            if (totalPrice < 0) totalPrice = 0;
            
            if (dType.includes('Доставк') || dType.includes('Курьер')) {
                if (totalPrice >= 390) {
                    itemsArr.push({ product_id: 'delivery', name: 'Доставка (курьер)', weight: '-', price: 0, quantity: 1, total: 0 });
                } else {
                    totalPrice += 100;
                    itemsArr.push({ product_id: 'delivery', name: 'Доставка (курьер)', weight: '-', price: 100, quantity: 1, total: 100 });
                }
            }
            
            if (isSubscription) {
                totalPrice = Math.round((totalPrice) * 4 * 0.9);
            }
            
            const currentOrdersCount = parseInt(localStorage.getItem('micro_orders_count') || '0') + 1;
            const currentTraysCount = parseInt(localStorage.getItem('micro_trays_count') || '0') + totalTraysCount;
            localStorage.setItem('micro_orders_count', currentOrdersCount);
            localStorage.setItem('micro_trays_count', currentTraysCount);
            
            
            let finalDeliveryDate = delDateCombined;
            if (hasInstock && hasGrowing) {
                const growingDays = window.maxGrowingDaysForCheckout || 0;
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + growingDays);
                const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
                const futureStr = `${futureDate.getDate()} ${months[futureDate.getMonth()]}`;
                
                finalDeliveryDate = `📦 Товары из наличия: ${delDateCombined} (выбранная дата).\n⏳ Остальное (сверх наличия): к ${futureStr} (${growingDays} дн.)`;
            } else if (hasInstock && !hasGrowing) {
                finalDeliveryDate = `${delDateCombined} (Товары из наличия)`;
            }

            const newOrder = {
                id: currentOrdersCount,
                date: new Date().toLocaleDateString('ru-RU'),
                status: "Новый",
                items: itemsArr,
                total_price: totalPrice,
                customer_name: name,
                phone: phone,
                delivery_type: dType,
                address: address,
                delivery_date: finalDeliveryDate,
                payment_method: payMethod,
                is_subscription: isSubscription,
                promo_code: window.appliedPromo || '',
                delivery_iso: typeof deliveryIso !== 'undefined' ? deliveryIso : ''
            };
            const historyJSON = localStorage.getItem('micro_orders_history');
            let history = historyJSON ? JSON.parse(historyJSON) : [];
            history.push(newOrder);
            localStorage.setItem('micro_orders_history', JSON.stringify(history));
            cart = {};
            updateCartUI();
            document.getElementById('checkout-modal').classList.add('hidden');
            window.closeCartView();
            const u = getTelegramUser();
            if (u && u.id) {
                newOrder.user_id = u.id;
                newOrder.username = u.username || '';
            }

            // Отправляем заказ на сервер
            const API_URL = "https://microleaf-oe4o.onrender.com/api/order"; // Облачный сервер (Render)
            
            fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': (tg && tg.initData) ? tg.initData : ''
                },
                body: JSON.stringify(newOrder)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (tg && tg.close) {
                        tg.close();
                    } else {
                        if(tg && tg.showAlert) { tg.showAlert(`Заказ #${data.order_id} успешно оформлен!`); } else { alert(`Заказ #${data.order_id} успешно оформлен!`); }
                    }
                } else {
                    if(tg && tg.showAlert) { tg.showAlert("Ошибка при оформлении заказа: " + data.error); } else { alert("Ошибка при оформлении заказа: " + data.error); }
                }
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = "Подтвердить заказ";
                }
                if (tg && tg.MainButton) {
                    tg.MainButton.hideProgress();
                    tg.MainButton.hide();
                }
            })
            .catch(error => {
                console.error('Ошибка API:', error);
                if(tg && tg.showAlert) { tg.showAlert("Не удалось связаться с сервером. Проверьте подключение или обратитесь к менеджеру."); } else { alert("Не удалось связаться с сервером. Проверьте подключение или обратитесь к менеджеру."); }
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = "Подтвердить заказ";
                }
                if (tg && tg.MainButton) tg.MainButton.hideProgress();
                // Открываем профиль, если сервер недоступен, чтобы юзер хотя бы увидел локальный заказ
                initProfile();
                window.openProfileView();
            });
            initProfile();
            window.openProfileView();
        };
    }
}
function updateModalSummary() {
    let summaryHTML = '<strong>Состав заказа:</strong><br>';
    let productsTotal = 0;
    let cartGroups = {};
    Object.keys(cart).forEach(id => {
        const p = PRODUCTS.find(prod => prod.id == id);
        if (p) {
            let cleanName = p.name.replace(' (УЖЕ ВЫРОСЛО)', '').replace(' (НА ДОСАДКУ)', '');
            const sum = p.price * cart[id];
            productsTotal += sum;
            if (!cartGroups[cleanName]) {
                cartGroups[cleanName] = { qty: 0, sum: 0 };
            }
            cartGroups[cleanName].qty += cart[id];
            cartGroups[cleanName].sum += sum;
        }
    });

    Object.keys(cartGroups).forEach(name => {
        const g = cartGroups[name];
        summaryHTML += `• ${name} x ${g.qty} шт. = ${g.sum} ₽<br>`;
    });
    
    let discount = 0;
    if (window.appliedPromo && window.appliedPromoDiscount) {
        discount = Math.floor(productsTotal * (window.appliedPromoDiscount / 100));
        summaryHTML += `• Скидка по промокоду (${window.appliedPromoDiscount}%) = -${discount} ₽<br>`;
    }
    
    let total = productsTotal - discount;
    if (total < 0) total = 0;
    
    // Проверка на превышение наличия
    let hasOversell = false;
    Object.keys(cart).forEach(id => {
        const p = PRODUCTS.find(prod => prod.id == id);
        if (p && p.category === 'instock' && cart[id] > p.stock_qty) {
            hasOversell = true;
        }
    });
    if (hasOversell) {
        summaryHTML += `<br><div style="color: #d32f2f; background: #ffebee; padding: 10px; border-radius: 8px; font-size: 12px; line-height: 1.4;">
        ⚠️ <b>Внимание:</b> Вы заказали часть товаров сверх их наличия. <br>
        Всё, что есть в наличии, мы доставим сегодня. Разницу придётся подождать (отправим на выращивание).
        </div><br>`;
    }
    
    const delType = document.getElementById('del-type')?.value || '';
    let deliveryCost = 0;
    if (delType.includes('Доставк') || delType.includes('Курьер')) {
        if (total >= 390) {
            summaryHTML += `➖ Доставка (курьер) = 0 ₽ (бесплатно)<br>`;
        } else {
            deliveryCost = 100;
            summaryHTML += `➖ Доставка (курьер) = 100 ₽<br>`;
        }
    }
    
    total += deliveryCost;
    
    // SUBSCRIPTION CALCULATION
    const subCheck = document.getElementById('is-subscription');
    if (subCheck && subCheck.checked) {
        let oldTotal = total * 4;
        total = Math.round(oldTotal * 0.9); // 10% discount
        summaryHTML += `<br><strong>ИТОГО к оплате: <s>${oldTotal} ₽</s> <span style="color:#d32f2f;">${total} ₽</span></strong><br><small style="color:#666;">(Подписка на 4 недели, скидка 10%)</small>`;
    } else {
        summaryHTML += `<br><strong>ИТОГО к оплате: ${total} ₽</strong>`;
    }
    
    const summEl = document.getElementById('modal-summary');
    if (summEl) summEl.innerHTML = summaryHTML;
    
    if (tg && tg.MainButton) {
        tg.MainButton.text = `Сделать заказ на ${total} ₽`;
        tg.MainButton.color = '#2e7d32';
        
        const modalEl = document.getElementById('checkout-modal');
        if (modalEl && !modalEl.classList.contains('hidden')) {
            tg.MainButton.show();
        }
    }
}

function triggerUpsellOrSubmit() {
    const orderForm = document.getElementById('order-form');
    if (!orderForm) return;
    if (!orderForm.checkValidity()) {
        orderForm.reportValidity();
        return;
    }
    orderForm.requestSubmit();
}

function openCheckoutModal() {
    setupDatePicker();
    const phoneInput = document.getElementById('cust-phone');
    const savedPhone = localStorage.getItem('micro_phone');
    if (phoneInput) {
        phoneInput.value = savedPhone ? formatPhoneNumber(savedPhone) : '';
    }
    
    const modalEl = document.getElementById('checkout-modal');
    if (modalEl) modalEl.classList.remove('hidden');
    
    const btnSubmit = document.getElementById('btn-submit-order');
    if (tg && tg.MainButton && btnSubmit) {
        btnSubmit.style.display = 'none';
    }
    
    updateModalSummary();
}
let userLoaded = false;
function pollTelegramUser() {
    if (userLoaded) return;
    const u = getTelegramUser();
    if (u) {
        userLoaded = true;
        initProfile();
        loadCart();
    }
}
async function bootApp() {
    try {
        const res = await fetch('https://microleaf-oe4o.onrender.com/api/inventory');
        INVENTORY = await res.json();
        Object.keys(INVENTORY).forEach(id => {
            const qty = INVENTORY[id];
            if (qty > 0) {
                const baseProd = PRODUCTS.find(p => p.id == id);
                if (baseProd) {
                    PRODUCTS.unshift({
                        ...baseProd,
                        id: 'stock_' + baseProd.id,
                        name: baseProd.name + ' (УЖЕ ВЫРОСЛО)',
                        category: 'instock',
                        growth_min: 0,
                        growth_max: 0,
                        stock_qty: qty
                    });
                }
            }
        });
    } catch(e) { console.error('Inventory fetch error:', e); }

    const subCheck = document.getElementById("is-subscription");
    if (subCheck) subCheck.addEventListener("change", updateModalSummary);
    if (tg) {
        try { 
            tg.ready(); 
            tg.expand(); 
            if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
        } catch(e){}
    }
    // Обработка параметров синхронизации из URL (обновление статусов)
    try { processUrlSyncParams(); } catch(e){ console.error('Sync params error:', e); }
    try { setupDatePicker(); } catch(e){ console.error(e); }
    try { initProfile(); } catch(e){ console.error(e); }
    try { renderCatalog('all'); } catch(e){ console.error(e); }
    try { initEvents(); } catch(e){ console.error(e); }
    const pollInterval = setInterval(pollTelegramUser, 100);
    setTimeout(() => clearInterval(pollInterval), 5000);
}
// Запуск приложения и принудительный рендер каталога
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bootApp());
} else {
    bootApp();
}
let currentProductInModal = null;

window.openProductModal = function(id) {
    const p = PRODUCTS.find(prod => prod.id == id);
    if (!p) return;
    currentProductInModal = p;
    
    document.getElementById('pm-title').innerText = p.name;
    document.getElementById('pm-weight').innerText = p.weight;
    
    let growthText = p.growth_min === p.growth_max ? `${p.growth_min} дн.` : `${p.growth_min}—${p.growth_max} дн.`;
    if (p.category === 'instock') {
        growthText = `🚀 Уже выросло (Остаток: ${p.stock_qty} шт.)`;
        document.getElementById('pm-growth').style.color = '#d32f2f';
        document.getElementById('pm-growth').style.fontWeight = 'bold';
    } else {
        growthText = `🌱 Срок роста: ${growthText}`;
        document.getElementById('pm-growth').style.color = '';
        document.getElementById('pm-growth').style.fontWeight = 'normal';
    }
    document.getElementById('pm-growth').innerText = growthText;
    document.getElementById('pm-price').innerText = `${p.price} ₽`;
    document.getElementById('pm-desc').innerText = p.description || "Свежая, хрустящая микрозелень прямо с нашей сити-фермы. Отлично подходит для салатов, бутербродов и украшения блюд.";
    
    let imagesHtml = '';
    let dotsHtml = '';
    const images = p.images || [p.img];
    images.forEach((imgUrl, idx) => {
        imagesHtml += `<img class="product-img-slide" style="width: 100%; height: 100%; object-fit: cover !important; border-radius: 0;" src="${imgUrl}" alt="${p.name}">`;
        dotsHtml += `<div class="gallery-dot ${idx === 0 ? 'active' : ''}"></div>`;
    });
    
    document.getElementById('pm-gallery').innerHTML = imagesHtml;
    document.getElementById('pm-dots').innerHTML = images.length > 1 ? dotsHtml : '';
    
    updatePmActions();
    
    document.getElementById('product-modal').style.display = 'flex';
    document.getElementById('product-modal').classList.remove('hidden');
    document.getElementById('pm-gallery').scrollLeft = 0;
};

window.closeProductModal = function() {
    document.getElementById('product-modal').style.display = 'none';
    document.getElementById('product-modal').classList.add('hidden');
    currentProductInModal = null;
};

window.updatePmGalleryDots = function() {
    const gallery = document.getElementById('pm-gallery');
    const dotsContainer = document.getElementById('pm-dots');
    if (!gallery || !dotsContainer) return;
    
    const scrollLeft = gallery.scrollLeft;
    const width = gallery.clientWidth;
    const index = Math.round(scrollLeft / width);
    
    const dots = dotsContainer.children;
    for (let i = 0; i < dots.length; i++) {
        if (i === index) {
            dots[i].classList.add('active');
        } else {
            dots[i].classList.remove('active');
        }
    }
};

let syncCartTimeout = null;
window.syncCart = async function() {
    const u = getTelegramUser();
    if (!u || !u.id) return;
    try {
        await fetch('https://microleaf-oe4o.onrender.com/api/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: u.id, cart: cart })
        });
    } catch(e) { console.error("Cart sync failed:", e); }
};

window.loadCart = async function() {
    const u = getTelegramUser();
    if (!u || !u.id) return;
    try {
        const res = await fetch(`https://microleaf-oe4o.onrender.com/api/cart?user_id=${u.id}`);
        const data = await res.json();
        if (data.success && data.cart && Object.keys(data.cart).length > 0) {
            cart = data.cart;
            renderCart();
            updateCartUI();
            const activeCat = document.querySelector('.cat-btn.active')?.dataset.category || 'all';
            renderCatalog(activeCat);
            
            // Check if we need to auto-open cart
            if (window.location.search.includes('open_cart=1') || window.location.hash.includes('open_cart=1')) {
                setTimeout(() => { if (typeof openCart === 'function') openCart(); }, 500);
            }
        }
    } catch(e) { console.error("Cart load failed:", e); }
};

window.updatePmActions = function() {
    if (!currentProductInModal) return;
    const qty = cart[currentProductInModal.id] || 0;
    const actionsDiv = document.getElementById('pm-actions');
    
    if (qty === 0) {
        actionsDiv.innerHTML = `<button class="btn-add pm-add-btn" onclick="updateQty('${currentProductInModal.id}', 1); updatePmActions();" style="padding: 10px 20px; font-size: 16px;">+ Добавить</button>`;
    } else {
        actionsDiv.innerHTML = `
            <div class="qty-control" style="background:var(--bg-color); transform: scale(1.1); transform-origin: right center;">
                <button class="btn-qty" onclick="updateQty('${currentProductInModal.id}', ${qty - 1}); updatePmActions();">-</button>
                <span class="qty-num">${qty} шт</span>
                <button class="btn-qty" onclick="updateQty('${currentProductInModal.id}', ${qty + 1}); updatePmActions();">+</button>
            </div>
        `;
    }
};

// Запасной вызов рендера каталога для 100% гарантированного отображения
window.addEventListener('load', () => {
    try { renderCatalog('all'); } catch(e){}
});