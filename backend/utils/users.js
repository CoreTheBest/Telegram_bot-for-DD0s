// /utils/users.js

const { User, Plan } = require('@/database/models');

/** 根据tg_uid查用户 */
async function findUserByTgId(tg_uid) {
    return await User.findOne({ where: { tg_uid: tg_uid.toString() } });
}

/** 注册用户（已存在则返回已存在用户） */
async function registerUser({ tg_uid, username }) {
    tg_uid = tg_uid.toString();
    let user = await findUserByTgId(tg_uid);
    if (user) return { created: false, user };
    user = await User.create({
        tg_uid,
        username: username || '',
        reg_time: new Date(),
        point: 0,
        status: 'active'
    });
    return { created: true, user };
}

/** 判断用户是否已注册 */
async function isUserRegistered(tg_uid) {
    const user = await findUserByTgId(tg_uid);
    return !!user;
}

/** 给用户加积分 */
async function addPoint(userId, amount) {
    await User.increment('point', { by: amount, where: { id: userId } });
}

/** 设置套餐 */
async function setPlan(userId, plan_id, expire_time) {
    await User.update({ plan_id, expire_time, is_member: true }, { where: { id: userId } });
}

/** 封禁/解封用户 */
async function banUser(userId) {
    await User.update({ status: 'banned' }, { where: { id: userId } });
}
async function unbanUser(userId) {
    await User.update({ status: 'active' }, { where: { id: userId } });
}

/** 判断是否会员 */
async function isMember(userId) {
    const user = await User.findByPk(userId);
    if (!user) return false;
    return user.plan_id && user.expire_time && new Date(user.expire_time) > new Date();
}

/** 获取用户套餐（含套餐名等） */
async function getUserPlan(userId) {
    const user = await User.findByPk(userId);
    if (!user || !user.plan_id) return null;
    const plan = await Plan.findByPk(user.plan_id);
    return plan;
}


// 可以继续加：自动注册、签到逻辑、积分扣减、查询所有用户、统计等

module.exports = {
    findUserByTgId,
    registerUser,
    isUserRegistered,
    addPoint,
    setPlan,
    banUser,
    unbanUser,
    isMember,
    getUserPlan,
    // ...更多自定义方法
};
