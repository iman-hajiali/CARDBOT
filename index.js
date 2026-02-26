const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// متغیر برای ذخیره پیام‌های ارسال شده جهت پاک کردن بعدی
let lastSentMessages = [];
// متغیر برای مدیریت مراحل آپدیت (State)
const userStates = {};

console.log('🤖 GAKART Bot is running...');

// --- خواندن کارت‌ها از فایل ---
const getCards = () => {
    try {
        const data = fs.readFileSync('cards.json');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

// --- ذخیره کارت‌ها در فایل ---
const saveCards = (cards) => {
    fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
};

// --- تابع ارسال کارت‌ها (فرمت جدید) ---
const sendCards = async (chatId) => {
    const cards = getCards();

    // 1. پاک کردن پیام‌های قبلی اگر وجود دارد
    if (lastSentMessages.length > 0) {
        for (const msgId of lastSentMessages) {
            try {
                await bot.deleteMessage(chatId, msgId);
            } catch (e) { /* پیام قبلاً پاک شده یا پیدا نشد */ }
        }
        lastSentMessages = [];
    }

    // 2. ارسال پیام‌های جدید
    for (const card of cards) {
        // فرمت درخواستی: Code Block با نام و شماره
        const message = `\`\`\`
👤${card.name}

 ${card.number}
\`\`\``;
        
        try {
            const sentMsg = await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            lastSentMessages.push(sentMsg.message_id);
        } catch (err) {
            console.log("Error sending card");
        }
    }
};

// --- دستور /cards ---
bot.onText(/\/cards/, async (msg) => {
    await sendCards(msg.chat.id);
});

// --- دستور /update (مخصوص ادمین) ---
bot.onText(/\/update/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // چک کردن ادمین بودن کاربر
    try {
        const chatMember = await bot.getChatMember(chatId, userId);
        if (chatMember.status !== 'creator' && chatMember.status !== 'administrator') {
            await bot.sendMessage(chatId, '⛔ فقط ادمین‌ها می‌توانند کارت‌ها را تغییر دهند.');
            return;
        }
    } catch (e) {
        return; // در چت خصوصی یا خطا
    }

    const cards = getCards();
    const options = {
        reply_markup: {
            inline_keyboard: cards.map((card, index) => [{
                text: card.name,
                callback_data: `edit_${index}`
            }])
        }
    };
    
    await bot.sendMessage(chatId, '👤 شخصی را که می‌خواهید کارتش را تغییر دهید انتخاب کنید:', options);
});

// --- مدیریت دکمه‌ها و مراحل آپدیت ---
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;

    if (data.startsWith('edit_')) {
        const index = data.split('_')[1];
        const cards = getCards();
        const selectedCard = cards[index];

        userStates[userId] = { step: 'waiting_number', cardIndex: index };
        
        await bot.editMessageText(`✏️ شما انتخاب کردید: *${selectedCard.name}*\n\nلطفاً شماره کارت جدید را ارسال کنید:`, {
            chat_id: msg.chat.id,
            message_id: msg.message_id,
            parse_mode: 'Markdown'
        });
    }
});

// --- دریافت شماره جدید از ادمین ---
bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const state = userStates[userId];

    // اگر کاربر در مرحله وارد کردن شماره است
    if (state && state.step === 'waiting_number') {
        const newNumber = msg.text.trim();
        
        // اعتبارسنجی ساده (فقط عدد و تعداد ارقام)
        if (!/^\d{16}$/.test(newNumber)) {
            await bot.sendMessage(msg.chat.id, '⚠️ شماره کارت باید دقیقا ۱۶ رقم باشد. لطفا دوباره وارد کنید:');
            return;
        }

        const cards = getCards();
        const cardName = cards[state.cardIndex].name;
        cards[state.cardIndex].number = newNumber;
        saveCards(cards);

        delete userStates[userId];

        await bot.sendMessage(msg.chat.id, `✅ کارت ${cardName} با موفقیت آپدیت شد.`);
        
        // ارسال مجدد کارت‌ها با اطلاعات جدید
        await sendCards(msg.chat.id);
    }
});