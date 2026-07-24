const sequelize = require('../config/database');
const Patient = require('../models/patient');
const Institution = require('../models/institution');
const Department = require('../models/department');
const Insurance = require('../models/insuranceTable');

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

async function main() {
  console.log('Finding Baptist Regional Hospital...');
  const institution = await Institution.findOne({
    where: { name: 'Baptist Regional Hospital' }
  });

  if (!institution) {
    console.error('Baptist Regional Hospital not found');
    process.exit(1);
  }

  const institution_id = institution.id;
  console.log(`Found institution: ${institution.name} (${institution_id})`);

  console.log('Finding department...');
  const department = await Department.findOne({
    where: { institution_id }
  });

  if (!department) {
    console.error('No department found for this institution');
    process.exit(1);
  }

  const department_id = department.id;
  console.log(`Using department: ${department.name} (${department_id})`);

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
  const insuranceProviders = ['NHIS','PRIVATE'];

  console.log(`Starting creation of 100 patients...`);
  let success = 0;
  let failed = 0;

  for (let i = 0; i < 100; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[randomInt(0, lastNames.length - 1)];
    const middleName = Math.random() > 0.5 ? randomItem(firstNames) : '';
    const gender = Math.random() > 0.5 ? 'M' : 'F';
    const age = randomInt(1, 90);
    const dob = daysAgo(age * 365 + randomInt(0, 365));
    const hasInsurance = Math.random() > 0.3;
    const provider = hasInsurance ? randomItem(insuranceProviders) : null;

    const metadata = {
      relatives: {
        next_of_kin: {
          name: `${randomItem(firstNames)} ${lastName}`,
          phone: generatePhone(),
          relationship: randomItem(relations)
        },
        emergency_contact: {
          name: `${randomItem(firstNames)} ${lastName}`,
          phone: generatePhone(),
          relationship: randomItem(relations)
        }
      }
    };

    try {
      const patient = await Patient.create({
        first_name: `${firstName} ${i+1}`,
        middle_name: middleName,
        last_name: lastName,
        city: randomItem(cities),
        religion: randomItem(religions),
        address: `${randomInt(1,120)} ${randomItem(['High St','Main Rd','Ave','Blvd','Lane'])}`,
        country: randomItem(countries),
        institution_id,
        department_id,
        phone_number: generatePhone(),
        gender,
        email: generateEmail(firstName, lastName),
        date_of_birth: dob,
        has_insurance: hasInsurance,
        status: 'discharged',
        metadata
      });

      if (hasInsurance) {
        await Insurance.create({
          patient_id: patient.id,
          institution_id,
          insurance_provider: provider,
          insurance_number: provider === 'NHIS' ? `NHIS-${randomInt(100000,999999)}` : null,
          insurance_expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          insured: true
        });
      }

      success++;
      if (success % 10 === 0) {
        console.log(`Created ${success}/100 patients...`);
      }
    } catch (err) {
      failed++;
      console.error(`Failed patient ${i+1}:`, err.message);
    }
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
  await sequelize.close();
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
