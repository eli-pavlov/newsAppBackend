const { DataTypes } = require('sequelize');
const seqClient = require('../api/sequelizeClient');

if (!seqClient)
    return;

const Setting = seqClient.define(
    'Setting',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      data: {
        type: DataTypes.JSON,
        allowNull: false,
      },
    },
    {
      // Other model options go here
    },
);

module.exports = Setting;
