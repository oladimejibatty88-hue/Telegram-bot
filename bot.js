require("./uptime");
const { Telegraf } = require("telegraf");
const express = require("express");
const { Pool } = require("pg");
const OpenAI = require("openai");
const ms = require("ms");

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS active_users (
            user_id BIGINT PRIMARY KEY,
            first_seen TIMESTAMP DEFAULT NOW(),
            last_seen TIMESTAMP DEFAULT NOW()
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS banned_users (
            user_id BIGINT PRIMARY KEY,
            banned_at TIMESTAMP DEFAULT NOW()
        )
    `);
}

async function trackUser(userId) {
    await pool.query(`
        INSERT INTO active_users (user_id, last_seen)
        VALUES ($1, NOW())
        ON CONFLICT (user_id) DO UPDATE SET last_seen = NOW()
    `, [userId]);
}

async function getActiveUserCount() {
    const result = await pool.query(`SELECT COUNT(*) FROM active_users`);
    return result.rows[0].count;
}

async function getAllActiveUsers() {
    const result = await pool.query(`SELECT user_id FROM active_users`);
    return result.rows.map(r => r.user_id);
}

async function banUser(userId) {
    await pool.query(`INSERT INTO banned_users (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
}

async function unbanUser(userId) {
    await pool.query(`DELETE FROM banned_users WHERE user_id = $1`, [userId]);
}

async function isUserBanned(userId) {
    const result = await pool.query(`SELECT 1 FROM banned_users WHERE user_id = $1`, [userId]);
    return result.rows.length > 0;
}

async function getAllBannedUsers() {
    const result = await pool.query(`SELECT user_id FROM banned_users`);
    return result.rows.map(r => r.user_id);
}

initDatabase().catch(console.error);

const app = express();
const PORT = process.env.PORT || 5000;
app.get("/", (req, res) => {
    res.send("Bot is running!");
});
app.listen(PORT, () => {
    console.log("Uptime server running on port " + PORT);
});

if (!process.env.BOT_TOKEN) {
    console.error("ERROR: BOT_TOKEN environment variable is not set!");
    process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

let botActive = true;

const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 0;
let users = new Set();

function isAdmin(ctx) {
    return ctx.from.id === ADMIN_ID;
}

bot.use((ctx, next) => {
    if (ctx.from && ctx.from.id) {
        users.add(ctx.from.id);
    }
    return next();
});

const commands = {
    start: "Start the bot",
    help: "Show help info",
    menu: "Show full command list",
    ping: "Check bot speed",
    time: "Get current time",
    date: "Get today's date",
    id: "Get your Telegram ID",
    math: "Random math fact",
    joke: "Random joke",
    fact: "Random fact",
    quote: "Random quote",
    alive: "Check if bot is alive",
    echo: "Repeat your message",
    reverse: "Reverse text",
    upper: "Text to uppercase",
    lower: "Text to lowercase",
    avatar: "Get your profile photo",
    random: "Random number",
    roll: "Dice roll",
    flip: "Coin flip",
    choose: "Let bot choose between words",
    love: "Love percentage",
    hack: "Fake hack",
    vibe: "Random vibe check",
    emoji: "Random emoji",
    calc: "Simple calculator",
    weather: "Fake weather",
    ip: "Fake IP check",
    about: "About the bot",
    owner: "Bot owner info",
    roast: "Roast someone",
    bless: "Bless someone",
    cat: "Random cat",
    dog: "Random dog",
    anime: "Random anime quote",
    game: "Random game name",
    movie: "Random movie name",
    rate: "Rate anything",
    ask: "Ask the bot anything",
    secret: "Random secret",
    active: "Show active users count",
    shutdown: "Shutdown bot (Admin only)",
    broadcast: "Send message to all users (Admin)",
    ban: "Ban a user (Admin only)",
    unban: "Unban a user (Admin only)",
    kick: "Kick a user (Admin only)",
    listbanned: "List banned users (Admin only)",
    poweron: "Check if bot is running (Admin only)",
    stats: "Bot stats (Admin only)",
    clear: "Delete last 5 messages (Admin only)",
    trt: "Translate message to English (reply to msg)",
    short: "Shorten a URL",
    tagall: "Tag everyone (Admin only)",
    mute: "Timed mute (e.g., /mute 10m) (Admin only)",
    unmute: "Unmute a user (Admin only, reply to msg)",
    animeclips: "Get anime clips link"
};

function generateMenu() {
    let msg = "📜 *BOT COMMANDS*\n\n";
    Object.keys(commands).forEach(c => {
        msg += `/${c} - ${commands[c]}\n`;
    });
    return msg;
}

bot.start(ctx => ctx.reply("🔥 Bot started! Use /menu to view all commands."));
bot.help(ctx => ctx.reply("Use /menu to see the full list of commands."));
bot.command("menu", ctx => ctx.replyWithMarkdown(generateMenu()));

bot.command("ping", ctx => ctx.reply("🏓 Pong!"));
bot.command("time", ctx => ctx.reply(new Date().toLocaleTimeString()));
bot.command("date", ctx => ctx.reply(new Date().toDateString()));
bot.command("id", ctx => ctx.reply(`🪪 Your ID: ${ctx.from.id}`));
bot.command("math", ctx => ctx.reply("➗ Math fact: Zero is the only number that can't be divided."));
bot.command("joke", ctx => ctx.reply("😂 Why don't robots panic? Because they have nerves of steel."));
bot.command("fact", ctx => ctx.reply("📘 Fact: Honey never spoils."));
bot.command("quote", ctx => ctx.reply("💬 'Stay hungry, stay foolish.'"));
bot.command("alive", ctx => ctx.reply("🔥 I'm alive boss!"));
bot.command("echo", ctx => ctx.reply(ctx.message.text.replace("/echo ", "")));

bot.command("reverse", ctx => {
    const t = ctx.message.text.replace("/reverse ", "");
    ctx.reply(t.split("").reverse().join(""));
});
bot.command("upper", ctx => ctx.reply(ctx.message.text.replace("/upper ", "").toUpperCase()));
bot.command("lower", ctx => ctx.reply(ctx.message.text.replace("/lower ", "").toLowerCase()));
bot.command("avatar", ctx => ctx.reply("⚠️ Telegram doesn't allow fetching profile pics via bot."));
bot.command("random", ctx => ctx.reply("🎲 " + Math.floor(Math.random() * 100)));
bot.command("roll", ctx => ctx.reply("🎲 You rolled: " + (1 + Math.floor(Math.random() * 6))));
bot.command("flip", ctx => ctx.reply(["🪙 Heads!", "🪙 Tails!"][Math.floor(Math.random()*2)]));
bot.command("choose", ctx => {
    const parts = ctx.message.text.replace("/choose ", "").split(" ");
    ctx.reply("🤖 I choose: " + parts[Math.floor(Math.random() * parts.length)]);
});
bot.command("love", ctx => ctx.reply("❤️ Love level: " + Math.floor(Math.random() * 100) + "%"));
bot.command("hack", ctx => ctx.reply("💻 Hacking... 0% ▓▓▓▓ 100% DONE 😂"));
bot.command("vibe", ctx => ctx.reply("💫 Vibe: " + ["Chill", "Angry", "Happy", "Tired"][Math.floor(Math.random()*4)]));
bot.command("emoji", ctx => ctx.reply(["😀","🔥","⚡","💀","💎","👻","🤖"][Math.floor(Math.random()*7)]));
bot.command("calc", ctx => {
    try {
        const expr = ctx.message.text.replace("/calc ", "");
        const safeExpr = expr.replace(/[^0-9+\-*/().]/g, '');
        ctx.reply("🧮 Result: " + eval(safeExpr));
    } catch {
        ctx.reply("❌ Invalid expression.");
    }
});
bot.command("weather", ctx => ctx.reply("🌤️ Weather: Sunny 29°C"));
bot.command("ip", ctx => ctx.reply("🌍 Fake IP: 192.168.0." + Math.floor(Math.random()*255)));
bot.command("about", ctx => ctx.reply("🤖 A multipurpose Telegram bot made by you."));
bot.command("owner", ctx => ctx.reply("👑 Owner: YOU!"));
bot.command("roast", ctx => ctx.reply("🔥 You look like WiFi with weak signal 😂"));
bot.command("bless", ctx => ctx.reply("✨ You are blessed bro."));
bot.command("cat", ctx => ctx.reply("🐱 Meow! (image coming soon)"));
bot.command("dog", ctx => ctx.reply("🐶 Woof!"));
bot.command("anime", ctx => ctx.reply("🎌 'People die if they are killed.' – Shirou"));
bot.command("game", ctx => ctx.reply("🎮 Random game: Apex Legends"));
bot.command("movie", ctx => ctx.reply("🎬 Movie: Interstellar"));
bot.command("rate", ctx => {
    const t = ctx.message.text.replace("/rate ", "");
    ctx.reply(`⭐ I rate *${t}* — ${Math.floor(Math.random()*10)}/10`);
});
bot.command("ask", async (ctx) => {
    const question = ctx.message.text.replace("/ask ", "").trim();
    if (!question || question === "/ask") {
        return ctx.reply("❓ Please provide a question. Example: /ask What is the meaning of life?");
    }
    
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [{ role: "user", content: question }],
        });
        ctx.reply(response.choices[0].message.content);
    } catch (err) {
        console.error("OpenAI error:", err);
        ctx.reply("⚠️ Sorry, I couldn't process your question. Please try again later.");
    }
});
bot.command("secret", ctx => ctx.reply("🤫 Secret: You are awesome. Don't tell anyone."));

