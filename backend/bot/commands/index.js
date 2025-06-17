const logger = require('@/utils/logger');
const utils = require('@/utils');
const flood = require('@/utils/attack');
const { SignConfig, Method} = require('@/database/models');
const { redeemCardKey } = require('@/utils/cardkey');
const users = require('@/utils/users');   // 用统一的 user 工具

function isURL(target) {
    return target.startsWith('http://') || target.startsWith('https://');
}

const commands = {
    hello: {
        aliases: ['hello'],
        description: 'Powered By @Core_888',
        adminOnly: false,
        async execute(ctx) {
            const userId = ctx.from.id;
            const chatId = ctx.chat.id;
            await ctx.reply(
                `Powered By @Core_888\n你的用户ID: <code>${userId}</code>\n群组ID: <code>${chatId}</code>`,
                { parse_mode: 'HTML' }
            );
        }
    },

    register: {
        aliases: ['reg', 'register'],
        description: '注册账号',
        adminOnly: false,
        async execute(ctx) {
            const tg_uid = ctx.from.id.toString();
            const username = ctx.from.username || '';
            const { created } = await users.registerUser({ tg_uid, username });
            if (created) {
                return ctx.reply('🎉 注册成功！欢迎使用本地机器人。');
            } else {
                return ctx.reply('✅ 你已注册过账号！');
            }
        }
    },

    sign: {
        aliases: ['sign', '签到', 'qiandao'],
        description: '每日签到领取积分（未注册自动注册）',
        adminOnly: false,
        async execute(ctx) {
            const tg_uid = ctx.from.id.toString();
            const username = ctx.from.username || '';
            // 自动注册
            let { user } = await users.registerUser({ tg_uid, username });

            // 获取配置
            let conf = await SignConfig.findOne();

            // 判断今天是否已签到
            const now = new Date();
            const lastSign = user.last_sign_time;

            if (utils.isSamePeriod(lastSign, now, conf.mode)) {
                if (conf.mode === '24h') {
                    // 24h模式提示剩余时间
                    const ms = 24 * 60 * 60 * 1000 - (now - new Date(lastSign));
                    const leftHour = Math.floor(ms / 3600000);
                    const leftMin = Math.floor((ms % 3600000) / 60000);
                    return ctx.reply(`⏳ 你已签到，距离下次签到还剩：${leftHour}小时${leftMin}分钟`);
                } else {
                    return ctx.reply('📅 你今天已经签到过啦！明天再来吧～');
                }
            }

            // 动态奖励
            const reward = utils.getReward(conf.point_mode, conf.point_amount);

            user.point = (user.point || 0) + reward;
            user.last_sign_time = now;
            await user.save();

            return ctx.reply(
                `✅ 签到成功！获得积分：${reward}\n累计积分：${user.point}`
            );
        }
    },

    attack: {
        aliases: ['attack', 'atk'],
        description: '发起攻击：/attack target [port] time method slot',
        adminOnly: true,
        async execute(ctx, args) {
            if (args.length < 4) {
                return ctx.reply('❌ 参数不足\n格式: /attack <target> [port] <time> <method> <slot>');
            }

            const target = args[0];
            let port, time, method, slot;

            if (isURL(target)) {
                if (args.length < 4) {
                    return ctx.reply('❌ URL 模式下需提供 4 个参数: /attack <url> <time> <method> <slot>');
                }
                [time, method, slot] = args.slice(1);
            } else {
                if (args.length < 5) {
                    return ctx.reply('❌ IP 模式下需提供 5 个参数: /attack <ip> <port> <time> <method> <slot>');
                }
                [port, time, method, slot] = args.slice(1);
            }

            try {
                // 拿到用户
                const user = await users.findUserByTgId(ctx.from.id.toString());
                if (!user) return ctx.reply('请先注册账号再使用该功能。');

                const methods = await Method.findOne({ where: { name: method, status: 'active' } });
                if (!methods) return ctx.reply('❌不支持的方法');

                // 判断是否会员
                const isVip = await users.isMember(user.id);
                let max_time, max_concurrency;

                if (isVip) {
                    // 会员按套餐
                    const plan = await users.getUserPlan(user.id);
                    if (!plan) return ctx.reply('套餐信息异常，请联系管理员');
                    max_time = plan.max_time;
                    max_concurrency = plan.max_concurrency;
                    // time/slot 取两者最小
                    time = Math.min(Number(time), max_time);
                    slot = Math.min(Number(slot), max_concurrency);
                } else {
                    // 非会员：积分判断
                    // 可选：每次消耗多少积分，或 Method 定价
                    const methodModel = await require('@/database/models/Method').findOne({ where: { name: method } });
                    const costPoint = methodModel && methodModel.point ? methodModel.point : 1;
                    if (user.point < costPoint) {
                        return ctx.reply(`积分不足，当前积分：${user.point}，该方法需 ${costPoint} 积分`);
                    }
                    // 扣除积分
                    await users.addPoint(user.id, -costPoint); // addPoint 支持负数就是扣除
                    // 也可以限制 time/slot 为最低（比如1或10），可按需改
                }

                const result = await flood.submitAttackTask({
                    user_id: user.id,
                    target,
                    port,
                    time,
                    method_name: method,
                    slot
                });
                await ctx.reply(result.message);
            } catch (e) {
                await ctx.reply('❌ ' + e.message);
            }
        }
    },

    redeem: {
        aliases: ['redeem', 'card', 'activate', '激活', '卡密'],
        description: '兑换卡密：/redeem <卡密>',
        adminOnly: false,
        async execute(ctx, args) {
            if (!args.length) {
                return ctx.reply('请输入需要激活的卡密。例如：/redeem xxxx');
            }
            const code = args[0].trim();
            try {
                const user = await users.findUserByTgId(ctx.from.id.toString());
                if (!user) return ctx.reply('你还没有注册账号，请先注册。');
                const res = await redeemCardKey(user.id, code);
                await ctx.reply(`🎫 ${res.message}`);
            } catch (err) {
                await ctx.reply('❌ 激活失败：' + (err.message || '未知错误'));
            }
        }
    },
};

module.exports = commands;
