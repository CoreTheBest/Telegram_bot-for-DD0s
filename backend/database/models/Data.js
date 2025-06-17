const { DataTypes } = require('sequelize');
const { sequelize } = require('@/database');

const Data = sequelize.define('Data', {
    BOTTOKEN: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ''
    },
    BOT_ADMIN: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ''
    },
    AUTHORIZED_GROUPS: {
        type: DataTypes.TEXT, // 存字符串，读/写自动转数组
        allowNull: false,
        defaultValue: '[]',
        get() {
            const rawValue = this.getDataValue('AUTHORIZED_GROUPS');
            try {
                return JSON.parse(rawValue || '[]');
            } catch {
                return [];
            }
        },
        set(val) {
            this.setDataValue(
                'AUTHORIZED_GROUPS',
                Array.isArray(val) ? JSON.stringify(val) : '[]'
            );
        }
    }
}, {
    tableName: 'Data',
    timestamps: true
});

module.exports = Data;
