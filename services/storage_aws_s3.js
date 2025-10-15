const storage_base = require('./storage_base');
const { envVar } = require('./env');
const AWS = require('aws-sdk');

class storage_aws_s3 extends storage_base {
    constructor() {
        super();
        this.bucket = envVar('AWS_BUCKET');
        this.region = envVar('AWS_REGION');
        this.moviesFolderName = envVar('MOVIES_FOLDER');

        if (!this.bucket || !this.region || !envVar('AWS_ACCESS_KEY_ID') || !envVar('AWS_SECRET_ACCESS_KEY')) {
            console.error("AWS S3 environment variables are not fully configured.");
            return;
        }

        // Configure AWS SDK v2
        AWS.config.update({
            region: this.region,
            accessKeyId: envVar('AWS_ACCESS_KEY_ID'),
            secretAccessKey: envVar('AWS_SECRET_ACCESS_KEY'),
        });

        this.s3 = new AWS.S3();
    }

    async getFiles(subFolder = null) {
        try {
            const folderPrefix = subFolder
                ? `${this.moviesFolderName}/${subFolder}/`
                : `${this.moviesFolderName}/`;

            const params = {
                Bucket: this.bucket,
                Prefix: folderPrefix,
            };

            const response = await this.s3.listObjectsV2(params).promise();
            if (!response.Contents) {
                return [];
            }

            const files = response.Contents
                .filter(c => !c.Key.endsWith('/')) // Exclude folder objects
                .map(c => {
                    const keyParts = c.Key.split('/');
                    const fileName = keyParts[keyParts.length - 1];
                    const moviesIndex = keyParts.indexOf(this.moviesFolderName);
                    
                    const sub = keyParts.length > moviesIndex + 2 ? keyParts.slice(moviesIndex + 1, -1).join('/') : null;

                    return {
                        name: fileName,
                        url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${c.Key}`,
                        subFolder: sub,
                    };
                });

            return files;
        } catch (e) {
            console.error("Error getting files from S3:", e);
            return [];
        }
    }

    async deleteFile(fileName, subFolder = null) {
        // **FIX:** Construct the S3 key using forward slashes `/` explicitly.
        let key = this.moviesFolderName;
        if (subFolder) {
            key += `/${subFolder}`;
        }
        key += `/${fileName}`;

        const params = {
            Bucket: this.bucket,
            Key: key
        };

        try {
            await this.s3.deleteObject(params).promise();
            return { success: true, message: `File ${fileName} was deleted successfully.` };
        } catch (e) {
            console.error(`Failed to delete S3 object with key "${key}":`, e);
            return { success: false, message: e.message };
        }
    }
    
    // NOTE: uploadFile logic is not included as it wasn't requested for the fix.
    async uploadFile(req, res) {
        return { success: false, message: 'S3 server-side upload not implemented in this fix.' };
    }
}

module.exports = new storage_aws_s3();