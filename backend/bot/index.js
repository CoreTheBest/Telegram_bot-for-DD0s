const { Telegraf } = require('telegraf');
const { Data } = require('@/database/models');
const logger = require('@/utils/logger');
const commandMap = require('@/bot/commands');

let bot = null;
let authorizedGroups = [];

async function initBot() {
    logger.info('准备启动 Bot...');
    if (bot) await stopBot();

    const config = await Data.findOne();
    if (!config) throw new Error('❌ 配置记录不存在');

    const token = config.BOTTOKEN;
    const botAdmin = config.BOT_ADMIN;
    authorizedGroups = config.AUTHORIZED_GROUPS;

    bot = new Telegraf(token);

    // ✅ 遍历所有命令进行注册（支持别名 aliases）
    const registeredAliases = [];
    for (const [name, cmd] of Object.entries(commandMap)) {
        const aliases = cmd.aliases || [name];
        aliases.forEach((alias) => {
            bot.command(alias, async (ctx) => {
                const chatId = ctx.chat.id;
                const isAdmin = ctx.from.id.toString() === botAdmin;
                if (
                    Array.isArray(authorizedGroups) &&
                    authorizedGroups.length > 0 &&
                    !authorizedGroups.includes(chatId)
                ) {
                    return ctx.reply('⛔ 当前群未授权使用此机器人');
                }
                if (cmd.adminOnly && !isAdmin) {
                    return ctx.reply('⛔ 此命令仅管理员可用');
                }
                try {
                    await cmd.execute(ctx);
                } catch (err) {
                    logger.error(`命令 /${alias} 执行失败:`, err.message);
                    ctx.reply('❌ 命令执行出错');
                }
            });
            registeredAliases.push('/' + alias);
        });
    }
    if (registeredAliases.length > 0) {
        logger.info(`✅ 已注册命令 [ ${registeredAliases.join(' ')} ]`);
    }

    let launchFinished = false;
    bot.launch()
        .then(() => {
            launchFinished = true;
            logger.success('🤖 Bot 启动成功，命令系统就绪');
        })
        .catch(e => {
            logger.error('❌ Bot 启动失败:', e.message || e);
        });

    // 只做警告，不抛错
    setTimeout(() => {
        // if (!launchFinished) {
        //     logger.warn('⚠️ Bot 启动超过5秒，实际可能已启动，若能响应指令可忽略此警告。');
        // }
    }, 5000);

    // 如果你必须等待，可以用 launchFinished 轮询（一般不建议）
}

async function stopBot() {
    if (bot && bot.botInfo) {
        try {
            await bot.stop();
            logger.info('Bot 已停止');
        } catch (err) {
            logger.warn('Bot 停止时出错:', err.message);
        }
        bot = null;
    } else if (bot) {
        logger.warn('Bot 实例未启动，无需停止');
        bot = null;
    }
}

module.exports = {
    initBot,
    stopBot,
    getBot: () => bot
};
