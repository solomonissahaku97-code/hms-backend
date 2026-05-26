const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: 'BrandeviaHMS',
    description: 'API for managing hospital operations, including patients, staff, appointments, and more.',
  },
  host: 'localhost:7000/api/v1',
  schemes: ['http'],
  // tags: [
  //   { name: 'Auth', description: 'Authentication related endpoints-' },
  //   { name: 'Beds', description: 'Bed management related endpoints' },
  //   { name: 'Departments', description: 'Department management related endpoints' },
  // ],
};

const outputFile = './swagger-output.json';
const endpointsFiles = [
  '../routes/authRoutes.js',
  '../routes/bedRoutes.js',
  '../routes/departmentRoutes.js',
  '../routes/commentsRoutes.js',
  '../routes/patientDiagnosisRoutes.js',
  '../routes/patientNoteRoute.js',
  '../routes/smsRoute.js',
  '../routes/storeRoutes.js',
  '../routes/admissionRoute.js',
  '../routes/transferRoutes.js',
  '../routes/patientBookingRoutes.js',
  '../routes/partographRoute.js',
  '../routes/laboratoryTestRoutes.js'
];

swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
  require('../server'); // Your server file where you initialize the app
});