bot.command("active", (ctx) => {
    const activeUsers = Array.from(users).join("\n");
    if (activeUsers.length === 0) return ctx.reply("❌ No active users.");
    ctx.reply(`👥 Active users:\n${activeUsers}`);
});

bot.command("shutdown", (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ You are not authorized.");
    botActive = false;
    ctx.reply("⚠️ Bot is now OFF. Use /poweron to turn it back ON.");
});

bot.command("broadcast", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ You are not authorized.");
    const msg = ctx.message.text.replace("/broadcast ", "");
    if (!msg || msg === "/broadcast") return ctx.reply("❌ Specify a message: /broadcast <message>");
    const users = await getAllActiveUsers();
    let sent = 0;
    for (const userId of users) {
        try {
            await ctx.telegram.sendMessage(userId, `📢 Admin broadcast:\n${msg}`);
            sent++;
        } catch (e) {}
    }
    ctx.reply(`✅ Broadcast sent to ${sent} users!`);
});

bot.command("ban", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ You are not authorized.");
    const userId = parseInt(ctx.message.text.replace("/ban ", ""));
    if (!userId) return ctx.reply("❌ Specify a user ID: /ban <id>");
    await banUser(userId);
    ctx.reply(`🚫 User ${userId} is now banned.`);
});

bot.command("unban", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ You are not authorized.");
    const userId = parseInt(ctx.message.text.replace("/unban ", ""));
    if (!userId) return ctx.reply("❌ Specify a user ID: /unban <id>");
    await unbanUser(userId);
    ctx.reply(`✅ User ${userId} is now unbanned.`);
});

