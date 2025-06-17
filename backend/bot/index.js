const { Telegraf } = require('telegraf');
const { Data } = require('@/database/models');
const logger = require('@/utils/logger');
const commandMap = require('@/bot/commands');

let bot = null;
let authorizedGroups = [];
let botStatus = { ready: false, username: '' };
let isBotStarting = false;

async function initBot() {
    if (isBotStarting) {
        logger.warn('Bot 正在启动中，请勿重复启动');
        return;
    }
    isBotStarting = true;
    logger.info('准备启动 Bot...');
    try {
        if (bot) await stopBot();

        const config = await Data.findOne();
        if (!config) throw new Error('❌ 配置记录不存在');
        const token = config.BOTTOKEN;
        const botAdmin = config.BOT_ADMIN;
        authorizedGroups = config.AUTHORIZED_GROUPS;

        bot = new Telegraf(token);

        // 注册命令
        const registeredAliases = [];
        for (const [name, cmd] of Object.entries(commandMap)) {
            const aliases = cmd.aliases || [name];
            aliases.forEach((alias) => {
                bot.command(alias, async (ctx) => {
                    const chatId = ctx.chat.id;
                    const isAdmin = ctx.from.id.toString() === botAdmin;
                    if (
                        ctx.chat.type !== 'private' &&
                        Array.isArray(authorizedGroups) &&
                        authorizedGroups.length > 0 &&
                        !authorizedGroups.map(String).includes(String(chatId))
                    ) {
                        return ctx.reply('⛔ 当前群未授权使用此机器人');
                    }
                    if (cmd.adminOnly && !isAdmin) {
                        return ctx.reply('⛔ 此命令仅管理员可用');
                    }
                    const text = ctx.message.text || '';
                    const split = text.trim().split(/\s+/);
                    const args = split.slice(1);
                    try {
                        await cmd.execute(ctx, args);
                    } catch (err) {
                        logger.error(`命令 /${alias} 执行失败:`, err && err.message);
                        ctx.reply('❌ 命令执行出错');
                    }
                });
                registeredAliases.push('/' + alias);
            });
        }
        if (registeredAliases.length > 0) {
            logger.info(`✅ 已注册命令 [ ${registeredAliases.join(' ')} ]`);
        }

        // 初始化状态
        botStatus.ready = false;
        botStatus.username = '';

        // 1. 检查 bot token 是否可用
        let me = null;
        try {
            me = await bot.telegram.getMe();
        } catch (e) {
            throw new Error('获取 Bot 账号信息失败，请检查 Token 或网络: ' + (e && e.message));
        }

        if (!me || !me.username) {
            throw new Error('Bot getMe 返回结果异常，无法获取 username');
        }

        botStatus.ready = true;
        botStatus.username = me.username;
        logger.success(`🤖 Bot (@${me.username}) 已上线`);

        // 2. 真正启动 polling
        try {
            await bot.launch();
        } catch (e) {
            botStatus.ready = false;
            botStatus.username = '';
            throw new Error('Bot polling 启动失败: ' + (e && e.message));
        }

    } catch (e) {
        botStatus.ready = false;
        botStatus.username = '';
        logger.error('❌ Bot 启动失败: ' + (e && e.message));
    } finally {
        isBotStarting = false;
        logger.info('[initBot] finally 执行完毕, isBotStarting=false');
    }
}

// 停止 bot
async function stopBot() {
    if (bot && bot.botInfo) {
        try {
            await bot.stop();
            logger.info('Bot 已停止');
        } catch (err) {
            logger.warn('Bot 停止时出错:', err && err.message);
        }
        bot = null;
        botStatus.ready = false;
        botStatus.username = '';
    } else if (bot) {
        logger.warn('Bot 实例未启动，无需停止');
        bot = null;
        botStatus.ready = false;
        botStatus.username = '';
    }
}

// 获取 bot 实例
function getBot() {
    return bot;
}

// 获取 bot 状态
function getBotStatus() {
    return { ...botStatus };
}

module.exports = {
    initBot,
    stopBot,
    getBot,
    getBotStatus,
};
