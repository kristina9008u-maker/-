// Инициализация Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.ready();
}
// Список товаров микрозелени с фото
const PRODUCTS = [
    {
        id: 1,
        category: "live_trays",
        name: "Горошек Маш",
        price: 150,
        weight: "1 лоток (10x15 см)",
        img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80"
    },
    {
        id: 2,
        category: "live_trays",
        name: "Подсолнечник",
        price: 180,
        weight: "1 лоток (10x15 см)",
        img: "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=400&q=80"
    },
    {
        id: 3,
        category: "live_trays",
        name: "Редис Ред Коралл",
        price: 160,
        weight: "1 лоток (10x15 см)",
        img: "https://images.unsplash.com/photo-1534483509719-3feaee7c30da?w=400&q=80"
    },
    {
        id: 4,
        category: "live_trays",
        name: "Брокколи Рапини",
        price: 170,
        weight: "1 лоток (10x15 см)",
        img: "https://images.unsplash.com/photo-1584270354949-c26b0d5b4a0c?w=400&q=80"
    },
    {
        id: 5,
        category: "cut_greens",
        name: "Срез Горошка",
        price: 200,
        weight: "100 грамм",
        img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80"
    },
    {
        id: 6,
        category: "cut_greens",
        name: "Микс-Срез 'Витаминный'",
        price: 250,
        weight: "100 грамм",
        img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80"
    },
    {
        id: 7,
        category: "sets",
        name: "Набор 'Витаминный старт'",
        price: 500,
        weight: "3 лотка",
        img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80"
    },
    {
        id: 8,
        category: "sets",
        name: "Подписка 'Месяц свежести'",
        price: 1800,
        weight: "4 недели (12 лотков)",
        img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80"
    }
];
let cart = {};
const catalogContainer = document.getElementById('catalog-container');
const cartBar = document.getElementById('cart-bar');
const cartCount = document.getElementById('cart-count');
const cartTotal = document.getElementById('cart-total');
const checkoutModal = document.getElementById('checkout-modal');
const btnOpenCheckout = document.getElementById('btn-open-checkout');
const btnCloseModal = document.getElementById('btn-close-modal');
const orderForm = document.getElementById('order-form');
const modalSummary = document.getElementById('modal-summary');
// Заполнение имени из профиля Telegram
if (tg?.initDataUnsafe?.user) {
    const u = tg.initDataUnsafe.user;
    const nameInput = document.getElementById('cust-name');
    if (nameInput) {
        nameInput.value = `${u.first_name || ''} ${u.last_name || ''}`.trim();
    }
}
// Отрисовка каталога
function renderCatalog(category = 'all') {
    catalogContainer.innerHTML = '';
    const filtered = category === 'all' 
        ? PRODUCTS 
        : PRODUCTS.filter(p => p.category === category);
    filtered.forEach(p => {
        const qty = cart[p.id] || 0;
        const card = document.createElement('div');
        card.className = 'product-card';
        
        card.innerHTML = `
            <img class="product-img" src="${p.img}" alt="${p.name}" loading="lazy">
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
}
window.updateQty = function(id, qty) {
    if (qty <= 0) {
        delete cart[id];
    } else {
        cart[id] = qty;
    }
    updateCartBar();
    const activeCat = document.querySelector('.cat-btn.active')?.dataset.category || 'all';
    renderCatalog(activeCat);
};
function updateCartBar() {
    let totalItems = 0;
    let totalPrice = 0;
    Object.keys(cart).forEach(id => {
        const product = PRODUCTS.find(p => p.id == id);
        if (product) {
            const count = cart[id];
            totalItems += count;
            totalPrice += product.price * count;
        }
    });
    if (totalItems > 0) {
        cartCount.textContent = `${totalItems} товаров`;
        cartTotal.textContent = `${totalPrice} ₽`;
        cartBar.classList.remove('hidden');
    } else {
        cartBar.classList.add('hidden');
    }
}
document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        renderCatalog(e.target.dataset.category);
    });
});
document.getElementById('del-type').addEventListener('change', (e) => {
    const addrGroup = document.getElementById('address-group');
    if (e.target.value.includes('Самовывоз')) {
        addrGroup.style.display = 'none';
    } else {
        addrGroup.style.display = 'block';
    }
});
btnOpenCheckout.addEventListener('click', () => {
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
    modalSummary.innerHTML = summaryHTML;
    checkoutModal.classList.remove('hidden');
});
btnCloseModal.addEventListener('click', () => {
    checkoutModal.classList.add('hidden');
});
orderForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const delType = document.getElementById('del-type').value;
    const address = delType.includes('Самовывоз') 
        ? 'Самовывоз из фермы (ул. Зеленая, 15)' 
        : document.getElementById('cust-address').value.trim();
    const delDate = document.getElementById('del-date').value.trim();
    const payMethod = document.getElementById('pay-method').value;
    let itemsArr = [];
    let totalPrice = 0;
    Object.keys(cart).forEach(id => {
        const p = PRODUCTS.find(prod => prod.id == id);
        if (p) {
            const sum = p.price * cart[id];
            totalPrice += sum;
            itemsArr.push({
                product_id: p.id,
                name: p.name,
                weight: p.weight,
                price: p.price,
                quantity: cart[id],
                total: sum
            });
        }
    });
    const orderPayload = {
        customer_name: name,
        phone: phone,
        delivery_type: delType,
        address: address,
        delivery_date: delDate,
        payment_method: payMethod,
        items: itemsArr,
        total_price: totalPrice
    };
    if (tg && tg.sendData) {
        tg.sendData(JSON.stringify(orderPayload));
    } else {
        alert("Заказ сформирован:\n" + JSON.stringify(orderPayload, null, 2));
    }
});
renderCatalog('all');