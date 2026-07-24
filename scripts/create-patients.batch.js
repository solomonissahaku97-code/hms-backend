const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5008/api/v1';
const TOKEN = process.env.TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImViZTYzMDgyLWJmNjItNDQ5Ni1iYzdmLWFlNTRlZmZmMTJiOCIsImlhdCI6MTc4NDMwNzQ3NX0.8wKZYOssD-rgMHY1oUQq27lVnnaH4M5VbFxAWsEV4Ds';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { Authorization: `Bearer ${TOKEN}` }
});

async function getInstitutions() {
  const res = await api.get('/institutions');
  return res.data;
}

async function getDepartments(institution_id) {
  const res = await api.get(`/institutions/departments?institution_id=${institution_id}`);
  return res.data;
}

async function createPatient(payload) {
  const res = await api.post('/records/patient/create', payload);
  return res.data;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePhone() {
  const prefixes = ['020', '024', '054', '055', '059', '026', '027', '028', '023'];
  const prefix = randomItem(prefixes);
  const rest = String(randomInt(1000000, 9999999));
  return `+233${prefix}${rest}`;
}

function generateEmail(firstName, lastName) {
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'email.com'];
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 999)}@${randomItem(domains)}`;
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Fetching institutions...');
  const instRes = await getInstitutions();
  const institutions = instRes?.institutions || instRes?.data?.institutions || [];
  
  const institution = institutions.find(i => i.name === 'Baptist Regional Hospital');
  
  if (!institution) {
    console.error('Baptist Regional Hospital not found. Available institutions:');
    institutions.forEach(i => console.log(' -', i.name, i.id));
    process.exit(1);
  }
  
  const institution_id = institution.id;
  console.log(`Found institution: ${institution.name} (${institution_id})`);

  console.log('Fetching departments...');
  const deptRes = await getDepartments(institution_id);
  let departments = [];
  if (Array.isArray(deptRes)) {
    departments = deptRes;
  } else if (deptRes?.data && Array.isArray(deptRes.data)) {
    departments = deptRes.data;
  } else if (deptRes?.departments) {
    departments = deptRes.departments;
  }
  
  let department = departments.length > 0 ? departments[0] : null;
  
  if (!department) {
    console.warn('No departments found. Using institution_id as fallback department.');
    department = { id: institution_id };
  } else {
    console.log(`Using department: ${department.name} (${department.id})`);
  }

  const firstNames = [
    'Kwame','Ama','Kofi','Efua','Akua','Yaw','Afia','Adwoa',
    'Akos','Mensah','Boateng','Owusu','Asare','Antwi','Bediako',
    'Bonsu','Asante','Opoku','Appiah','Amponsah','Adu','Osei',
    'Tuffour','Agyeman','Freeman','Kwarteng','Opare','Agyei','Badu'
  ];
  const lastNames = [
    'Mensah','Boateng','Owusu','Asare','Antwi','Bediako','Bonsu','Asante','Opoku','Appiah',
    'Amponsah','Adu','Osei','Tuffour','Agyeman','Freeman','Kwarteng','Opare','Agyei','Badu'
  ];
  const cities = ['Accra','Kumasi','Tamale','Takoradi','Cape Coast','Sunyani','Ho','Koforidua','Tema','Sekondi'];
  const countries = ['Ghana','Nigeria','Ivory Coast','Togo','Benin'];
  const religions = ['Christianity','Islam','Traditional','Buddhism','Hinduism','None'];
  const relations = ['Father','Mother','Sibling','Spouse','Grandparent','Uncle','Aunt','Cousin','Friend','Guardian'];
  const insuranceProviders = ['NHIS','Private','Other'];

  console.log(`Starting creation of 100 patients in Baptist Regional Hospital...`);
  let success = 0;
  let failed = 0;

  const BATCH_SIZE = 8;
  const batches = [];
  
  for (let i = 0; i < 100; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[randomInt(0, lastNames.length - 1)];
    const middleName = Math.random() > 0.5 ? randomItem(firstNames) : '';
    const gender = Math.random() > 0.5 ? 'M' : 'F';
    const age = randomInt(1, 90);
    const dob = daysAgo(age * 365 + randomInt(0, 365));
    const hasInsurance = Math.random() > 0.3;
    const provider = randomItem(insuranceProviders);
    
    const payload = {
      first_name: `${firstName} ${i+1}`,
      middle_name: middleName,
      last_name: lastName,
      city: randomItem(cities),
      religion: randomItem(religions),
      address: `${randomInt(1,120)} ${randomItem(['High St','Main Rd','Ave','Blvd','Lane'])}`,
      country: randomItem(countries),
      institution_id,
      department_id: department.id,
      phone_number: generatePhone(),
      gender,
      email: generateEmail(firstName, lastName),
      date_of_birth: dob,
      has_insurance: hasInsurance,
      insurance_provider: hasInsurance ? provider : undefined,
      nhis_number: hasInsurance && provider === 'NHIS' ? `NHIS-${randomInt(100000,999999)}` : undefined,
      next_of_kin_name: `${randomItem(firstNames)} ${lastName}`,
      next_of_kin_phone: generatePhone(),
      next_of_kin_relationship: randomItem(relations),
      emergency_contact_name: `${randomItem(firstNames)} ${lastName}`,
      emergency_contact_phone: generatePhone(),
      emergency_contact_relationship: randomItem(relations)
    };

    if (!batches[Math.floor(i / BATCH_SIZE)]) {
      batches[Math.floor(i / BATCH_SIZE)] = [];
    }
    batches[Math.floor(i / BATCH_SIZE)].push({ i, payload });
  }

  for (const batch of batches) {
    const promises = batch.map(async ({ i, payload }) => {
      try {
        await createPatient(payload);
        success++;
        if (success % 10 === 0) {
          console.log(`Created ${success}/100 patients...`);
        }
      } catch (err) {
        failed++;
        console.error(`Failed patient ${i+1}:`, err.response?.data?.error || err.message);
      }
    });
    
    await Promise.all(promises);
    await sleep(200);
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
