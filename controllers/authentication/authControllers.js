const { Institution, Admin, Department, Role, Patient } = require('../../models');
const { generateToken } = require('../../utils/token');
const bcrypt = require('bcryptjs')
const sendEmail = require('../../service/sendEmail');
const Staff = require('../../models/staff');
const UserGroup = require('../../models/userGroup');
const crypto = require('crypto');
const LeaveRequest = require('../../models/hr/LeaveManagement');
const Appointment = require('../../models/appointment');
const { decryptStaffData, decryptStaffList } = require('../../utils/encryptionHelper');
const StaffDepartment = require('../../models/controls/StaffDepartment');


// Predefined logic questions with correct answers
const logicQuestions = [
    { question: "What is 5 + 3?", correctAnswer: "8", options: ["6", "7", "8", "9"] },
    { question: "What color is a banana?", correctAnswer: "Yellow", options: ["Blue", "Yellow", "Green", "Red"] },
    { question: "How many sides does a triangle have?", correctAnswer: "3", options: ["2", "3", "4", "5"] },
    { question: "Which animal is known as the 'King of the Jungle'?", correctAnswer: "Lion", options: ["Tiger", "Lion", "Elephant", "Giraffe"] },
    { question: "What is the fastest land animal?", correctAnswer: "Cheetah", options: ["Cheetah", "Lion", "Horse", "Deer"] },
    { question: "Which animal can fly?", correctAnswer: "Eagle", options: ["Penguin", "Ostrich", "Eagle", "Kangaroo"] },
    { question: "What is 10 + 4?", correctAnswer: "14", options: ["13", "14", "15", "16"] },
    { question: "What is 12 + 3?", correctAnswer: "15", options: ["14", "15", "16", "17"] },
];


// Shuffle function
const shuffleArray = (array) => {
    return array.sort(() => Math.random() - 0.5);
};

// Hash function for logic answer
const hashAnswer = (answer) => {
    return crypto.createHash('sha256').update(answer.toLowerCase()).digest('hex');
};


// AUTHENTICATE
// Step 1: Login - Send Random Question with Multiple Choice
exports.login = async (req, res) => {
    const { staffID, password } = req.body;

    if (!staffID || !password) {
        return res.status(400).json({ error: 'StaffID and password are required' });
    }

    try {
        const user = await Staff.findOne({
            where: { staffID },
            include: [
                { model: Institution, as: 'institution' },
                // { model: Permission, as: 'assignedPermissions' },
                { model: Role, as: 'role' },
                { model: Department, as: 'department' },
                { model: UserGroup, as: 'user_group' },
                { model:StaffDepartment, as: 'staff_departments' }
            ]
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Pick a random logic question
        const randomQuestion = logicQuestions[Math.floor(Math.random() * logicQuestions.length)];
        const shuffledOptions = shuffleArray([...randomQuestion.options]);

        // Find the correct option index (A, B, C, or D)
        const correctIndex = shuffledOptions.indexOf(randomQuestion.correctAnswer);
        const hashedAnswer = hashAnswer(randomQuestion.correctAnswer);

        // Store the hashed correct answer in DB
        await user.update({
            logic_question: randomQuestion.question,
            logic_answer_hash: hashedAnswer
        });

        // Return the question with shuffled answer choices
        return res.status(200).json({
            staffID: user.staffID,
            logic_question: randomQuestion.question,
            options: shuffledOptions, // Choices for frontend
            message: "Please select the correct answer to proceed."
        });

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: 'Server error' });
    }
};


// Step 2: Verify Selected Answer
exports.verifyLogicAnswer = async (req, res) => {
    const { staffID, selectedAnswer } = req.body;

    if (!staffID || !selectedAnswer) {
        return res.status(400).json({ error: "StaffID and selected answer are required." });
    }

    try {
        const user = await Staff.findOne({
            where: { staffID },
            include: [
                { model: Institution, as: 'institution' },
                // { model: Permission, as: 'assignedPermissions' },
                { model: Role, as: 'role' },
                { model: Department, as: 'department' },
                { model: UserGroup, as: 'user_group' }
            ]
        });

        if (!user || !user.logic_answer_hash) {
            return res.status(400).json({ error: "No pending logic question found." });
        }

        // Hash the selected answer and compare
        const hashedSelectedAnswer = hashAnswer(selectedAnswer);
        if (hashedSelectedAnswer !== user.logic_answer_hash) {
            return res.status(400).json({ error: "Incorrect answer. Try again." });
        }

        // If correct, generate authentication token and clear logic question
        const token = generateToken(user);
        await user.update({ token, logic_question: null, logic_answer_hash: null, last_login: Date.now() });

        // Decrypt sensitive information before sending user data
        const decryptedUser = decryptStaffData(user.toJSON());

        return res.status(200).json({ 
            message: "Login successful!", 
            token, 
            user: decryptedUser 
        });

    } catch (err) {
        console.error("Error verifying logic answer:", err);
        res.status(500).json({ error: "Server error" });
    }
};



