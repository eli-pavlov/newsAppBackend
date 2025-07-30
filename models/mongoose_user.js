const { Schema, model } = require('mongoose');

const UserSchema = new Schema(
    {
        name: { 
            type:String, 
            required:true 
        },
        email: {
            type: String,
            required: true
        },
        password: {
            type: String,
            required: true
        },
        role: {
            type: String,
            enum: { values:['Admin', 'Editor'], message:'Invalid role'},
            required: true
        },
    },
);
    
const User = model('User', UserSchema);

module.exports = User;
