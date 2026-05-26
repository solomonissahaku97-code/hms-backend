const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Subscription = require('./subscription');
const Institution = require('./institution');

const InstitutionSubscription = sequelize.define(
  'institutionSubscription',
  {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
    },

    institutionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution,
            key: 'id',
        },
    },

    subscriptionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Subscription,
            key: 'id',
        },
    },

    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'institution_subscriptions',
    timestamps: true,
    hooks: {
      beforeCreate: async (institutionSubscription, options) => {
        const subscription = await sequelize.models.subscription.findByPk(
          institutionSubscription.subscriptionId
        );
        if (subscription) {
          // Calculate expiry date based on subscription duration
          institutionSubscription.expiryDate = new Date(
            new Date(institutionSubscription.startDate).getTime() +
              subscription.duration * 24 * 60 * 60 * 1000
          );
        } else {
          throw new Error('Invalid subscription ID.');
        }
      },
    },
  }
);

InstitutionSubscription.associations = (models) => {
  InstitutionSubscription.belongsTo(models.Institution, {
      foreignKey: 'institutionId', // Correct foreign key
      as: 'institution',
  }); 
  InstitutionSubscription.belongsTo(models.Subscription, {
      foreignKey: 'subscriptionId',
      as: 'subscription',
  });
};




module.exports = InstitutionSubscription;
