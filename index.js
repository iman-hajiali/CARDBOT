const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

// تنظیمات ضروری برای هاست رایگان
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// توکن بات از متغیرهای محیطی خوانده می‌شود
const token = process.env.BOT_TOKEN;

if (!token) {
    console.error("BOT_TOKEN not found!");
} else {
    const bot = new TelegramBot(token, { polling: true });
    console.log('🤖 GAKART Bot is running...');

    // --- بانک اطلاعاتی کارت‌ها ---
    // برای تغییر شماره، این قسمت را ویرایش کنید
    const cards = [
        { name: 'Sadra', number: '6219861910038248' },
        { name: 'Mmd', number: '6219861908112815' },
        { name: 'Dany', number: '6037997389629669' },
        { name: 'Puya', number: '5022291323486868' },
        { name: 'Iman', number: '6219861906192207' },
        { name: 'Ehsan', number: '6037991780447284' }
    ];

    // --- دستور /cards ---
    bot.onText(/\/cards/, async (msg) => {
        const chatId = msg.chat.id;
        
        await bot.sendMessage(chatId, '💳 *لیست کارت‌های گاکارت:*\n--------------------------------', { parse_mode: 'Markdown' });

        for (const card of cards) {
            const message = `👤 *${card.name}*\n💳 شماره کارت:\n\`${card.number}\``;
            try {
                await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            } catch (err) {
                console.log("Error sending card");
            }
        }
        
        await bot.sendMessage(chatId, '--------------------------------\n✅ تمامی کارت‌ها ارسال شد.', { parse_mode: 'Markdown' });
    });
}