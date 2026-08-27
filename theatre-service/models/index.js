const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// ── Models ──────────────────────────────────────────────────────

const OperatingRoom = sequelize.define('OperatingRoom', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  room_number: { type: DataTypes.STRING, allowNull: false, unique: true },
  room_name: { type: DataTypes.STRING, allowNull: true },
  room_type: {
    type: DataTypes.ENUM('general','cardiac','neuro','orthopedic','vascular','ENT','ophthalmic','urology','plastic','trauma'),
    allowNull: false, defaultValue: 'general'
  },
  status: {
    type: DataTypes.ENUM('available','occupied','cleaning','maintenance','out_of_service'),
    allowNull: false, defaultValue: 'available'
  },
  current_patient_id: { type: DataTypes.UUID, allowNull: true },
  current_booking_id: { type: DataTypes.UUID, allowNull: true },
  capacity: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1 },
  equipment: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
  department_id: { type: DataTypes.UUID, allowNull: true },
  floor: { type: DataTypes.STRING, allowNull: true },
  building: { type: DataTypes.STRING, allowNull: true },
  is_emergency_available: { type: DataTypes.BOOLEAN, defaultValue: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'operating_rooms', timestamps: true, underscored: true });

const TheatrePatient = sequelize.define('TheatrePatients', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  visit_id: { type: DataTypes.UUID, allowNull: false },
  procedure_ids: { type: DataTypes.ARRAY(DataTypes.UUID), allowNull: false, defaultValue: [] },
  procedure_names: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true, defaultValue: [] },
  scheduled_date: { type: DataTypes.DATE, allowNull: true },
  scheduled_time: { type: DataTypes.TIME, allowNull: true },
  estimated_duration: { type: DataTypes.INTEGER, allowNull: true },
  actual_start_time: { type: DataTypes.DATE, allowNull: true },
  actual_end_time: { type: DataTypes.DATE, allowNull: true },
  room_id: { type: DataTypes.UUID, allowNull: true },
  surgeon_id: { type: DataTypes.UUID, allowNull: true },
  anaesthetist_id: { type: DataTypes.UUID, allowNull: true },
  scrub_nurse_id: { type: DataTypes.UUID, allowNull: true },
  circulating_nurse_id: { type: DataTypes.UUID, allowNull: true },
  diagnosis_id: { type: DataTypes.ARRAY(DataTypes.UUID), allowNull: false, defaultValue: [] },
  diagnosis_names: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true, defaultValue: [] },
  notes: { type: DataTypes.TEXT, allowNull: true },
  pre_op_notes: { type: DataTypes.TEXT, allowNull: true },
  intra_op_notes: { type: DataTypes.TEXT, allowNull: true },
  post_op_notes: { type: DataTypes.TEXT, allowNull: true },
  is_emergency: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  status: {
    type: DataTypes.ENUM('scheduled','pre-operation','intra-operation','post-operation','completed','cancelled','postponed'),
    allowNull: true, defaultValue: 'scheduled'
  },
  cancellation_reason: { type: DataTypes.TEXT, allowNull: true },
  cancellation_by: { type: DataTypes.UUID, allowNull: true },
  outcome: { type: DataTypes.STRING, allowNull: true, defaultValue: 'pending' },
  blood_loss_ml: { type: DataTypes.INTEGER, allowNull: true },
  specimens_collected: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  implants_used: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
  complications: { type: DataTypes.TEXT, allowNull: true },
  discharge_date: { type: DataTypes.DATE, allowNull: true },
  discharge_condition: { type: DataTypes.STRING, allowNull: true },
}, { tableName: 'theatre_patients', timestamps: true, underscored: true });

const CaseCart = sequelize.define('CaseCart', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  cart_number: { type: DataTypes.STRING, allowNull: false, unique: true },
  theatre_booking_id: { type: DataTypes.UUID, allowNull: true },
  visit_id: { type: DataTypes.UUID, allowNull: false },
  procedure: { type: DataTypes.STRING, allowNull: false },
  surgeon_id: { type: DataTypes.UUID, allowNull: true },
  surgeon_name: { type: DataTypes.STRING, allowNull: true },
  scheduled_date: { type: DataTypes.DATEONLY, allowNull: true },
  scheduled_time: { type: DataTypes.TIME, allowNull: true },
  status: {
    type: DataTypes.ENUM('not-started','in-progress','ready','confirmed','used','cancelled'),
    allowNull: false, defaultValue: 'not-started'
  },
  completion_percentage: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  assigned_to: { type: DataTypes.UUID, allowNull: true },
  assigned_to_name: { type: DataTypes.STRING, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  priority: { type: DataTypes.ENUM('low','normal','high','urgent'), allowNull: false, defaultValue: 'normal' },
  operating_room_id: { type: DataTypes.UUID, allowNull: true },
  confirmed_at: { type: DataTypes.DATE, allowNull: true },
  confirmed_by: { type: DataTypes.UUID, allowNull: true },
}, { tableName: 'case_carts', timestamps: true, underscored: true });

