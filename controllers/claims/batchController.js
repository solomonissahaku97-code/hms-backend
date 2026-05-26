const { v4: uuidv4 } = require("uuid");
const Institution = require("../../models/institution");
const Batch = require("../../models/batches");
const Claim = require("../../models/claims");


// ✅ 1️⃣ Create a New Batch
exports.createBatch = async (req, res) => {
    const { institution_id } = req.body;

    try {
        // Check if institution exists
        const institution = await Institution.findByPk(institution_id);
        if (!institution) {
            return res.status(404).json({ error: "Institution not found" });
        }

        // Generate a unique batch number
        const batchNumber = `BATCH-${new Date().toISOString().split("T")[0]}-${Math.floor(Math.random() * 1000)}`;

        // Create new batch
        const batch = await Batch.create({
            id: uuidv4(),
            batch_number: batchNumber,
            total_amount: 0, // Initially 0, will be updated when claims are added
            claim_count: 0,
            submission_date: new Date(),
            institution_id
        });

        res.status(201).json({
            message: "Batch created successfully",
            batch_id: batch.id,
            batch_number: batch.batch_number
        });
    } catch (error) {
        console.error("Error creating batch:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};


// ✅ 2️⃣ Add a Claim to a Batch
exports.addClaimToBatch = async (req, res) => {
    const { batch_id, claim_id } = req.body;

    try {
        // Validate batch
        const batch = await Batch.findByPk(batch_id);
        if (!batch) {
            return res.status(404).json({ error: "Batch not found" });
        }

        // Validate claim
        const claim = await Claim.findByPk(claim_id);
        if (!claim) {
            return res.status(404).json({ error: "Claim not found" });
        }

        // Ensure the claim is not already in a batch
        if (claim.batch_id) {
            return res.status(400).json({ error: "Claim already assigned to a batch" });
        }

        // Update claim with batch_id
        await claim.update({ batch_id });

        // Recalculate batch total
        const updatedClaims = await Claim.findAll({ where: { batch_id } });
        const totalAmount = updatedClaims.reduce((sum, c) => sum + c.total_cost, 0);

        await batch.update({
            total_amount: totalAmount,
            claim_count: updatedClaims.length
        });

        res.status(200).json({ message: "Claim added to batch successfully", batch_id, total_amount: totalAmount });

    } catch (error) {
        console.error("Error adding claim to batch:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// ✅ 3️⃣ Get All Batches for an Institution
exports.getBatchesByInstitution = async (req, res) => {
    const { institution_id } = req.params;

    try {
        const batches = await Batch.findAll({ where: { institution_id } });

        if (batches.length === 0) {
            return res.status(404).json({ error: "No batches found for this institution" });
        }

        res.status(200).json(batches);
    } catch (error) {
        console.error("Error fetching batches:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// ✅ 4️⃣ Submit Batch to NHIA (Future Implementation)
exports.submitBatch = async (req, res) => {
    const { batch_id } = req.body;

    try {
        const batch = await Batch.findByPk(batch_id);
        if (!batch) {
            return res.status(404).json({ error: "Batch not found" });
        }

        // Here, we would implement XML generation and submission to NHIA.
        // For now, we just mark it as "Submitted"
        await batch.update({ status: "Submitted" });

        res.status(200).json({ message: "Batch submitted successfully", batch_id });
    } catch (error) {
        console.error("Error submitting batch:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
