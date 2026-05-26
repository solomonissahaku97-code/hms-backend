const { sequelize } = require('../config/database');
const RotationStaff = require('../models/rotationStaff');
const Staff = require('../models/staff');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const sendEmail = require('../service/sendEmail');
const { Op } = require('sequelize');


// Add a new shift for a staff member
const addShift = async (req, res) => {
    try {
        const { staff_id, institution_id, department_id, day, shift, start_time, end_time, notes } = req.body;

        // Check if a shift already exists for this staff on the same day
        const existingShift = await RotationStaff.findOne({ where: { staff_id, day } });
        if (existingShift) {
            return res.status(400).json({ message: "Shift already exists for this staff on this day. Please update it instead." });
        }

        // Create a new shift
        const newShift = await RotationStaff.create({
            staff_id,
            institution_id,
            department_id,
            day,
            shift,
            start_time,
            end_time,
            notes
        });

        return res.status(201).json({ message: "Shift added successfully!", shift: newShift });
    } catch (error) {
        console.error("Error adding shift:", error);
        return res.status(500).json({ message: "Server error, could not add shift." });
    }
};

// Update an existing shift
const updateShift = async (req, res) => {
    try {
        const { shift_id } = req.params;
        const { day, shift, start_time, end_time, notes } = req.body;

        // Find the shift
        const existingShift = await RotationStaff.findByPk(shift_id);
        if (!existingShift) {
            return res.status(404).json({ message: "Shift not found!" });
        }

        // Update shift details
        await existingShift.update({ day, shift, start_time, end_time, notes });

        return res.status(200).json({ message: "Shift updated successfully!", shift: existingShift });
    } catch (error) {
        console.error("Error updating shift:", error);
        return res.status(500).json({ message: "Server error, could not update shift." });
    }
};

// Get all shifts (optional: filter by staff, institution, department)
const getShifts = async (req, res) => {
    const { institution_id, department_id } = req.query
    try {
        const shifts = await RotationStaff.findAll({
            include: [
                { model: Staff, as: "rotation", attributes: ["id", "firstName", "lastName"] },
            ],

            where: {
                department_id,
                institution_id
            }
        },

        );

        return res.status(200).json(shifts);
    } catch (error) {
        console.error("Error fetching shifts:", error);
        return res.status(500).json({ message: "Server error, could not fetch shifts." });
    }
};


const addBulkShifts = async (req, res) => {
    try {
        const shiftsArray = req.body;

        // Validate that we have an array
        if (!Array.isArray(shiftsArray) || shiftsArray.length === 0) {
            return res.status(400).json({ message: "Invalid input. Provide an array of shifts." });
        }

        // Validate each shift object
        for (let shiftData of shiftsArray) {
            if (!shiftData.staff_id || !shiftData.day || !shiftData.shift_type) {
                return res.status(400).json({
                    message: "Invalid shift data. Each shift must have staff_id, day, and shift_type."
                });
            }
        }

        // Map to match your ENUM values exactly
        const dayMap = {
            'Monday': 'monday',
            'Tuesday': 'tuesday',
            'Wednesday': 'wednesday',
            'Thursday': 'thursday',
            'Friday': 'friday',
            'Saturday': 'saturday',
            'Sunday': 'sunday'
        };

        const shiftMap = {
            'Morning': 'morning',
            'Afternoon': 'afternoon',
            'Night': 'night',
            'Off': 'off'
        };

        // Prepare bulk shift data with exact ENUM values
        const bulkShiftData = shiftsArray.map(({ staff_id, day, shift_type, institution_id, department_id }) => {
            const mappedDay = dayMap[day];
            const mappedShift = shiftMap[shift_type];

            if (!mappedDay) {
                throw new Error(`Invalid day: ${day}. Must be one of: ${Object.keys(dayMap).join(', ')}`);
            }

            if (!mappedShift) {
                throw new Error(`Invalid shift type: ${shift_type}. Must be one of: ${Object.keys(shiftMap).join(', ')}`);
            }

            return {
                staff_id,
                institution_id,
                department_id,
                day: mappedDay,
                shift: mappedShift,
                start_time: getStartTime(shift_type),
                end_time: getEndTime(shift_type),
                notes: null
            };
        });

        console.log('Processed shift data for database:', bulkShiftData);

        // Upsert (Insert or Update) the shifts
        for (let shiftData of bulkShiftData) {
            await RotationStaff.upsert(shiftData, {
                where: {
                    staff_id: shiftData.staff_id,
                    day: shiftData.day,
                    institution_id: shiftData.institution_id
                }
            });
        }

        return res.status(200).json({
            message: `${bulkShiftData.length} shifts added/updated successfully!`
        });

    } catch (error) {
        console.error("Error adding shifts:", error);
        return res.status(500).json({
            message: "Server error, please try again.",
            error: error.message
        });
    }
};

// Helper functions for setting times based on shift type
const getStartTime = (shiftType) => {
    const times = {
        'Morning': '08:00:00',
        'Afternoon': '14:00:00',
        'Night': '22:00:00',
        'Off': null
    };
    return times[shiftType] || null;
};

const getEndTime = (shiftType) => {
    const times = {
        'Morning': '16:00:00',
        'Afternoon': '22:00:00',
        'Night': '06:00:00',
        'Off': null
    };
    return times[shiftType] || null;
};



// get all users from a department department
const getAllUsersFromDepartment = async (req, res) => {
    const { department_id } = req.query;
    console.log(department_id)
    try {
        const users = await Staff.findAll({
            where: department_id,
            attributes: ['id', 'firstName', 'lastName', 'email',]
        });

        return res.status(200).json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        return res.status(500).json({ message: "Server error, could not fetch users." });
    }
}




// it works for me and other section of the application..so we have to deal with everything here and also talk about the consultation we had talked about earlier

// it works for me and other section of the application
module.exports = { addShift, updateShift, getShifts, addBulkShifts, getAllUsersFromDepartment };