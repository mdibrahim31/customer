const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const FormData = require('form-data');

// Initialize Telegram Bot with Environment Variable
const bot = new Telegraf(process.env.BOT_TOKEN);

// Initialize Supabase Client with Environment Variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Define Supabase Storage bucket name
const BUCKET_NAME = 'images';

bot.on('photo', async (ctx) => {
    try {
        await ctx.reply('📥 Downloading and processing your image...');

        // 1. Get the highest resolution photo from the array
        const photos = ctx.message.photo;
        const largestPhoto = photos[photos.length - 1];
        const fileId = largestPhoto.file_id;

        // Get caption if provided, otherwise default to "Telegram Post"
        const caption = ctx.message.caption || 'Telegram Post';

        // 2. Get file path from Telegram servers
        const fileLink = await ctx.telegram.getFileLink(fileId);
        
        const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        const fileBuffer = Buffer.from(response.data);

        // Generate a unique file name
        const fileName = `bot_${Date.now()}.jpg`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, fileBuffer, {
                contentType: 'image/jpeg',
                upsert: false
            });

        if (uploadError) {
            throw new Error(`Storage Error: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fileName);

        const publicImageUrl = publicUrlData.publicUrl;

        const { data: insertData, error: insertError } = await supabase
            .from('posts')
            .insert([
                {
                    title: caption,
                    description: 'Uploaded via Telegram Bot',
                    image_url: publicImageUrl
                }
            ]);

        if (insertError) {
            throw new Error(`Database Error: ${insertError.message}`);
        }

        // 3. Confirm success back to user
        await ctx.reply('✅ Success! Image uploaded to Supabase and added to your website gallery.');

    } catch (err) {
        console.error('Error processing photo:', err);
        await ctx.reply(`❌ Failed to upload: ${err.message}`);
    }
});

bot.launch().then(() => {
    console.log('🤖 Telegram bot is running and listening for images...');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
