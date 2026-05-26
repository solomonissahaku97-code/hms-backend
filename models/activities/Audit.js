const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const Audit = sequelize.define("Audit", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'CREATE, UPDATE, DELETE, LOGIN, etc.'
  },
  target: {
    type: DataTypes.STRING, // e.g., "Expense", "Billing", "Staff"
    allowNull: true,
  },
  targetId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID of the affected record'
  },
  actorType: {
    type: DataTypes.ENUM("staff", "admin", "system"),
    allowNull: false,
    defaultValue: "staff"
  },
  actorId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  actorName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Cached actor name for easier querying'
  },
  // What changed
  oldValues: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Previous values before change'
  },
  newValues: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'New values after change'
  },
  changes: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Summary of what fields changed'
  },
  // Context
  ipAddress: {
    type: DataTypes.STRING(45), // IPv6 support
    allowNull: true,
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  requestUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  requestMethod: {
    type: DataTypes.STRING(10), // GET, POST, PUT, DELETE
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM("success", "failure"),
    defaultValue: "success"
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional context data'
  }
}, { 
  timestamps: true,
  indexes: [
    {
      fields: ['action']
    },
    {
      fields: ['target']
    },
    {
      fields: ['actorType', 'actorId']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// Associations - Better approach for polymorphic associations
Audit.associate = (models) => {
  // Since it's polymorphic, we don't enforce foreign key constraints
  // But we can still define the association for querying
  Audit.belongsTo(models.Staff, {
    foreignKey: 'actorId',
    constraints: false,
    as: 'staffActor'
  });
  
  Audit.belongsTo(models.Admin, {
    foreignKey: 'actorId', 
    constraints: false,
    as: 'adminActor'
  });
};

// Instance methods
Audit.prototype.getActor = function() {
  if (this.actorType === 'staff' && this.staffActor) {
    return this.staffActor;
  } else if (this.actorType === 'admin' && this.adminActor) {
    return this.adminActor;
  }
  return null;
};

// Static methods for common queries
Audit.findByTarget = function(target, targetId) {
  return this.findAll({
    where: { target, targetId },
    order: [['createdAt', 'DESC']]
  });
};

Audit.findByActor = function(actorType, actorId, options = {}) {
  return this.findAll({
    where: { actorType, actorId },
    order: [['createdAt', 'DESC']],
    ...options
  });
};

module.exports = Audit;