
const { generateToken } = require('../../utils/token');
const bcrypt = require('bcryptjs')
const sendEmail = require('../../service/sendEmail');
const crypto = require('crypto');
const SuperAdmin = require('../../models/superadmin');


// Hash function for logic answer
const hashAnswer = (answer) => {
    return crypto.createHash('sha256').update(answer.toLowerCase()).digest('hex');
};


exports.registerSuperAdmin = async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // Validate fields
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Username, email, and password are required."
            });
        }

        // Check if username already exists
        const existingUsername = await SuperAdmin.findOne({
            where: { username }
        });

        if (existingUsername) {
            return res.status(400).json({
                success: false,
                message: "Username already exists."
            });
        }

        // Check if email already exists
        const existingEmail = await SuperAdmin.findOne({
            where: { email }
        });

        if (existingEmail) {
            return res.status(400).json({
                success: false,
                message: "Email already exists."
            });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 12);

        // Create Super Admin
        const superAdmin = await SuperAdmin.create({
            username,
            email,
            password_hash,
        });

        // Generate JWT Token
        const token = generateToken({
            id: superAdmin.id,
            email: superAdmin.email,
            role: superAdmin.role_manager,
        });

        // Optional: Send welcome email
        try {
            // await sendEmail({
            //     to: email,
            //     subject: "Welcome to Tonitel",
            //     html: `
            //         <h2>Welcome to Tonitel!</h2>
            //         <p>Hello ${username},</p>
            //         <p>Your Super Admin account has been created successfully.</p>
            //         <p><strong>Email:</strong> ${email}</p>
            //         <p>You can now log in to the Tonitel Super Admin Portal.</p>
            //     `
            // });
        } catch (emailError) {
            console.error("Failed to send welcome email:", emailError);
        }

        return res.status(201).json({
            success: true,
            message: "Super Admin registered successfully.",
            data: {
                id: superAdmin.id,
                username: superAdmin.username,
                email: superAdmin.email,
                role: superAdmin.role_manager,
                token
            }
        });

    } catch (error) {
        console.error("Register Super Admin Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to register Super Admin.",
            error: error.message
        });
    }
};


exports.loginSuperAdmin = async (req, res) => {
    const { email, password } = req.body;
    console.log(req.body)
    try {
        if (email == '' || password === '') return res.json({ error: 'All Fields are required' })

        const super_admin = await SuperAdmin.findOne({
            where: { email: email }
        })
        if (!super_admin || !(await bcrypt.compare(password, super_admin.password_hash))) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(super_admin);
        await super_admin.update({ token, last_login: Date.now() });


        return res.status(200).json({
            message: "Login successful!",
            token,
            user: super_admin
        });
    } catch (error) {
        console.error("Error verifying admin:", error);
        res.status(500).json({ error: "Failed to login super-admin" });
    }
}

