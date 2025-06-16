const { DataTypes } = require('sequelize');
const { sequelize } = require('@/database');

const SignConfig = sequelize.define('SignConfig', {
    mode: {
        type: DataTypes.ENUM('24h', 'daily'),
        allowNull: false,
        defaultValue: 'daily',
        comment: '签到刷新机制：24h 或 每天0点'
    },
    point_mode: {
        type: DataTypes.ENUM('fixed', 'random'),
        allowNull: false,
        defaultValue: 'fixed',
        comment: '积分获取方式：fixed | random'
    },
    point_amount: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '10',
        comment: '积分值：如 10 或 15-30（字符串格式）'
    }
}, {
    tableName: 'SignConfig',
    timestamps: true
});

module.exports = SignConfig;
