require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');

const bot = new Telegraf(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;
const adminSession = {};
const vendorSession = {};

// --- EXPRESS SERVER FOR RENDER PING ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('FoodHub Bot is running live 24/7!');
});

app.listen(PORT, () => {
    console.log(`Keep-alive web server is running on port ${PORT}`);
});
// ------------------------------------

// --- START COMMAND ---
bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();

    if (userId === ADMIN_ID) {
        return ctx.reply('👑 *Admin Control Panel*', {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('➕ Add Restaurant', 'admin_add_res')],
                [Markup.button.callback('🍔 Add Menu Item', 'admin_add_menu')],
                [Markup.button.callback('📊 View Database Stats', 'admin_stats')]
            ])
        });
    }

    const { data: vendorData } = await supabase.from('vendors').select('*').eq('telegram_id', userId).single();
    if (vendorData) {
        return ctx.reply(`🏪 *Vendor Panel (${vendorData.name})*`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📦 View Active Orders', 'vendor_orders')],
                [Markup.button.callback('🍔 Manage Menus', 'vendor_menus')]
            ])
        });
    }

    const { data: riderData } = await supabase.from('riders').select('*').eq('telegram_id', userId).single();
    if (riderData) {
        return ctx.reply(`🚴 *Rider Panel (${riderData.name})*\nStatus: *${riderData.status}*`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🔄 Toggle Status', 'rider_toggle_status')],
                [Markup.button.callback('📦 Available Deliveries', 'rider_jobs')]
            ])
        });
    }

    ctx.reply('🍔 *Welcome to FoodHub Bot!*', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🚴 Register as Rider', 'rider_register')],
            [Markup.button.callback('🏪 Register as Vendor', 'vendor_register')]
        ])
    });
});

// ================= ADMIN WORKFLOW =================
bot.action('admin_add_res', async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.from.id.toString() !== ADMIN_ID) return ctx.reply('Unauthorized!');
    adminSession[ctx.from.id] = { step: 'res_name' };
    ctx.reply('Enter Restaurant Name:');
});

bot.action('admin_add_menu', async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.from.id.toString() !== ADMIN_ID) return ctx.reply('Unauthorized!');
    const { data: restaurants } = await supabase.from('restaurants').select('id, name');
    if (!restaurants || restaurants.length === 0) return ctx.reply('Please add a restaurant first!');
    
    let buttons = restaurants.map(r => [Markup.button.callback(r.name, `admin_menu_res_${r.id}`)]);
    ctx.reply('Select Restaurant to add menu item:', Markup.inlineKeyboard(buttons));
});

bot.action(/admin_menu_res_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    adminSession[ctx.from.id] = { step: 'menu_name', resId: ctx.match[1] };
    ctx.reply('Enter Menu Item Name:');
});

bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    const session = adminSession[userId];
    if (!session) return next();

    if (session.step === 'res_name') {
        session.name = ctx.message.text;
        session.step = 'res_category';
        return ctx.reply('Enter Category (e.g., Fast Food, Italian):');
    }
    if (session.step === 'res_category') {
        session.category = ctx.message.text;
        session.step = 'res_phone';
        return ctx.reply('Enter Contact Phone Number:');
    }
    if (session.step === 'res_phone') {
        session.phone = ctx.message.text;
        session.step = 'res_location';
        return ctx.reply('Please share current location/address:', Markup.keyboard([
            [Markup.button.locationRequest('📍 Share Current Location')]
        ]).resize().oneTime());
    }

    if (session.step === 'menu_name') {
        session.menuName = ctx.message.text;
        session.step = 'menu_price';
        return ctx.reply('Enter Item Price ($):');
    }
    if (session.step === 'menu_price') {
        session.menuPrice = parseFloat(ctx.message.text);
        session.step = 'menu_discount';
        return ctx.reply('Enter Discount % (0 if no discount):');
    }
    if (session.step === 'menu_discount') {
        session.menuDiscount = parseFloat(ctx.message.text);
        
        await supabase.from('menus').insert([{
            restaurant_id: session.resId,
            name: session.menuName,
            price: session.menuPrice,
            discount: session.menuDiscount,
            is_boosted: session.menuDiscount > 0,
            image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'
        }]);

        ctx.reply('✅ Menu item added and boosted successfully!');
        delete adminSession[userId];
    }
});

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const session = adminSession[userId];
    if (!session || session.step !== 'res_location') return;

    await supabase.from('restaurants').insert([{
        name: session.name,
        category: session.category,
        rating: 5.0,
        image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9'
    }]);

    ctx.reply(`✅ Restaurant "${session.name}" saved successfully!`, Markup.removeKeyboard());
    delete adminSession[userId];
});

// ================= RIDER & VENDOR REGISTRATION =================
bot.action('rider_register', async (ctx) => {
    await ctx.answerCbQuery();
    // Clear any previous conflicting sessions
    delete vendorSession[ctx.from.id];
    ctx.reply('To register as rider, share your phone number:', Markup.keyboard([
        [Markup.button.contactRequest('📱 Share Phone Number')]
    ]).resize().oneTime());
});

bot.action('vendor_register', async (ctx) => {
    await ctx.answerCbQuery();
    const { data: restaurants } = await supabase.from('restaurants').select('id, name');
    if (!restaurants || restaurants.length === 0) return ctx.reply('No restaurants found in database.');
    let buttons = restaurants.map(res => [Markup.button.callback(res.name, `select_vendor_res_${res.id}`)]);
    ctx.reply('Select your restaurant:', Markup.inlineKeyboard(buttons));
});

bot.action(/select_vendor_res_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    vendorSession[ctx.from.id] = { type: 'vendor', step: 'phone', resId: ctx.match[1] };
    ctx.reply('Share your phone number for vendor registration:', Markup.keyboard([
        [Markup.button.contactRequest('📱 Share Phone Number')]
    ]).resize().oneTime());
});

// Vendor/Rider Active Orders & Menus Handlers
bot.action('vendor_orders', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('📦 Active orders feature coming up next!');
});

bot.action('vendor_menus', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('🍔 Menu management feature coming up next!');
});

bot.action('rider_toggle_status', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const { data: rider } = await supabase.from('riders').select('status').eq('telegram_id', userId).single();
    if(rider) {
        const newStatus = rider.status === 'Available' ? 'Offline' : 'Available';
        await supabase.from('riders').update({ status: newStatus }).eq('telegram_id', userId);
        ctx.reply(`✅ Your status has been updated to: *${newStatus}*`, { parse_mode: 'Markdown' });
    }
});

bot.action('rider_jobs', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('📦 No pending delivery jobs right now.');
});

// Contact Handler (Fixes state overlap between Vendor and Rider)
bot.on('contact', async (ctx) => {
    const contact = ctx.message.contact;
    const telegramId = ctx.from.id;
    const name = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim();
    const phone = contact.phone_number;

    const vSession = vendorSession[telegramId];
    if (vSession && vSession.type === 'vendor') {
        await supabase.from('vendors').upsert([{ telegram_id: telegramId, restaurant_id: vSession.resId, name, phone }], { onConflict: 'telegram_id' });
        delete vendorSession[telegramId];
        return ctx.reply('✅ Vendor Registration Successful! Send /start to open panel.', Markup.removeKeyboard());
    }

    await supabase.from('riders').upsert([{ telegram_id: telegramId, name, phone, status: 'Available' }], { onConflict: 'telegram_id' });
    ctx.reply('✅ Rider Registration Successful! Send /start to access your dashboard.', Markup.removeKeyboard());
});

bot.launch();
console.log('FoodHub Telegram Bot & Express Server running smoothly...');
