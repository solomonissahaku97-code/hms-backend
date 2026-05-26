

const LabResult = require('../models/lab_results');
const Test = require('../models/test');
const Patient = require('../models/patient');
const Department = require('../models/department');
const Staff = require('../models/staff');
const Record = require('../models/record');
const { sequelize } = require('../models');
const { sendNotificationToDepartment } = require('../helpers/sendPushNotification');





const LabResultController = {
    // Doctor makes a lab request
    async requestLab(req, res) {
        try {
            const { patient_id, doctor_id, test_id, institution_id, department_id, comment} = req.body;
            const labResult = await LabResult.create({
                patient_id,
                doctor_id,
                test_id,
                institution_id,
                staff_id:doctor_id,
                department_id,
                comment,
                status: 'requested'
            });

            const lab_department = await Department.findOne({where:{
                institution_id,
                departmentType:'Lab'
            }})
 
             sendNotificationToDepartment({
                department_id:lab_department.id,
                institution_id,
                title:'🔬 New Lab Request Received',  
                body:'A new lab request has been submitted and requires attention'
            })
            return res.status(201).json({ message: 'Lab request submitted successfully', labResult });
        } catch (error) {
            console.error('Error making lab request:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Accept lab request and update status to 'in-progress'
    async acceptLabRequest(req, res) {
        try {
            const { labResultId, lab_technician_id,institution_id } = req.body;

            const labResult = await LabResult.findOne({
                where:{
                    id:labResultId,
                    institution_id:institution_id
                }
            });
            if (!labResult) {
                return res.status(404).json({ error: 'Lab result not found' });
            }

            labResult.lab_technician_id = lab_technician_id;
            labResult.status = 'in-progress';
            await labResult.save();

            return res.status(200).json({ message: 'Lab request accepted', labResult });
        } catch (error) {
            console.error('Error accepting lab request:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Upload lab results and mark as completed
    async uploadLabResult(req, res) {
        try {
            const { labResultId, test, results_comment,institution_id } = req.body;

            const labResult = await LabResult.findOne({
                where:{
                    id:labResultId,
                    institution_id:institution_id

                }
            });
            if (!labResult) {
                return res.status(404).json({ error: 'Lab result not found' });
            }

            labResult.test = req.body.test
            labResult.results_comment = results_comment;
            labResult.status = 'completed';
            await labResult.save();

            return res.status(200).json({ message: 'Lab result uploaded successfully', labResult });
        } catch (error) {
            console.error('Error uploading lab result:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Cancel lab request
    async cancelLabRequest(req, res) {
        try {
            const { labResultId } = req.body;

            const labResult = await LabResult.findByPk(labResultId);
            if (!labResult) {
                return res.status(404).json({ error: 'Lab result not found' });
            }

            labResult.status = 'cancelled';
            await labResult.save();

            return res.status(200).json({ message: 'Lab request cancelled', labResult });
        } catch (error) {
            console.error('Error cancelling lab request:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    // GET ALL TEST KITS
    async getLabTest(req, res) {
        try {
            const labTest = await Test.findAll();
            return res.status(200).json(labTest);
        } catch (error) {
            console.error('Error fetching lab test:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }

    },

   // GET LAB REQUEST BY patient_id and institution_id with pagination
   async getPatientLabResults(req, res) {
    try {
        const { patient_id, institution_id, page = 1 } = req.query;
        const limit = 10;
        const offset = (page - 1) * limit;

        const labResults = await LabResult.findAndCountAll({
            where: { patient_id, institution_id },
            include: [
                { model: Test, as: 'test_name' },
                { model: Patient, as: 'patient', include: [{ model: Record, as: 'records' }] },
                { model: Department, as: 'department' },
                { model: Staff, as: 'staff' },
            ],
            limit,
            offset,
        });
        
        return res.status(200).json({
            total: labResults.count,
            totalPages: Math.ceil(labResults.count / limit),
            currentPage: parseInt(page, 10),
            labResults: labResults.rows
        });
    } catch (error) {
        console.error('Error fetching lab results:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
},

   // GET LAB RESULTS BY institution_id AND status with pagination
   async getLabResultsByStatus(req, res) {
    try {
        const { institution_id, status, page = 1 } = req.query;
        const limit = 10;
        const offset = (page - 1) * limit;

        const labResults = await LabResult.findAndCountAll({
            where: { institution_id, status },
            include: [
                { model: Test, as: 'test_name' },
                { model: Patient, as: 'patient' },
                { model: Department, as: 'department' },
                { model: Staff, as: 'staff' }
            ],
            limit,
            offset,
        });

        return res.status(200).json({
            total: labResults.count,
            totalPages: Math.ceil(labResults.count / limit),
            currentPage: parseInt(page, 10),
            labResults: labResults.rows
        });
    } catch (error) {
        console.error('Error fetching lab results by status:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
},

    async getLabStatistics(req, res) {
        const { institution_id } = req.query;
    
        if (!institution_id) {
            return res.status(400).json({ error: "Institution ID is required." });
        }
    
        try {
            // Total Lab Tests
            const totalTests = await LabResult.count({
                where: { institution_id }
            });
    
            // Count of tests by status
            const testsByStatus = await LabResult.findAll({
                attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
                where: { institution_id },
                group: ['status','test']
            });
    
            // Tests conducted per department
            const testsByDepartment = await LabResult.findAll({
                attributes: [
                    'department_id',
                    [sequelize.fn('COUNT', sequelize.col('department_id')), 'count']
                ],
                where: { institution_id },
                group: ['department_id', 'department.id', 'department.name'], // Include department fields in GROUP BY
                include: [
                    {
                        model: Department,
                        as: 'department',
                        attributes: ['id', 'name'] // Specify required fields
                    }
                ]
            });
            
    
            // Tests conducted per doctor
            const testsByDoctor = await LabResult.findAll({
                attributes: ['doctor_id', [sequelize.fn('COUNT', sequelize.col('doctor_id')), 'count']],
                where: { institution_id },
                group: ['doctor_id']
            });
    
            // Most commonly ordered tests
            const mostCommonTests = await LabResult.findAll({
                attributes: ['test', [sequelize.fn('COUNT', sequelize.col('test')), 'count']],
                where: { institution_id },
                group: ['test','test_name','test_name.id'],
                order: [[sequelize.literal('count'), 'DESC']],
                limit: 5,
                include:[
                    {
                        model:Test,
                        as:'test_name'
                    }
                ]
                
            });
    
            // Average time to complete a test (in milliseconds)
            const avgCompletionTime = await LabResult.findOne({
                attributes: [
                    [sequelize.literal("AVG(EXTRACT(EPOCH FROM (\"updatedAt\" - \"createdAt\")))"), 'average_time']
                ],
                where: {
                    institution_id,
                    status: 'completed'
                }
            });
    
            return res.status(200).json({
                totalTests,
                testsByStatus,
                testsByDepartment,
                testsByDoctor,
                mostCommonTests,
                avgCompletionTime: avgCompletionTime ? avgCompletionTime.dataValues.average_time : null,
            });
    
        } catch (error) {
            console.error("Error fetching lab statistics:", error);
            return res.status(500).json({ error: "An error occurred while fetching lab statistics." });
        }
    }

};


module.exports = LabResultController;



