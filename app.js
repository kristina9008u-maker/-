// Инициализация Telegram WebApp SDK
const tg = window.Telegram?.WebApp;

// --- ГЛОБАЛЬНЫЙ СБРОС (ВАЙП) ДАННЫХ КЛИЕНТОВ ---
const RESET_VERSION = "1.5"; // Смена версии приведет к полному сбросу у всех
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
    }
};
window.closeProfileView = function() {
    const el = document.getElementById('view-profile');
    if (el) {
        el.classList.add('hidden');
        el.style.display = 'none';
    }
};
window.openCartView = function() {
    const el = document.getElementById('view-cart');
    if (el) {
        el.classList.remove('hidden');
        el.style.display = 'flex';
    }
};
window.closeCartView = function() {
    const el = document.getElementById('view-cart');
    if (el) {
        el.classList.add('hidden');
        el.style.display = 'none';
    }
};
// Список товаров микрозелени с ВРЕМЕННЫМИ РАМКАМИ роста (growth_min и growth_max)
const PRODUCTS = [
    { id: 1, category: "live_trays", name: "Горошек Маш", price: 150, weight: "1 лоток (10x15 см)", growth_min: 9, growth_max: 12, img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80" },
    { id: 2, category: "live_trays", name: "Подсолнечник", price: 180, weight: "1 лоток (10x15 см)", growth_min: 9, growth_max: 12, img: "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=400&q=80" },
    { id: 3, category: "live_trays", name: "Редис Ред Коралл", price: 160, weight: "1 лоток (10x15 см)", growth_min: 5, growth_max: 7, img: "https://images.unsplash.com/photo-1534483509719-3feaee7c30da?w=400&q=80" },
    { id: 4, category: "live_trays", name: "Брокколи Рапини", price: 170, weight: "1 лоток (10x15 см)", growth_min: 7, growth_max: 10, img: "https://images.unsplash.com/photo-1584270354949-c26b0d5b4a0c?w=400&q=80" },
    { id: 5, category: "cut_greens", name: "Срез Горошка", price: 200, weight: "100 грамм", growth_min: 1, growth_max: 2, img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80" },
    { id: 6, category: "cut_greens", name: "Микс-Срез 'Витаминный'", price: 250, weight: "100 грамм", growth_min: 1, growth_max: 2, img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80" },
    { id: 7, category: "sets", name: "Набор 'Витаминный старт'", price: 500, weight: "3 лотка", growth_min: 7, growth_max: 10, img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80" },
    { id: 8, category: "sets", name: "Подписка 'Месяц свежести'", price: 1800, weight: "4 недели (12 лотков)", growth_min: 7, growth_max: 10, img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80" }
];
let cart = {};
let currentCategory = 'all';
window.appliedPromo = null;

// Динамический расчёт МИНИМАЛЬНОЙ даты готовности заказа (по growth_min)
function setupDatePicker() {
    const delDateInput = document.getElementById('del-date');
    const growthHintEl = document.getElementById('growth-hint');
    if (!delDateInput) return;
    let maxMinDays = 1;
    Object.keys(cart).forEach(id => {
        const p = PRODUCTS.find(prod => prod.id == id);
        if (p && p.growth_min) {
            if (p.growth_min > maxMinDays) {
                maxMinDays = p.growth_min;
            }
        }
    });
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
// Инициализация Профиля из Telegram WebApp
function initProfile() {
    try {
        const avatarEl = document.getElementById('user-avatar');
        const topAvatarEl = document.getElementById('top-avatar-img');
        const nameEl = document.getElementById('user-full-name');
        const usernameEl = document.getElementById('user-username');
        const phoneEl = document.getElementById('saved-phone');
        const addressEl = document.getElementById('saved-address');
        let fullName = '';
        let userHandle = '';
        let avatarSrc = '';
        const u = getTelegramUser();
        const customName = localStorage.getItem('micro_user_name');
        if (customName) {
            fullName = customName;
        }
        if (u) {
            const fname = (u.first_name || '').trim();
            const lname = (u.last_name || '').trim();
            
            if (!customName) {
                if (fname || lname) {
                    fullName = `${fname} ${lname}`.trim();
                } else if (u.username) {
                    fullName = u.username;
                } else if (u.id) {
                    fullName = `Пользователь #${u.id}`;
                }
            }
            if (u.username) {
                userHandle = u.username.startsWith('@') ? u.username : `@${u.username}`;
            } else if (u.id) {
                userHandle = `ID: ${u.id}`;
            } else {
                userHandle = '@telegram_user';
            }
            // Фото профиля: из Telegram SDK → из URL параметра → из localStorage → генерируем
            if (u.photo_url) {
                avatarSrc = u.photo_url;
                localStorage.setItem('micro_photo_url', u.photo_url);
            } else {
                const savedPhoto = localStorage.getItem('micro_photo_url');
                if (savedPhoto) {
                    avatarSrc = savedPhoto;
                } else {
                    avatarSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'User')}&background=2e7d32&color=fff&size=200&font-size=0.4`;
                }
            }
        } else {
            fullName = fullName || 'Покупатель';
            userHandle = '@telegram_user';
            const savedPhoto = localStorage.getItem('micro_photo_url');
            if (savedPhoto) {
                avatarSrc = savedPhoto;
            } else {
                avatarSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=2e7d32&color=fff&size=200`;
            }
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
        const ordersCount = parseInt(localStorage.getItem('micro_orders_count') || '0');
        const traysCount = localStorage.getItem('micro_trays_count') || '0';
        if (savedPhone && phoneEl) {
            phoneEl.textContent = savedPhone;
        }
        if (savedAddress && addressEl) {
            addressEl.textContent = savedAddress;
        }
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
            let itemsText = (order.items || []).map(i => `${i.name} x${i.quantity}`).join(', ');
            card.innerHTML = `
                <div class="order-card-header">
                    <span class="order-id-title">Заказ #${displayId}</span>
                    <span class="order-date">${order.date}</span>
                </div>
                <div>
                    <span class="order-status-tag ${statusClass}">${st}</span>
                </div>
                <div class="order-items-list">📦 ${itemsText}</div>
                <div class="order-total-price">💰 ${order.total_price} ₽</div>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error('Order history error:', err);
    }
}
function renderCatalog(category = 'all') {
    try {
        const catalogContainer = document.getElementById('catalog-container');
        if (!catalogContainer) return;
        catalogContainer.innerHTML = '';
        
        const filtered = category === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.category === category);
        filtered.forEach(p => {
            const qty = cart[p.id] || 0;
            const card = document.createElement('div');
            card.className = 'product-card';
            
            const rangeStr = p.growth_min === p.growth_max ? `${p.growth_min} дн.` : `${p.growth_min}–${p.growth_max} дн.`;
            card.innerHTML = `
                <img class="product-img" src="${p.img}" alt="${p.name}">
                <h3 class="product-title">${p.name}</h3>
                <p class="product-weight">${p.weight}</p>
                <p class="product-growth">⏱ Срок роста: ${rangeStr}</p>
                <p class="product-price">${p.price} ₽</p>
                <div class="product-actions">
                    ${qty === 0 ? `
                        <button class="btn-add" onclick="updateQty(${p.id}, 1)">+ Добавить</button>
                    ` : `
                        <div class="qty-control">
                            <button class="btn-qty" onclick="updateQty(${p.id}, ${qty - 1})">-</button>
                            <span class="qty-num">${qty} шт</span>
                            <button class="btn-qty" onclick="updateQty(${p.id}, ${qty + 1})">+</button>
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
    if (qty <= 0) {
        delete cart[id];
    } else {
        cart[id] = qty;
    }
    updateCartUI();
    const activeCat = document.querySelector('.cat-btn.active')?.dataset.category || 'all';
    renderCatalog(activeCat);
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
                    <button class="btn-qty" onclick="updateQty(${p.id}, ${cart[id] - 1})">-</button>
                    <span class="qty-num">${cart[id]} шт</span>
                    <button class="btn-qty" onclick="updateQty(${p.id}, ${cart[id] + 1})">+</button>
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
        btnPromo.onclick = () => {
            const codeInput = document.getElementById('promo-code');
            if (codeInput) {
                const code = codeInput.value.trim().toUpperCase();
                if (code === 'GREEN10') {
                    window.appliedPromo = 'GREEN10';
                    alert('✅ Промокод GREEN10 применен! Скидка 10% на все товары.');
                    updateModalSummary();
                } else if (code) {
                    alert('❌ Неверный или просроченный промокод.');
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
                alert('Пожалуйста, введите полный номер телефона в формате: +7 (965) 901-12-61');
                return;
            }
            const dType = document.getElementById('del-type').value;
            const streetVal = (document.getElementById('cust-street')?.value || '').trim();
            const houseVal = (document.getElementById('cust-house')?.value || '').trim();
            const aptVal = (document.getElementById('cust-apt')?.value || '').trim();
            if (!dType.includes('Самовывоз')) {
                if (!streetVal || streetVal.length < 2) {
                    alert('⚠️ Введите название улицы');
                    document.getElementById('cust-street')?.focus();
                    return;
                }
                if (!houseVal || !/\d/.test(houseVal)) {
                    alert('⚠️ Введите номер дома');
                    document.getElementById('cust-house')?.focus();
                    return;
                }
            }
            let address;
            if (dType.includes('Самовывоз')) {
                address = 'Самовывоз из фермы';
            } else {
                address = `ул. ${streetVal}, д. ${houseVal}`;
                if (aptVal) address += `, кв. ${aptVal}`;
            }
            
            const rawDate = document.getElementById('del-date').value;
            const selectedTime = document.getElementById('del-time').value;
            let dateFormatted = rawDate;
            if (rawDate && rawDate.includes('-')) {
                const [y, m, d] = rawDate.split('-');
                const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
                dateFormatted = `${parseInt(d)} ${months[parseInt(m)-1]}`;
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
            Object.keys(cart).forEach(id => {
                const p = PRODUCTS.find(prod => prod.id == id);
                if (p) {
                    const sum = p.price * cart[id];
                    productsTotal += sum;
                    totalTraysCount += cart[id];
                    itemsArr.push({ product_id: p.id, name: p.name, weight: p.weight, price: p.price, quantity: cart[id], total: sum });
                }
            });
            
            let discount = 0;
            if (window.appliedPromo === 'GREEN10') {
                discount = Math.floor(productsTotal * 0.10);
                itemsArr.push({ product_id: 'promo', name: 'Скидка по промокоду', weight: '-', price: -discount, quantity: 1, total: -discount });
            }
            
            let totalPrice = productsTotal - discount;
            if (totalPrice < 0) totalPrice = 0;
            
            if (dType.includes('Доставка') || dType.includes('курьер')) {
                if (totalPrice >= 390) {
                    itemsArr.push({ product_id: 'delivery', name: 'Доставка (Бесплатно)', weight: '-', price: 0, quantity: 1, total: 0 });
                } else {
                    totalPrice += 100;
                    itemsArr.push({ product_id: 'delivery', name: 'Доставка (курьер)', weight: '-', price: 100, quantity: 1, total: 100 });
                }
            }
            
            if (tg && tg.MainButton) {
                tg.MainButton.showProgress(true);
            }
            const currentOrdersCount = parseInt(localStorage.getItem('micro_orders_count') || '0') + 1;
            const currentTraysCount = parseInt(localStorage.getItem('micro_trays_count') || '0') + totalTraysCount;
            localStorage.setItem('micro_orders_count', currentOrdersCount);
            localStorage.setItem('micro_trays_count', currentTraysCount);
            const newOrderId = Math.floor(1000 + Math.random() * 9000);
            const now = new Date();
            const dateStr = `${now.getDate()} ${['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'][now.getMonth()]}, ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
            const newOrder = {
                id: newOrderId,
                date: dateStr,
                status: "⚙️ Новый (ожидает подтверждения)",
                items: itemsArr,
                total_price: totalPrice,
                customer_name: name,
                phone: phone,
                delivery_type: dType,
                address: address,
                delivery_date: delDateCombined,
                payment_method: payMethod,
                is_subscription: isSubscription,
                promo_code: window.appliedPromo || ''
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newOrder)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (tg && tg.close) {
                        tg.close();
                    } else {
                        alert(`Заказ #${data.order_id} успешно оформлен!`);
                    }
                } else {
                    alert("Ошибка при оформлении заказа: " + data.error);
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
                alert("Не удалось связаться с сервером. Проверьте подключение или обратитесь к менеджеру.");
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
    Object.keys(cart).forEach(id => {
        const p = PRODUCTS.find(prod => prod.id == id);
        if (p) {
            const sum = p.price * cart[id];
            productsTotal += sum;
            summaryHTML += `• ${p.name} x ${cart[id]} шт. = ${sum} ₽<br>`;
        }
    });
    
    let discount = 0;
    if (window.appliedPromo === 'GREEN10') {
        discount = Math.floor(productsTotal * 0.10);
        summaryHTML += `• Скидка по промокоду (10%) = -${discount} ₽<br>`;
    }
    
    let total = productsTotal - discount;
    if (total < 0) total = 0;
    
    const delType = document.getElementById('del-type')?.value || '';
    if (delType.includes('Доставка') || delType.includes('курьер')) {
        if (total >= 390) {
            summaryHTML += `• Доставка (курьер) = 0 ₽ (БЕСПЛАТНО)<br>`;
        } else {
            total += 100;
            summaryHTML += `• Доставка (курьер) = 100 ₽<br>`;
        }
    }
    
    summaryHTML += `<br><strong>Итого к оплате: ${total} ₽</strong>`;
    const summEl = document.getElementById('modal-summary');
    if (summEl) summEl.innerHTML = summaryHTML;
    
    if (tg && tg.MainButton) {
        tg.MainButton.text = `ОФОРМИТЬ НА ${total} ₽`;
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
    }
}
function bootApp() {
    if (tg) {
        try { tg.ready(); tg.expand(); } catch(e){}
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
    document.addEventListener('DOMContentLoaded', bootApp);
} else {
    bootApp();
}
// Запасной вызов рендера каталога для 100% гарантированного отображения
window.addEventListener('load', () => {
    try { renderCatalog('all'); } catch(e){}
});
