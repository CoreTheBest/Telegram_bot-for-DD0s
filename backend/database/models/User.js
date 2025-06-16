const { DataTypes } = require('sequelize');
const { sequelize } = require('@/database');
const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    tg_uid: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    expire_time: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '会员到期时间'
    },
    plan_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '会员套餐ID'
    },

    last_sign_time: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '最近签到时间'
    },

    point: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '积分'
    },

    status: {
        type: DataTypes.ENUM('active', 'banned', 'expired'),
        defaultValue: 'active',
        allowNull: false,
        comment: '账号状态'
    },

    reg_time: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false,
        comment: '注册时间'
    }

}, {
    tableName: 'User',
    timestamps: false,
});


module.exports = User;
