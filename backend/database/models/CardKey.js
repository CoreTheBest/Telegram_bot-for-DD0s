const { DataTypes } = require('sequelize');
const { sequelize } = require('@/database');

const CardKey = sequelize.define('CardKey', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    code: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
        comment: '卡密码'
    },
    prefix: {
        type: DataTypes.STRING(16),
        allowNull: true,
        comment: '卡密前缀'
    },
    length: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 16,
        comment: '卡密位数'
    },
    type: {
        type: DataTypes.ENUM('plan', 'point'),
        allowNull: false,
        comment: '卡密类型(plan套餐/point积分)'
    },
    plan_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '套餐ID（type=plan时有效）'
    },
    point: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '积分数量（type=point时有效）'
    },
    status: {
        type: DataTypes.ENUM('unused', 'used'),
        allowNull: false,
        defaultValue: 'unused',
        comment: '使用状态'
    },
    used_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '使用者用户ID'
    },
    used_time: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '使用时间'
    }
}, {
    tableName: 'CardKey',
    timestamps: true,
});

module.exports = CardKey;