// ADMIN LOGINS
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds

exports.adminLogin = async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password?.trim();

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const admin = await Admin.findOne({
            where: { email }, include: [
                {
                    model: Institution,
                    as: 'institution', // Assuming the association alias is 'institution'
                }
            ]
        });

        // Check if account is temporarily locked
        if (admin?.account_locked_until && admin.account_locked_until > new Date()) {
            const remainingTime = Math.ceil((admin.account_locked_until - new Date()) / 60000);
            return res.status(403).json({
                error: `Account temporarily locked. Try again in ${remainingTime} minutes.`
            });
        }

        // Verify credentials
        if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
            // Increment failed attempts
            if (admin) {
                const attempts = admin.login_attempts + 1;
                const updates = {
                    login_attempts: attempts,
                    last_failed_attempt: new Date()
                };

                // Lock account if max attempts reached
                if (attempts >= MAX_LOGIN_ATTEMPTS) {
                    updates.account_locked_until = new Date(Date.now() + LOCK_TIME);
                }

                await admin.update(updates);
            }

            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Successful login - reset attempts
        await admin.update({
            login_attempts: 0,
            last_failed_attempt: null,
            account_locked_until: null
        });

        // Generate and return auth token directly (no 2FA)
        const authToken = generateToken(admin);

        res.status(200).json({
            id: admin.id,
            username: admin.username,
            email: admin.email,
            institution: admin.institution,
            token: authToken
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};


const generateVerificationToken = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};





// GET ALL DOCTORS
exports.getAllDoctors = async (req, res) => {
    try {
        const doctors = await Role.findAll();
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};



// RESET PASSWORD ROUTE
exports.resetPassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const { staffId } = req;

    try {
        // Fetch the staff member by ID
        const staff = await Staff.findByPk(staffId);

        if (!staff) {
            return res.status(404).json({ error: 'Staff member not found' });
        }

        // Compare old password with the stored hashed password
        const isMatch = await bcrypt.compare(oldPassword, staff.password);

        if (!isMatch) {
            return res.status(400).json({ error: 'Old password is incorrect' });
        }

        // Hash the new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update the staff member's password
        staff.password = hashedNewPassword;
        await staff.save();

        return res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while resetting the password' });
    }
};



// UPDATE USER FCM_TOKEN
exports.updateUserFCMToken = async (req, res) => {
    const { id, fcm_token, institution_id } = req.body;
    console.log(req.body)

    // Validate request body
    if (!id || !fcm_token || !institution_id) {
        return res.status(400).json({ error: "id, fcm_token, and institution_id are required." });
    }

    try {
        const [updated] = await Staff.update(
            { fcm_token },
            { where: { id, institution_id } }
        );

        if (updated === 0) {
            return res.status(404).json({ error: "User not found or no changes made." });
        }
        return res.status(200).json({ message: "FCM token updated successfully." });
    } catch (error) {
        console.error("Error updating FCM token:", error);
        return res.status(500).json({ error: "An error occurred while updating FCM token." });
    }
};


// get user by user id
// get user by user id
exports.getUserDetails = async (req, res) => {
    const { id } = req.params;
    try {
        if (!id) return res.status(400).json({ error: 'id is required' });

        const user = await Staff.findByPk(id, {
            include: [
                { model: Department, as: 'department' },
                { model: Institution, as: 'institution' },
                { model: Role, as: 'role' },
                { model: LeaveRequest, as: 'leaveRequest' },
                { model: Appointment, as: 'appointments' },
            ]
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Decrypt sensitive information using helper function
        const decryptedUser = decryptStaffData(user.toJSON());

        return res.status(200).json({
            success: true,
            data: decryptedUser
        });

    } catch (error) {
        console.error('Error fetching user details:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
};





