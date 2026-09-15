require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

const bot = new Telegraf(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID; // Admin er Telegram User ID
const adminSession = {};
const vendorSession = {};

// --- START COMMAND (Separate Interfaces for Admin, Vendor, Rider, Customer) ---
bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();

    // 1. Admin Interface
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

    // 2. Check if user is registered as Vendor
    const { data: vendorData } = await supabase.from('vendors').select('*').eq('telegram_id', userId).single();
    if (vendorData) {
        return ctx.reply(`🏪 *Vendor Panel (${vendorData.name})*\nManage your restaurant & orders:`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📦 View Active Orders', 'vendor_orders')],
                [Markup.button.callback('🍔 Manage Menus', 'vendor_menus')]
            ])
        });
    }

    // 3. Check if user is registered as Rider
    const { data: riderData } = await supabase.from('riders').select('*').eq('telegram_id', userId).single();
    if (riderData) {
        return ctx.reply(`🚴 *Rider Panel (${riderData.name})*\nStatus: *${riderData.status}*`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🔄 Toggle Status (Available/Offline)', 'rider_toggle_status')],
                [Markup.button.callback('📦 Available Deliveries', 'rider_jobs')]
            ])
        });
    }

    // 4. Default Customer / New User Interface
    ctx.reply('🍔 *Welcome to FoodHub Bot!*', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🚴 Register as Rider', 'rider_register')],
            [Markup.button.callback('🏪 Register as Vendor', 'vendor_register')]
        ])
    });
});


// ================= ADMIN WORKFLOW =================
bot.action('admin_add_res', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return ctx.reply('Unauthorized!');
    adminSession[ctx.from.id] = { step: 'res_name' };
    ctx.reply('Enter Restaurant Name:');
});

bot.action('admin_add_menu', async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return ctx.reply('Unauthorized!');
    const { data: restaurants } = await supabase.from('restaurants').select('id, name');
    if (!restaurants || restaurants.length === 0) return ctx.reply('Please add a restaurant first!');
    
    let buttons = restaurants.map(r => [Markup.button.callback(r.name, `admin_menu_res_${r.id}`)]);
    ctx.reply('Select Restaurant to add menu item:', Markup.inlineKeyboard(buttons));
});

bot.action(/admin_menu_res_(\d+)/, (ctx) => {
    adminSession[ctx.from.id] = { step: 'menu_name', resId: ctx.match[1] };
    ctx.reply('Enter Menu Item Name:');
});

// Admin Text Handler for Multi-step Inputs
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
        return ctx.reply('Please share current location/address using Telegram Location button or text description:', Markup.keyboard([
            [Markup.button.locationRequest('📍 Share Current Location')]
        ]).resize().oneTime());
    }

    // Menu steps
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
            is_boosted: session.menuDiscount > 0 ? true : false,
            image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'
        }]);

        ctx.reply('✅ Menu item added and boosted successfully!');
        delete adminSession[userId];
    }
});

// Admin Location Share for Restaurant Registration
bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const session = adminSession[userId];
    if (!session || session.step !== 'res_location') return;

    const lat = ctx.message.location.latitude;
    const lon = ctx.message.location.longitude;
    const addressLink = `https://maps.google.com/?q=${lat},${lon}`;

    await supabase.from('restaurants').insert([{
        name: session.name,
        category: session.category,
        rating: 5.0,
        image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9'
    }]);

    ctx.reply(`✅ Restaurant "${session.name}" saved with location successfully!`, Markup.removeKeyboard());
    delete adminSession[userId];
});


// ================= RIDER REGISTRATION WORKFLOW =================
bot.action('rider_register', (ctx) => {
    ctx.reply('To register as rider, please share your contact details:', Markup.keyboard([
        [Markup.button.contactRequest('📱 Share Phone Number')]
    ]).resize().oneTime());
});

