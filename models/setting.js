const { DataTypes } = require('sequelize');
const seqClient = require('../services/sequelizeClient');

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
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
      onDelete: 'CASCADE',     
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