const CaseCartItem = sequelize.define('CaseCartItem', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  case_cart_id: { type: DataTypes.UUID, allowNull: true },
  name: { type: DataTypes.STRING, allowNull: true },
  category: {
    type: DataTypes.ENUM('implant','instrument','medication','supplies','equipment','specimen','other'),
    allowNull: true, defaultValue: 'other'
  },
  status: {
    type: DataTypes.ENUM('pending','ready','unavailable','used','returned'),
    allowNull: true, defaultValue: 'pending'
  },
  quantity: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1 },
  notes: { type: DataTypes.STRING, allowNull: true },
  location: { type: DataTypes.STRING, allowNull: true },
  prepared_by: { type: DataTypes.UUID, allowNull: true },
  prepared_at: { type: DataTypes.DATE, allowNull: true },
  item_type: { type: DataTypes.ENUM('inventory','custom'), allowNull: true, defaultValue: 'custom' },
  inventory_item_id: { type: DataTypes.UUID, allowNull: true },
  batch_number: { type: DataTypes.STRING, allowNull: true },
  expiry_date: { type: DataTypes.DATEONLY, allowNull: true },
}, { tableName: 'case_cart_items', timestamps: true, underscored: true });

const PreOpChecklist = sequelize.define('PreOpChecklist', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  visit_id: { type: DataTypes.UUID, allowNull: false },
  surgery_schedule_id: { type: DataTypes.UUID, allowNull: true },
  checklist_data: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  status: { type: DataTypes.ENUM('in-progress','completed'), defaultValue: 'in-progress' },
  completed_by: { type: DataTypes.UUID, allowNull: true },
  completed_at: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'pre_op_checklists', timestamps: true });

const TheatreEquipment = sequelize.define('TheatreEquipment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  serial_number: { type: DataTypes.STRING, allowNull: true, unique: true },
  model: { type: DataTypes.STRING, allowNull: true },
  category: {
    type: DataTypes.ENUM('imaging','monitoring','surgical','sterilization','anesthesia','support','other'),
    allowNull: false, defaultValue: 'other'
  },
  status: {
    type: DataTypes.ENUM('available','in-use','maintenance','retired','out-of-service'),
    allowNull: false, defaultValue: 'available'
  },
  room_id: { type: DataTypes.UUID, allowNull: true },
  purchase_date: { type: DataTypes.DATE, allowNull: true },
  warranty_expiry: { type: DataTypes.DATE, allowNull: true },
  last_maintenance_date: { type: DataTypes.DATE, allowNull: true },
  next_maintenance_date: { type: DataTypes.DATE, allowNull: true },
  maintenance_history: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
  notes: { type: DataTypes.TEXT, allowNull: true },
  is_portable: { type: DataTypes.BOOLEAN, defaultValue: false },
  manufacturer: { type: DataTypes.STRING, allowNull: true },
}, { tableName: 'theatre_equipment', timestamps: true, underscored: true });

const EducationalMaterial = sequelize.define('EducationMaterials', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  visit_id: { type: DataTypes.UUID, allowNull: false },
  surgery_schedule_id: { type: DataTypes.UUID, allowNull: true },
  materials_data: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  status: { type: DataTypes.ENUM('not-started','in-progress','completed'), defaultValue: 'not-started' },
  viewed_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  total_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  completed_by_staff: { type: DataTypes.UUID, allowNull: true },
  completed_at: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'education_materials', timestamps: true });

const PatientAllergy = sequelize.define('PatientAllergies', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  visit_id: { type: DataTypes.UUID, allowNull: false },
  allergies: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
  severity: { type: DataTypes.ENUM('mild','moderate','severe'), allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'patient_allergies', timestamps: false });

// ── Associations ────────────────────────────────────────────────

OperatingRoom.hasMany(TheatrePatient, { foreignKey: 'room_id', as: 'bookings' });
TheatrePatient.belongsTo(OperatingRoom, { foreignKey: 'room_id', as: 'operatingRoom' });

CaseCart.hasMany(CaseCartItem, { foreignKey: 'case_cart_id', as: 'items' });
CaseCartItem.belongsTo(CaseCart, { foreignKey: 'case_cart_id', as: 'caseCart' });

CaseCart.belongsTo(TheatrePatient, { foreignKey: 'theatre_booking_id', as: 'theatreBooking' });
CaseCart.belongsTo(OperatingRoom, { foreignKey: 'operating_room_id', as: 'operatingRoom' });

PreOpChecklist.belongsTo(TheatrePatient, { foreignKey: 'surgery_schedule_id', as: 'theatre' });
TheatreEquipment.belongsTo(OperatingRoom, { foreignKey: 'room_id', as: 'room' });

// ── Export ──────────────────────────────────────────────────────

const db = {
  sequelize,
  OperatingRoom,
  TheatrePatient,
  CaseCart,
  CaseCartItem,
  PreOpChecklist,
  TheatreEquipment,
  EducationalMaterial,
  PatientAllergy,
};

module.exports = db;
