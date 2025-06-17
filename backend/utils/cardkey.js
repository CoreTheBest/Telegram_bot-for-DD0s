const { CardKey, User, Plan } = require('@/database/models');
const { sequelize } = require('@/database');
const { nanoid } = require('nanoid');

/**
 * 批量生成卡密
 * @param {'plan'|'point'} type
 * @param {Object} options
 *    - plan_id: number  // type=plan时需要
 *    - point: number    // type=point时需要
 *    - count: number    // 生成数量
 *    - prefix: string   // 前缀（可选）
 *    - length: number   // 主码长度，不含前缀（可选，默认16）
 * @returns {Promise<string[]>}
 */
async function generateCardKeys(type, options) {
    const { plan_id, point, count = 1, prefix = '', length = 16 } = options;
    const keys = [];
    for (let i = 0; i < count; ++i) {
        const codeBody = nanoid(length);
        const code = prefix + codeBody;
        await CardKey.create({
            code,
            prefix,
            length,
            type,
            plan_id: type === 'plan' ? plan_id : null,
            point: type === 'point' ? point : null,
        });
        keys.push(code);
    }
    return keys;
}

/**
 * 兑换卡密
 * @param {number} user_id
 * @param {string} code
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function redeemCardKey(user_id, code) {
    const card = await CardKey.findOne({ where: { code, status: 'unused' } });
    if (!card) throw new Error('卡密无效或已被使用');

    // 事务确保并发安全
    await sequelize.transaction(async (t) => {
        await card.reload({ lock: t.LOCK.UPDATE, transaction: t });

        if (card.status !== 'unused') throw new Error('卡密已被使用');

        if (card.type === 'plan') {
            // 动态获取套餐时长 period
            let periodDays = 30;
            if (card.plan_id) {
                const plan = await Plan.findByPk(card.plan_id);
                if (plan && plan.period) periodDays = plan.period;
            }
            const now = new Date();
            const expire = new Date(now.getTime() + periodDays * 24 * 3600 * 1000);

            await User.update(
                { plan_id: card.plan_id, is_member: true, expire_time: expire },
                { where: { id: user_id }, transaction: t }
            );
        } else if (card.type === 'point') {
            await User.increment('point', { by: card.point, where: { id: user_id }, transaction: t });
        }

        await card.update({ status: 'used', used_by: user_id, used_time: new Date() }, { transaction: t });
    });

    return { success: true, message: '兑换成功！' };
}

module.exports = {
    generateCardKeys,
    redeemCardKey,
};