bot.command("kick", (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ You are not authorized.");
    const userId = parseInt(ctx.message.text.replace("/kick ", ""));
    if (!userId) return ctx.reply("❌ Specify a user ID: /kick <id>");
    ctx.reply(`👢 User ${userId} has been kicked (simulated).`);
});

bot.command("listbanned", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ You are not authorized.");
    const banned = await getAllBannedUsers();
    ctx.reply(`🚫 Banned users:\n${banned.join("\n") || "None"}`);
});

bot.command("poweron", (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ You are not authorized.");
    botActive = true;
    ctx.reply("⚡ Bot is now ON ✅");
});

bot.command("stats", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ You are not authorized.");
    const count = await getActiveUserCount();
    ctx.reply(`📊 BOT STATS\nUsers: ${count}\nStatus: ${botActive ? "ON" : "OFF"}`);
});

bot.command("clear", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const chatId = ctx.chat.id;
    for (let i = 0; i < 5; i++) {
        try {
            await ctx.telegram.deleteMessage(chatId, ctx.message.message_id - i);
        } catch {}
    }
});

bot.command("trt", async (ctx) => {
    if (!ctx.message.reply_to_message) {
        return ctx.reply("❌ Reply to a message to translate it.");
    }

    const originalText = ctx.message.reply_to_message.text;

    if (!originalText) {
        return ctx.reply("❌ That message has no text to translate.");
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [
                {
                    role: "system",
                    content: "Translate the following text to English. Only return the translation."
                },
                {
                    role: "user",
                    content: originalText
                }
            ],
            max_completion_tokens: 200
        });

        const translated = response.choices[0].message.content.trim();

        ctx.reply(`🇬🇧 *Translation:*\n${translated}`, {
            parse_mode: "Markdown"
        });

    } catch (err) {
        console.error("Translate error:", err);
        ctx.reply("⚠️ Translation failed.");
    }
});

