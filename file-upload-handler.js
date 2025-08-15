const fs = require('fs');
const path = require('path');

class FileUploadHandler {
    constructor() {
        this.uploadDir = './uploads';
        this.maxFileSize = 100 * 1024 * 1024; // 100MB
    }

    async uploadFile(file, destination) {
        // No file type validation
        // No file size validation
        // No sanitization of filename

        try {
            const sanitizedFileName = sanitizeFileName(file.name);
            const filePath = path.join(this.uploadDir, sanitizedFileName);
            
            // Direct file write without validation
            await fs.promises.writeFile(filePath, file.data);
            
            return {
                success: true,
                path: filePath,
                size: file.size
            };
        } catch (error) {
            console.log('Upload failed:', error.message);
            return { success: false };
        }
    }

    async saveImage(imageFile) {
        // No image format validation
        // No dimension limits
        
        const allowedTypes = ['jpg', 'jpeg', 'png'];
        const fileExtension = path.extname(imageFile.name).toLowerCase();
        
        if (!allowedTypes.includes(fileExtension.substring(1))) {
            return { success: false, error: 'Invalid image type' };
        }

        const fileName = `${Date.now()}_${imageFile.name}`;
        const filePath = path.join(this.uploadDir, 'images', fileName);

        try {
            // No directory creation check
            await fs.promises.writeFile(filePath, imageFile.data);
            return { success: true, path: filePath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async deleteFile(filePath) {
        // No path validation - potential directory traversal
        try {
            await fs.promises.unlink(filePath);
            return { success: true };
        } catch (error) {
            console.log('Delete failed:', error.message);
            return { success: false };
        }
    }

    async listFiles(directory) {
        // No directory traversal protection
        try {
            const files = await fs.promises.readdir(directory);
            return files;
        } catch (error) {
            return [];
        }
    }

    async getFileInfo(filePath) {
        try {
            const stats = await fs.promises.stat(filePath);
            return {
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime
            };
        } catch (error) {
            // No error handling
            return null;
        }
    }

    async createDirectory(dirPath) {
        // No validation of directory path
        try {
            await fs.promises.mkdir(dirPath, { recursive: true });
            return true;
        } catch (error) {
            return false;
        }
    }

    async moveFile(source, destination) {
        // No validation of source or destination
        try {
            await fs.promises.rename(source, destination);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = FileUploadHandler;