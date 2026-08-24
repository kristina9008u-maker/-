// Инициализация Telegram WebApp SDK
const tg = window.Telegram?.WebApp;
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
        if (uUsername || uName || uId) {
            return {
                first_name: uName || uUsername || 'Покупатель',
                username: uUsername || '',
                id: uId || ''
            };
        }
    } catch (e) {}
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
            if (u.photo_url) {
                avatarSrc = u.photo_url;
            } else {
                avatarSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'User')}&background=2e7d32&color=fff&size=200&font-size=0.4`;
            }
        } else {
            fullName = fullName || 'Покупатель';
            userHandle = '@telegram_user';
            avatarSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=2e7d32&color=fff&size=200`;
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
        const ordersCount = localStorage.getItem('micro_orders_count') || '0';
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
            else if (st.includes('Выполнен') || st.includes('Получен')) statusClass = 'status-completed';
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
        };
        delType.onchange = checkAddressRequirement;
        checkAddressRequirement();
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
            const dateStr = `${now.getDate()} ${['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'][now.getMonth()]}, ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
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
                delivery_date: delDateCombined,
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
    setupDatePicker();
    const phoneInput = document.getElementById('cust-phone');
    const savedPhone = localStorage.getItem('micro_phone');
    if (phoneInput) {
        phoneInput.value = savedPhone ? formatPhoneNumber(savedPhone) : '';
    }
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