bot.command("short", (ctx) => {
    const url = ctx.message.text.split(" ")[1];
    if (!url) return ctx.reply("❌ Usage: /short https://example.com");
    ctx.reply(`🔗 Shortened:\nhttps://tinyurl.com/api-create.php?url=${url}`);
});

bot.command("tagall", (ctx) => {
    if (!isAdmin(ctx)) return;
    ctx.reply("📣 @everyone");
});

bot.command("mute", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ Admin only");

    if (!ctx.message.reply_to_message)
        return ctx.reply("❌ Reply to a user to mute");

    const userId = ctx.message.reply_to_message.from.id;
    const muteTime = ctx.message.text.split(" ")[1];

    if (!muteTime || isNaN(ms(muteTime))) {
        return ctx.reply("❌ Usage: /mute [duration] (e.g., /mute 10m)");
    }

    try {
        await ctx.telegram.restrictChatMember(ctx.chat.id, userId, {
            permissions: { can_send_messages: false }
        });

        ctx.reply(`🔇 User muted for ${muteTime}`);

        setTimeout(async () => {
            await ctx.telegram.restrictChatMember(ctx.chat.id, userId, {
                permissions: { can_send_messages: true }
            });
            ctx.reply(`🔊 User unmuted after ${muteTime}`);
        }, ms(muteTime));
    } catch (err) {
        console.error("Mute error:", err);
        ctx.reply("❌ Failed to mute user");
    }
});

bot.command("unmute", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ Admin only");

    if (!ctx.message.reply_to_message)
        return ctx.reply("❌ Reply to the user you want to unmute");

    const userId = ctx.message.reply_to_message.from.id;

    try {
        await ctx.telegram.restrictChatMember(ctx.chat.id, userId, {
            permissions: {
                can_send_messages: true,
                can_send_media_messages: true,
                can_send_polls: true,
                can_send_other_messages: true,
                can_add_web_page_previews: true
            }
        });
        ctx.reply("🔊 User unmuted");
    } catch (err) {
        console.error("Unmute error:", err);
        ctx.reply("❌ Failed to unmute user");
    }
});

bot.command("animeclips", (ctx) => {
    ctx.reply("🔥 Check out anime clips here: https://hiitwixtor.com/");
});

bot.on("text", async (ctx) => {
    if (!botActive && !isAdmin(ctx)) return;
    if (await isUserBanned(ctx.from.id)) return;
    trackUser(ctx.from.id).catch(console.error);
});

bot.launch();
console.log("Bot is running...");

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