bot.on('contact', async (ctx) => {
    const contact = ctx.message.contact;
    const telegramId = ctx.from.id;
    const name = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim();
    const phone = contact.phone_number;

    // Check if registering as Rider or Vendor
    const vSession = vendorSession[telegramId];
    if (vSession && vSession.step === 'phone') {
        await supabase.from('vendors').insert([{
            telegram_id: telegramId,
            restaurant_id: vSession.resId,
            name: name,
            phone: phone
        }]);
        delete vendorSession[telegramId];
        return ctx.reply('✅ Vendor Registration Successful! Send /start to open panel.', Markup.removeKeyboard());
    }

    // Default Rider Registration
    const { error } = await supabase.from('riders').upsert([{
        telegram_id: telegramId,
        name: name,
        phone: phone,
        status: 'Available'
    }], { onConflict: 'telegram_id' });

    if (error) {
        ctx.reply('Registration failed. Try again.');
    } else {
        ctx.reply('✅ Rider Registration Successful! Send /start to access your dashboard.', Markup.removeKeyboard());
    }
});


// ================= VENDOR REGISTRATION WORKFLOW =================
bot.action('vendor_register', async (ctx) => {
    const { data: restaurants } = await supabase.from('restaurants').select('id, name');
    if (!restaurants || restaurants.length === 0) {
        return ctx.reply('No restaurants found in database. Contact Admin first.');
    }

    let buttons = restaurants.map(res => [Markup.button.callback(res.name, `select_vendor_res_${res.id}`)]);
    ctx.reply('Select your restaurant:', Markup.inlineKeyboard(buttons));
});

bot.action(/select_vendor_res_(\d+)/, (ctx) => {
    const resId = ctx.match[1];
    vendorSession[ctx.from.id] = { step: 'phone', resId: resId };

    ctx.reply('Please share your phone number to complete vendor registration:', Markup.keyboard([
        [Markup.button.contactRequest('📱 Share Phone Number')]
    ]).resize().oneTime());
});


// ================= ORDER NOTIFICATION & PIPELINE =================
// Note: Call this function when order is placed from website
async function notifyVendorOnOrder(orderData) {
    // Find vendor connected to this restaurant
    const { data: res } = await supabase.from('restaurants').select('id').eq('name', orderData.restaurant_name).single();
    if (!res) return;

    const { data: vendor } = await supabase.from('vendors').select('telegram_id').eq('restaurant_id', res.id).single();
    if (!vendor) return;

    let itemsText = orderData.items.map(i => `- ${i.name} x ${i.qty} ($${i.price})`).join('\n');
    let message = `🚨 *New Order Received!*\n\n` +
                  `*Customer:* ${orderData.customer_name}\n` +
                  `*Mobile:* ${orderData.mobile}\n` +
                  `*Address:* ${orderData.address}\n\n` +
                  `*Items:*\n${itemsText}\n\n` +
                  `*Total:* $${orderData.total_amount}`;

    await bot.telegram.sendMessage(vendor.telegram_id, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback(`✅ Accept Order`, `vendor_accept_${orderData.id}`)],
            [Markup.button.callback(`❌ Reject Order`, `vendor_reject_${orderData.id}`)]
        ])
    });
}

// Vendor Accepts Order -> Push to Riders
bot.action(/vendor_accept_(\d+)/, async (ctx) => {
    const orderId = ctx.match[1];
    await ctx.editMessageText(`Order Accepted. Broadcasting to nearby riders...`);

    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!order) return;

    const { data: riders } = await supabase.from('riders').select('telegram_id').eq('status', 'Available');
    if (!riders || riders.length === 0) {
        return ctx.reply('⚠️ No available riders found right now.');
    }

    riders.forEach(async (rider) => {
        await bot.telegram.sendMessage(rider.telegram_id, `📦 *New Delivery Job Available!*\n\n*Restaurant:* ${order.restaurant_name}\n*Delivery Address:* ${order.address}`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback(`Accept Delivery`, `rider_accept_${order.id}`)]
            ])
        });
    });
});

// Rider Accepts Delivery
bot.action(/rider_accept_(\d+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const { error } = await supabase.from('orders').update({ status: 'Out for Delivery' }).eq('id', orderId);

    if (error) {
        return ctx.reply('⚠️ This order was already accepted by another rider.');
    }

    await ctx.editMessageText(`🎉 You have successfully accepted Delivery Job #${orderId}. Please proceed to restaurant.`);
});

bot.launch();
console.log('FoodHub Telegram Bot is running successfully...');
