const Institution = require("../models/institution");
const Subscription = require("../models/subscription");

const hospitals = [
    { name: "Korle Bu Teaching Hospital", address: "Korle Bu, Accra", region: "Greater Accra", country: "Ghana", contact: "+233302665551", email: "info@korlebu.gov.gh" },
    { name: "Komfo Anokye Teaching Hospital", address: "Kumasi", region: "Ashanti", country: "Ghana", contact: "+233322025625", email: "info@kath.gov.gh" },
    { name: "Tamale Teaching Hospital", address: "Tamale", region: "Northern", country: "Ghana", contact: "+233372025625", email: "info@tth.gov.gh" },
    { name: "Cape Coast Teaching Hospital", address: "Cape Coast", region: "Central", country: "Ghana", contact: "+233332132131", email: "info@ccth.gov.gh" },
    { name: "Ho Teaching Hospital", address: "Ho", region: "Volta", country: "Ghana", contact: "+233362562561", email: "info@hth.gov.gh" },
    { name: "Accra Psychiatric Hospital", address: "Accra New Town", region: "Greater Accra", country: "Ghana", contact: "+233302664440", email: "info@aph.gov.gh" },
    { name: "Fanta District Hospital", address: "Fanta, Bono East", region: "Bono East", country: "Ghana", contact: "+233356592344", email: "info@fantahosp.gov.gh" },
    { name: "Nkwanta District Hospital", address: "Nkwanta", region: "Oti", country: "Ghana", contact: "+233371234567", email: "info@nkwantahosp.gov.gh" },
    { name: "Buipe District Hospital", address: "Buipe", region: "Savannah", country: "Ghana", contact: "+233374567890", email: "info@buiphosp.gov.gh" },
    { name: "Atebubu District Hospital", address: "Atebubu", region: "Bono East", country: "Ghana", contact: "+233356789012", email: "info@atebubuhosp.gov.gh" },
    { name: "Dambai District Hospital", address: "Dambai", region: "Oti", country: "Ghana", contact: "+233371987654", email: "info@dambaihosp.gov.gh" },
    { name: "Salaga District Hospital", address: "Salaga", region: "Savannah", country: "Ghana", contact: "+233373456789", email: "info@sagahosp.gov.gh" },
    { name: "Wenchi District Hospital", address: "Wenchi", region: "Bono", country: "Ghana", contact: "+233352345678", email: "info@wenchihosp.gov.gh" },
    { name: "Nkawie District Hospital", address: "Nkawie", region: "Ashanti", country: "Ghana", contact: "+233324567890", email: "info@nkawiehosp.gov.gh" },
    { name: "Mampong District Hospital", address: "Mampong", region: "Ashanti", country: "Ghana", contact: "+233325678901", email: "info@mamponghosp.gov.gh" },
    { name: "Asante Mampong Hospital", address: "Mampong", region: "Ashanti", country: "Ghana", contact: "+233326789012", email: "info@asantemampong.gov.gh" },
    { name: "Ejura District Hospital", address: "Ejura", region: "Ashanti", country: "Ghana", contact: "+233327890123", email: "info@ejurahosp.gov.gh" },
    { name: "Bekwai District Hospital", address: "Bekwai", region: "Ashanti", country: "Ghana", contact: "+233328901234", email: "info@bekwaihosp.gov.gh" },
    { name: "Konongo District Hospital", address: "Konongo", region: "Ashanti", country: "Ghana", contact: "+233329012345", email: "info@konongohosp.gov.gh" },
    { name: "Juaben District Hospital", address: "Juaben", region: "Ashanti", country: "Ghana", contact: "+233321012345", email: "info@juabenhosp.gov.gh" },
    { name: "Obuasi Government Hospital", address: "Obuasi", region: "Ashanti", country: "Ghana", contact: "+233322112345", email: "info@obuasihosp.gov.gh" },
    { name: "Tafo District Hospital", address: "Tafo", region: "Ashanti", country: "Ghana", contact: "+233323212345", email: "info@tafohosp.gov.gh" },
    { name: "Suame District Hospital", address: "Suame", region: "Ashanti", country: "Ghana", contact: "+233324312345", email: "info@suamehosp.gov.gh" },
    { name: "Ashanti Regional Hospital", address: "Kumasi", region: "Ashanti", country: "Ghana", contact: "+233325412345", email: "info@arh.gov.gh" },
    { name: "Manhyia District Hospital", address: "Manhyia", region: "Ashanti", country: "Ghana", contact: "+233326512345", email: "info@manhyiahosp.gov.gh" },
    { name: "Adum District Hospital", address: "Adum", region: "Ashanti", country: "Ghana", contact: "+233327612345", email: "info@adumhosp.gov.gh" },
    { name: "Bantama District Hospital", address: "Bantama", region: "Ashanti", country: "Ghana", contact: "+233328712345", email: "info@bantamahosp.gov.gh" },
    { name: "Asokwa District Hospital", address: "Asokwa", region: "Ashanti", country: "Ghana", contact: "+233329812345", email: "info@asokwahosp.gov.gh" },
    { name: "Kwadaso District Hospital", address: "Kwadaso", region: "Ashanti", country: "Ghana", contact: "+233321912345", email: "info@kwadasohosp.gov.gh" },
    { name: "Nhyiaeso District Hospital", address: "Nhyiaeso", region: "Ashanti", country: "Ghana", contact: "+233322012345", email: "info@nhyiaesohosp.gov.gh" }
];

const seedInstitutions = async () => {
    try {
        const existingCount = await Institution.count();
        const targetCount = 30;
        const needed = targetCount - existingCount;

        if (needed <= 0) {
            console.log(`Already have ${existingCount} institutions. Target of ${targetCount} met or exceeded.`);
            return;
        }

        const subscriptions = await Subscription.findAll();
        const defaultSubscription = subscriptions[0] || null;

        const toCreate = hospitals.slice(0, needed);

        for (const hosp of toCreate) {
            await Institution.create({
                ...hosp,
                subscriptionId: defaultSubscription ? defaultSubscription.id : null,
                established_date: new Date(1990 + Math.floor(Math.random() * 34), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
                operating_hours: JSON.stringify({ monday: "8:00 AM - 5:00 PM", tuesday: "8:00 AM - 5:00 PM", wednesday: "8:00 AM - 5:00 PM", thursday: "8:00 AM - 5:00 PM", friday: "8:00 AM - 5:00 PM" }),
                number_of_employees: Math.floor(Math.random() * 200) + 20,
                description: "A premier healthcare facility providing quality medical services."
            });
        }

        const newCount = await Institution.count();
        console.log(`Seeded institutions. Total count: ${newCount}`);
    } catch (error) {
        console.error('Error seeding institutions:', error);
    }
};

module.exports = seedInstitutions;
