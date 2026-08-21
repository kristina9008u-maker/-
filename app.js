// Инициализация Telegram WebApp SDK
const tg = window.Telegram?.WebApp;
// Декодирование двойного URL-кодирования Telegram
function safeParseJSON(str) {
    if (!str) return null;
    let s = str;
    for (let i = 0; i < 3; i++) {
        if (typeof s === 'string' && (s.startsWith('{') || s.startsWith('['))) {
            try { return JSON.parse(s); } catch (e) {}
        }
        try { s = decodeURIComponent(s); } catch (e) {}
    }
    try { return JSON.parse(s); } catch (e) {}
    return null;
}
// Динамический парсер пользователя Telegram (для любого кто открыл приложение)
function getTelegramUser() {
    // 1. Из официального SDK Telegram (работает для любого пользователя)
    const tgUser = tg?.initDataUnsafe?.user || window.TelegramDataUnsafe?.user;
    if (tgUser && (tgUser.first_name || tgUser.username || tgUser.id)) {
        return tgUser;
    }
    // 2. Из URL строки Telegram Mini App (#tgWebAppData=...)
    try {
        const fullUrl = window.location.href;
        const searchStr = window.location.search || window.location.hash.replace('#', '');
        const params = new URLSearchParams(searchStr);
        const webAppData = params.get('tgWebAppData') || params.get('initData') || fullUrl;
        
        if (webAppData) {
            const matches = webAppData.match(/user=([^&]+)/);
            if (matches && matches[1]) {
                const userObj = safeParseJSON(matches[1]);
                if (userObj && (userObj.first_name || userObj.username || userObj.id)) return userObj;
            }
        }
    } catch (e) {
        console.error('Telegram User parse error:', e);
    }
    // 3. Данные из локального хранилища устройства этого пользователя (если ранее делался заказ)
    const savedName = localStorage.getItem('micro_user_name');
    if (savedName) {
        return { first_name: savedName };
    }
    return null;
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
// Список товаров микрозелени
const PRODUCTS = [
    { id: 1, category: "live_trays", name: "Горошек Маш", price: 150, weight: "1 лоток (10x15 см)", img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80" },
    { id: 2, category: "live_trays", name: "Подсолнечник", price: 180, weight: "1 лоток (10x15 см)", img: "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=400&q=80" },
    { id: 3, category: "live_trays", name: "Редис Ред Коралл", price: 160, weight: "1 лоток (10x15 см)", img: "https://images.unsplash.com/photo-1534483509719-3feaee7c30da?w=400&q=80" },
    { id: 4, category: "live_trays", name: "Брокколи Рапини", price: 170, weight: "1 лоток (10x15 см)", img: "https://images.unsplash.com/photo-1584270354949-c26b0d5b4a0c?w=400&q=80" },
    { id: 5, category: "cut_greens", name: "Срез Горошка", price: 200, weight: "100 грамм", img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80" },
    { id: 6, category: "cut_greens", name: "Микс-Срез 'Витаминный'", price: 250, weight: "100 грамм", img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80" },
    { id: 7, category: "sets", name: "Набор 'Витаминный старт'", price: 500, weight: "3 лотка", img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80" },
    { id: 8, category: "sets", name: "Подписка 'Месяц свежести'", price: 1800, weight: "4 недели (12 лотков)", img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80" }
];
let cart = {};
// Инициализация Профиля из Telegram WebApp
function initProfile() {
    try {
        const avatarEl = document.getElementById('user-avatar');
        const topAvatarEl = document.getElementById('top-avatar-img');
        const nameEl = document.getElementById('user-full-name');
        const usernameEl = document.getElementById('user-username');
        const phoneEl = document.getElementById('saved-phone');
        const addressEl = document.getElementById('saved-address');
        let fullName = 'Эко Покупатель';
        let userHandle = '@telegram_user';
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
                userHandle = `@${u.username}`;
            } else if (u.id) {
                userHandle = `ID: ${u.id}`;
            }
            if (u.photo_url) {
                avatarSrc = u.photo_url;
            } else {
                avatarSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=2e7d32&color=fff&size=200&font-size=0.4`;
            }
        } else {
            avatarSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=2e7d32&color=fff&size=200`;
        }
        if (nameEl) nameEl.textContent = fullName;
        if (usernameEl) usernameEl.textContent = userHandle;
        if (avatarEl) avatarEl.src = avatarSrc;
        if (topAvatarEl) topAvatarEl.src = avatarSrc;
        const custNameInput = document.getElementById('cust-name');
        if (custNameInput && fullName !== 'Эко Покупатель') {
            custNameInput.value = fullName;
        }
        const savedPhone = localStorage.getItem('micro_phone');
        const savedAddress = localStorage.getItem('micro_address');
        const ordersCount = localStorage.getItem('micro_orders_count') || '0';
        const traysCount = localStorage.getItem('micro_trays_count') || '0';
        if (savedPhone && phoneEl) {
            phoneEl.textContent = savedPhone;
            const input = document.getElementById('cust-phone');
            if (input) input.value = savedPhone;
        }
        if (savedAddress && addressEl) {
            addressEl.textContent = savedAddress;
            const input = document.getElementById('cust-address');
            if (input) input.value = savedAddress;
        }
        
        const statOrd = document.getElementById('stat-orders-count');
        if (statOrd) statOrd.textContent = ordersCount;
        
        const statTr = document.getElementById('stat-trays-count');
        if (statTr) statTr.textContent = traysCount;
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
            if (st.includes('Выполняется') || st.includes('Принят')) statusClass = 'status-in-progress';
            if (st.includes('доставку') || st.includes('пути')) statusClass = 'status-delivering';
            if (st.includes('Выполнен') || st.includes('Получен')) statusClass = 'status-completed';
            let itemsText = (order.items || []).map(i => `${i.name} x${i.quantity}`).join(', ');
            card.innerHTML = `
                <div class="order-card-header">
                    <span class="order-id-title">Заказ #${order.id}</span>
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
            
            card.innerHTML = `
                <img class="product-img" src="${p.img}" alt="${p.name}">
                <h3 class="product-title">${p.name}</h3>
                <p class="product-weight">${p.weight}</p>
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
            row.innerHTML = `
                <div class="cart-item-info">
                    <h4>${p.name}</h4>
                    <p>${p.weight} • ${p.price} ₽</p>
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
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            renderCatalog(e.currentTarget.dataset.category);
        };
    });
    const delType = document.getElementById('del-type');
    if (delType) {
        delType.onchange = (e) => {
            const addrGrp = document.getElementById('address-group');
            if (addrGrp) addrGrp.style.display = e.target.value.includes('Самовывоз') ? 'none' : 'block';
        };
    }
    const btnCheckout1 = document.getElementById('btn-cart-checkout');
    if (btnCheckout1) btnCheckout1.onclick = openCheckoutModal;
    const btnCloseModal = document.getElementById('btn-close-modal');
    if (btnCloseModal) btnCloseModal.onclick = () => {
        document.getElementById('checkout-modal').classList.add('hidden');
    };
    const orderForm = document.getElementById('order-form');
    if (orderForm) {
        orderForm.onsubmit = (e) => {
            e.preventDefault();
            const name = document.getElementById('cust-name').value.trim();
            const phone = document.getElementById('cust-phone').value.trim();
            const dType = document.getElementById('del-type').value;
            const address = dType.includes('Самовывоз') ? 'Самовывоз из фермы' : document.getElementById('cust-address').value.trim();
            const delDate = document.getElementById('del-date').value.trim();
            const payMethod = document.getElementById('pay-method').value;
            localStorage.setItem('micro_phone', phone);
            localStorage.setItem('micro_address', address);
            if (name) {
                localStorage.setItem('micro_user_name', name);
            }
            let itemsArr = [];
            let totalPrice = 0;
            let totalTraysCount = 0;
            Object.keys(cart).forEach(id => {
                const p = PRODUCTS.find(prod => prod.id == id);
                if (p) {
                    const sum = p.price * cart[id];
                    totalPrice += sum;
                    totalTraysCount += cart[id];
                    itemsArr.push({ product_id: p.id, name: p.name, weight: p.weight, price: p.price, quantity: cart[id], total: sum });
                }
            });
            const currentOrdersCount = parseInt(localStorage.getItem('micro_orders_count') || '0') + 1;
            const currentTraysCount = parseInt(localStorage.getItem('micro_trays_count') || '0') + totalTraysCount;
            localStorage.setItem('micro_orders_count', currentOrdersCount);
            localStorage.setItem('micro_trays_count', currentTraysCount);
            const newOrderId = Math.floor(1000 + Math.random() * 9000);
            const now = new Date();
            const dateStr = `${now.getDate()} ${['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][now.getMonth()]}, ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
            const newOrder = {
                id: newOrderId,
                date: dateStr,
                status: "⚙️ Выполняется (Принят)",
                items: itemsArr,
                total_price: totalPrice,
                customer_name: name,
                phone: phone,
                delivery_type: dType,
                address: address,
                delivery_date: delDate,
                payment_method: payMethod
            };
            const historyJSON = localStorage.getItem('micro_orders_history');
            let history = historyJSON ? JSON.parse(historyJSON) : [];
            history.push(newOrder);
            localStorage.setItem('micro_orders_history', JSON.stringify(history));
            cart = {};
            updateCartUI();
            document.getElementById('checkout-modal').classList.add('hidden');
            window.closeCartView();
            if (tg && tg.sendData) {
                tg.sendData(JSON.stringify(newOrder));
            } else {
                alert(`Заказ #${newOrderId} оформлен! Статус: ⚙️ Выполняется`);
            }
            initProfile();
            window.openProfileView();
        };
    }
}
function openCheckoutModal() {
    let summaryHTML = '<strong>Состав заказа:</strong><br>';
    let total = 0;
    Object.keys(cart).forEach(id => {
        const p = PRODUCTS.find(prod => prod.id == id);
        if (p) {
            const sum = p.price * cart[id];
            total += sum;
            summaryHTML += `• ${p.name} x ${cart[id]} шт. = ${sum} ₽<br>`;
        }
    });
    summaryHTML += `<br><strong>Итого к оплате: ${total} ₽</strong>`;
    const summEl = document.getElementById('modal-summary');
    if (summEl) summEl.innerHTML = summaryHTML;
    
    const modalEl = document.getElementById('checkout-modal');
    if (modalEl) modalEl.classList.remove('hidden');
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
    initProfile();
    renderCatalog('all');
    initEvents();
    const pollInterval = setInterval(pollTelegramUser, 150);
    setTimeout(() => clearInterval(pollInterval), 5000);
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootApp);
} else {
    bootApp();
}
