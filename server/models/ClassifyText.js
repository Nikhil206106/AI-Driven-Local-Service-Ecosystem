// server/models/ClassificationLabel.js

const mongoose = require('mongoose');

const ClassificationLabelSchema = new mongoose.Schema({
    // The clean, simple name for the category (e.g., 'Plumbing - Drain Clog')
    serviceName: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    // The detailed, full sentence used as the Hypothesis for the NLI model
    hypothesis_text: { 
        type: String,
        required: true,
        trim: true,
        maxlength: 300
    },
    // Allows admins to temporarily disable a label without deleting it
    isActive: { 
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('ClassificationLabel', ClassificationLabelSchema);