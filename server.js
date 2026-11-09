const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Токен и ID чата берём из переменных окружения Render (Environment), а не из кода
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Не заданы переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID');
    process.exit(1);
}

// --- ФОРМИРОВАНИЕ СООБЩЕНИЯ: начало ---

// Экранирование для parse_mode: 'HTML'. Без него символы вроде [ _ * < & в тексте
// клиента (имя, комментарий, название с соусами) могут сломать разбор, и Telegram отклонит сообщение.
const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Убирает хвосты вида 15.000000000000002 после умножения
const money = (n) => String(Math.round(n * 100) / 100);

function buildMessage({ customerName, phone, paymentMethod, comment, cartItems }) {
    let totalPrice = 0;

    const itemsList = cartItems.map((item) => {
        const quantity = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const itemTotal = quantity * price;
        totalPrice += itemTotal;

        // menu.js дописывает соусы к названию: "Буррито (M (350г)) [Соусы: Сальса, Кетчуп]".
        // Отделяем их от названия, чтобы вывести отдельной строкой.
        const fullName = String(item.name ?? 'Товар');
        const match = fullName.match(/^(.*?)\s*\[Соусы:\s*(.*)\]\s*$/);
        const title = match ? match[1] : fullName;
        const sauces = match ? match[2] : '';

        let line = `▪️ ${esc(title)} — ${quantity} шт. × ${money(price)} руб. = ${money(itemTotal)} руб.`;
        if (sauces) {
            line += `\n🥫 Соусы: ${esc(sauces)}`;
        }
        return line;
    }).join('\n');

    return `🛒 <b>НОВЫЙ ЗАКАЗ!</b>\n\n` +
           `👤 <b>Имя:</b> ${esc(customerName)}\n` +
           `📞 <b>Телефон:</b> ${esc(phone)}\n` +
           `💳 <b>Оплата:</b> ${esc(paymentMethod)}\n` +
           `💬 <b>Комментарий:</b> ${esc(comment || 'нет')}\n\n` +
           `🍔 <b>Состав заказа:</b>\n${itemsList}\n\n` +
           `💰 <b>Итого к оплате:</b> ${money(totalPrice)} руб.`;
}

// --- ФОРМИРОВАНИЕ СООБЩЕНИЯ: конец ---

app.post('/api/order', async (req, res) => {
    try {
        // Понимаем оба варианта названий полей:
        // customerName / paymentMethod / cartItems  и  name / payment / cart
        const body = req.body || {};
        const order = {
            customerName: body.customerName ?? body.name,
            phone: body.phone,
            paymentMethod: body.paymentMethod ?? body.payment,
            comment: body.comment,
            cartItems: body.cartItems ?? body.cart
        };

        if (!Array.isArray(order.cartItems) || order.cartItems.length === 0) {
            return res.status(400).json({ success: false, error: 'Корзина пуста' });
        }
        if (order.cartItems.length > 30) {
            return res.status(400).json({ success: false, error: 'Слишком много позиций в заказе' });
        }
        if (!order.customerName || !order.phone) {
            return res.status(400).json({ success: false, error: 'Укажите имя и телефон' });
        }

        const message = buildMessage(order);

        // Лимит Telegram на одно сообщение — 4096 символов
        if (message.length > 4000) {
            return res.status(400).json({ success: false, error: 'Заказ слишком большой' });
        }

        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });

        const data = await response.json();

        if (data.ok) {
            res.json({ success: true, message: 'Заказ успешно отправлен!' });
        } else {
            console.error('Ошибка Telegram API:', data);
            res.status(500).json({ success: false, error: 'Ошибка отправки в Telegram' });
        }
    } catch (error) {
        console.error('Ошибка сервера:', error);
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
