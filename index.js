const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// ذخیره شناسه پیام‌های ارسال شده برای هر گروه
let lastSentMessages = {};
const userStates = {};

console.log('🤖 GAKART Bot is running...');

// --- خواندن و ذخیره کارت‌ها ---
const getCards = () => {
    try {
        const data = fs.readFileSync('cards.json');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

const saveCards = (cards) => {
    fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
};

// --- دستور /start ---
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "خوش آمدید به سیستم هوشمند 💳 مدیریت مالی GAMAS");
});

// --- دستور /cards ---
bot.onText(/\/cards/, async (msg) => {
    const chatId = msg.chat.id;

    // 1. پاک کردن پیام دستوری که کاربر فرستاده (/cards)
    try {
        await bot.deleteMessage(chatId, msg.message_id);
    } catch (e) {}

    // 2. پاک کردن لیست کارت‌های قبلی
    if (lastSentMessages[chatId]) {
        for (const msgId of lastSentMessages[chatId]) {
            try {
                await bot.deleteMessage(chatId, msgId);
            } catch (e) {}
        }
    }
    lastSentMessages[chatId] = [];

    // 3. ارسال کارت‌های جدید
    const cards = getCards();
    for (const card of cards) {
        const message = `\`\`\`
👤${card.name}

 ${card.number}
\`\`\``;
        try {
            const sentMsg = await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            lastSentMessages[chatId].push(sentMsg.message_id);
        } catch (err) {
            console.log("Error sending card");
        }
    }
});

// --- دستور /update ---
bot.onText(/\/update/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        const chatMember = await bot.getChatMember(chatId, userId);
        if (chatMember.status !== 'creator' && chatMember.status !== 'administrator') {
            await bot.sendMessage(chatId, '⛔ فقط ادمین‌ها می‌توانند کارت‌ها را تغییر دهند.');
            return;
        }
    } catch (e) { return; }

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

// --- مدیریت دکمه‌ها ---
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

// --- دریافت شماره جدید ---
bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const state = userStates[userId];

    if (state && state.step === 'waiting_number') {
        const newNumber = msg.text.trim();
        
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
        
        // ارسال مجدد کارت‌ها
        const chatId = msg.chat.id;
        if (lastSentMessages[chatId]) {
            for (const msgId of lastSentMessages[chatId]) {
                try { await bot.deleteMessage(chatId, msgId); } catch (e) {}
            }
        }
        lastSentMessages[chatId] = [];

        for (const card of cards) {
            const message = `\`\`\`
👤${card.name}

 ${card.number}
\`\`\``;
             try {
                const sentMsg = await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                lastSentMessages[chatId].push(sentMsg.message_id);
            } catch (err) {}
        }
    }
});
