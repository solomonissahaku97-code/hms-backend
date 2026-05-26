const Test = require("../models/test");


const tests = [
    {"test_name": "Complete Blood Count", "description": "Measures different components of blood."},
    {"test_name": "Basic Metabolic Panel", "description": "Measures glucose, calcium, and electrolytes."},
    {"test_name": "Lipid Panel", "description": "Measures cholesterol and triglycerides."},
    {"test_name": "Liver Panel", "description": "Measures enzymes and proteins in the liver."},
    {"test_name": "Thyroid Function Tests", "description": "Measures thyroid hormone levels."},
    {"test_name": "Hemoglobin A1C", "description": "Measures average blood sugar levels over 3 months."},
    {"test_name": "Urinalysis", "description": "Tests urine for various substances."},
    {"test_name": "C-Reactive Protein", "description": "Measures inflammation in the body."},
    {"test_name": "Prothrombin Time", "description": "Measures blood clotting time."},
    {"test_name": "Vitamin D Test", "description": "Measures the level of vitamin D in the blood."},
    {"test_name": "Erythrocyte Sedimentation Rate (ESR)", "description": "Detects inflammation by measuring the rate at which red blood cells sediment."},
    {"test_name": "Fasting Blood Sugar (FBS)", "description": "Measures blood glucose levels after a period of fasting."},
    {"test_name": "Random Blood Sugar (RBS)", "description": "Measures blood glucose levels at any given time."},
    {"test_name": "Prostate-Specific Antigen (PSA)", "description": "Screens for prostate abnormalities, including cancer."},
    {"test_name": "HIV Antibody Test", "description": "Detects antibodies to HIV in the blood."},
    {"test_name": "Hepatitis B Surface Antigen (HBsAg)", "description": "Screens for Hepatitis B infection."},
    {"test_name": "Malaria Parasite Test", "description": "Detects the presence of malaria parasites in the blood."},
    {"test_name": "Widal Test", "description": "Diagnoses typhoid fever by detecting antibodies against Salmonella bacteria."},
    {"test_name": "Stool Routine Examination", "description": "Analyzes stool samples for parasites, bacteria, and other abnormalities."},
    {"test_name": "Sputum AFB Test", "description": "Detects acid-fast bacilli, indicative of tuberculosis."},
    {"test_name": "Blood Urea Nitrogen (BUN)", "description": "Assesses kidney function by measuring urea nitrogen in the blood."},
    {"test_name": "Serum Creatinine", "description": "Evaluates kidney function by measuring creatinine levels."},
    {"test_name": "Electrolyte Panel", "description": "Measures levels of essential electrolytes like sodium, potassium, and chloride."},
    {"test_name": "Lactate Dehydrogenase (LDH)", "description": "Indicates tissue damage by measuring LDH enzyme levels."},
    {"test_name": "Alkaline Phosphatase (ALP)", "description": "Assesses liver and bone health by measuring ALP enzyme levels."},
    {"test_name": "Aspartate Aminotransferase (AST)", "description": "Evaluates liver function by measuring AST enzyme levels."},
    {"test_name": "Alanine Aminotransferase (ALT)", "description": "Assesses liver health by measuring ALT enzyme levels."},
    {"test_name": "Total Protein Test", "description": "Measures the total amount of protein in the blood."},
    {"test_name": "Albumin Test", "description": "Evaluates liver and kidney function by measuring albumin levels."},
    {"test_name": "Bilirubin Test", "description": "Assesses liver function by measuring bilirubin levels."},
    {"test_name": "Calcium Test", "description": "Measures the level of calcium in the blood."},
    {"test_name": "Magnesium Test", "description": "Evaluates magnesium levels, important for muscle and nerve function."},
    {"test_name": "Phosphate Test", "description": "Measures phosphate levels, essential for bone health."},
    {"test_name": "Uric Acid Test", "description": "Detects elevated uric acid levels, which can indicate gout."},
    {"test_name": "Lipid Profile", "description": "Comprehensive assessment of cholesterol and triglyceride levels."},
    {"test_name": "Serum Iron Test", "description": "Measures the amount of iron in the blood."},
    {"test_name": "Total Iron Binding Capacity (TIBC)", "description": "Assesses the blood's capacity to bind iron."},
    {"test_name": "Ferritin Test", "description": "Evaluates iron stores in the body by measuring ferritin levels."},
    {"test_name": "Folate (Vitamin B9) Test", "description": "Measures folate levels, important for red blood cell formation."},
    {"test_name": "Vitamin B12 Test", "description": "Assesses vitamin B12 levels, crucial for nerve function and blood formation."},
    {"test_name": "Rheumatoid Factor (RF) Test", "description": "Detects rheumatoid factor antibodies, aiding in diagnosing rheumatoid arthritis."},
    {"test_name": "Antinuclear Antibody (ANA) Test", "description": "Screens for autoimmune disorders by detecting ANA."},
    {"test_name": "D-Dimer Test", "description": "Assists in diagnosing blood clotting disorders."},
    {"test_name": "Troponin Test", "description": "Detects heart muscle damage, commonly used in diagnosing heart attacks."},
    {"test_name": "Creatine Kinase (CK) Test", "description": "Measures CK enzyme levels, indicating muscle damage."},
    {"test_name": "Amylase Test", "description": "Assesses pancreatic function by measuring amylase enzyme levels."},
    {"test_name": "Lipase Test", "description": "Evaluates pancreatic health by measuring lipase enzyme levels."},
    {"test_name": "Cortisol Test", "description": "Measures cortisol levels, important for assessing adrenal function."},
    {"test_name": "Insulin Test", "description": "Determines insulin levels in the blood, aiding in diagnosing diabetes and other metabolic disorders."}
]
 

async function addInitialTests() {
    try {
        for (const test of tests) {
            await Test.findOrCreate({
                where: { test_name: test.test_name },
                defaults: test,
            });
        }
        console.log('tests created successfully')
    } catch (error) {
        console.error('Error adding initial lab tests:', error);
    }
}

 

module.exports = addInitialTests;