const { Schema, model } = require('mongoose');

const SettingSchema = new Schema(
    {
        user_id: { 
            type:String, 
            required:true 
        },
        data: {
            type: Schema.Types.Mixed,
        },
    },
);
    
const Setting = model('Setting', SettingSchema);

module.exports = Setting;
