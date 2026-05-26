const Group = require('../models/group');
const MessageReadReceipt = require('../models/MessageReadReceipt');
const Message = require('../models/messaging');
const Role = require('../models/role');
const Staff = require('../models/staff');
const UserGroup = require('../models/userGroup');
const Joi = require('joi');


// Create a new group
exports.createGroup = async (req, res) => {
    try {
        const { name, description, institution_id } = req.body;

        // Create the group in the database
        const group = await Group.create({ name, description, institution_id });

        res.status(201).json({
            message: 'Group created successfully',
            data: group
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Add users to a group
exports.addUsersToGroup = async (req, res) => {
    // Define a Joi schema to validate the request body
    const schema = Joi.object({
        groupId: Joi.number().integer().positive().required().messages({
            'number.base': 'Group ID must be a number.',
            'number.integer': 'Group ID must be an integer.',
            'number.positive': 'Group ID must be a positive number.',
            'any.required': 'Group ID is required.'
        }),
        userIds: Joi.array()
            .items(Joi.number().integer().positive().messages({
                'number.base': 'User ID must be a number.',
                'number.integer': 'User ID must be an integer.',
                'number.positive': 'User ID must be a positive number.'
            }))
            .min(1)
            .required()
            .messages({
                'array.base': 'User IDs must be an array.',
                'array.min': 'At least one User ID is required.',
                'any.required': 'User IDs are required.'
            })
    });

    try {
        // Validate the request body
        const { groupId, userIds } = await schema.validateAsync(req.body, { abortEarly: false });

        // Check if the group exists
        const group = await Group.findByPk(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Add each user to the group
        for (const userId of userIds) {
            const user = await Staff.findByPk(userId);
            if (!user) {
                return res.status(404).json({ message: `User with ID ${userId} not found` });
            }

            // Add user to the group if they are not already in
            await UserGroup.findOrCreate({
                where: { userId, groupId },
                defaults: { userId, groupId }
            });
        }

        res.status(200).json({ message: 'Users added to the group successfully' });
    } catch (error) {
        if (error.isJoi) {
            // Return validation errors if Joi validation fails
            return res.status(400).json({ errors: error.details.map(err => err.message) });
        }

        res.status(500).json({ error: error.message });
    }
};

// Get all users in a group
exports.getGroupUsers = async (req, res) => {
    try {
        const { groupId, institution_id } = req.query;

        // Fetch the group and include associated users (Staff)
        const group = await Group.findOne({
            where: { id: groupId, institution_id },
            include: [
                {
                    model: Staff,
                    as: 'users',  // Ensure this matches the alias in the association
                    through: { attributes: [] } // Exclude attributes from the join table (UserGroup)
                }
            ]
        });

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        return res.status(200).json({ data: group });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.removeUserFromGroup = async (req, res) => {
    try {
        const { userId, groupId } = req.body;

        // Check if the user is in the group
        const userGroupEntry = await UserGroup.findOne({
            where: {
                userId,
                groupId
            }
        });

        if (!userGroupEntry) {
            return res.status(404).json({ message: 'User is not part of the group' });
        }

        // Remove the user from the group by deleting the entry
        await userGroupEntry.destroy();

        return res.status(200).json({ message: 'User removed from the group successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Get all groups
exports.getAllGroups = async (req, res) => {
    const { institution_id } = req.query
    try {
        // Fetch all groups from the database
        const groups = await Group.findAll({
            where: { institution_id }, include: [
                {
                    model: Staff,
                    as: 'users',
                    attributes: ['firstName', 'lastName', 'id'],
                    include: [
                        {
                            model: Role,
                            as: 'role'
                        }
                    ]
                },
                {
                    model: Message,
                    as: 'messages',
                    include: [
                        {
                            model: Staff,
                            as: 'sender',
                            attributes: ['firstName', 'lastName']
                        },
                        {
                            model: MessageReadReceipt,
                            as: 'readReceipts'
                        }
                    ]
                }
            ]
        }); // You can also include any necessary associate here

        return res.status(200).json(groups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Get user-specific groups
exports.getUserGroups = async (req, res) => {
    const { user_id, institution_id } = req.query;

    try {
        // Fetch groups where the user is a member
        const userGroups = await Group.findAll({
            where: { institution_id }, // Optional: filter by institution if needed
            include: [
                {
                    model: Staff,
                    as: 'users',
                    where: { id: user_id }, // Only fetch groups where the user is part of
                    attributes: ['firstName', 'lastName'],
                    include: [
                        {
                            model: Role,
                            as: 'role', // Include user's role if needed
                        }
                    ]
                },
                {
                    model: Message,
                    as: 'messages',
                    include: [
                        {
                            model: Staff,
                            as: 'sender',
                            attributes: ['firstName', 'lastName']
                        },
                        {
                            model: MessageReadReceipt,
                            as: 'readReceipts'
                        }
                    ]
                }
            ]
        });

        // If user is not part of any groups
        if (!userGroups.length) {
            return res.status(404).json({ message: 'No groups found for this user.' });
        }

        return res.status(200).json(userGroups);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};




