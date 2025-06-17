const fs = require('fs');
const path = require('path');
const basename = path.basename(__filename);

const models = {};

// 1. 先全部加载模型
fs.readdirSync(__dirname)
    .filter((file) =>
        file !== basename &&
        file.endsWith('.js')
    )
    .forEach((file) => {
        const model = require(path.join(__dirname, file));
        // 防止有 module.exports = {...} 不是 sequelize.define
        if (model && model.name) {
            models[model.name] = model;
        }
    });

if (models.Plan && models.User) {
    // User <-> Plan
    models.Plan.hasMany(models.User, { foreignKey: 'plan_id', sourceKey: 'id', as: 'users' });
    models.User.belongsTo(models.Plan, { foreignKey: 'plan_id', targetKey: 'id', as: 'plan' });
}


module.exports = models;
