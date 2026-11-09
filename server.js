const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Вставьте сюда данные вашего Telegram-бота
const TELEGRAM_BOT_TOKEN = '8708160027:AAELrgFRhuphx46y-rGbtT2ugixNI55lSkw';
const TELEGRAM_CHAT_ID = '-1003947748195';

app.post('/api/order', async (req, res) => {
    try {
        const { customerName, phone, paymentMethod, comment, cartItems } = req.body;

        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ success: false, error: 'Корзина пуста' });
        }

        // Считаем общую сумму и формируем список товаров
        let totalPrice = 0;
        let itemsList = cartItems.map(item => {
            const itemTotal = (item.price || 0) * (item.quantity || 1);
            totalPrice += itemTotal;
            return `▪️ ${item.name} — ${item.quantity} шт. × ${item.price} руб. = ${itemTotal} руб.`;
        }).join('\n');

        // Текст сообщения, который прилетит в Telegram-чат
        let message = `🛒 *НОВЫЙ ЗАКАЗ!*\n\n` +
                      `👤 *Имя:* ${customerName}\n` +
                      `📞 *Телефон:* ${phone}\n` +
                      `💳 *Оплата:* ${paymentMethod}\n` +
                      `💬 *Комментарий:* ${comment || 'нет'}\n\n` +
                      `🍔 *Состав заказа:*\n${itemsList}\n\n` +
                      `💰 *Итого к оплате:* ${totalPrice} руб.`;

        // Отправка запроса в Telegram API (используем встроенный в Node.js fetch)
        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
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