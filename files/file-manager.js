const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class FileManager {
    constructor(options = {}) {
        this.baseDir = options.baseDir || './uploads';
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.allowedExtensions = options.allowedExtensions || ['.jpg', '.png', '.pdf', '.txt'];
        this.chunkSize = options.chunkSize || 64 * 1024; // 64KB
        this.tempDir = options.tempDir || './temp';
        this.ensureDirectories();
    }

    ensureDirectories() {
        [this.baseDir, this.tempDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    async saveFile(filePath, content, options = {}) {
        const fullPath = this.resolvePath(filePath);
        this.validatePath(fullPath);

        if (options.createDir && !fs.existsSync(path.dirname(fullPath))) {
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        }

        if (typeof content === 'string') {
            fs.writeFileSync(fullPath, content, options.encoding || 'utf8');
        } else {
            fs.writeFileSync(fullPath, content);
        }

        return fullPath;
    }

    async readFile(filePath, options = {}) {
        const fullPath = this.resolvePath(filePath);
        this.validatePath(fullPath);

        if (!fs.existsSync(fullPath)) {
            throw new Error('File not found');
        }

        if (options.encoding) {
            return fs.readFileSync(fullPath, options.encoding);
        }

        return fs.readFileSync(fullPath);
    }

    async deleteFile(filePath) {
        const fullPath = this.resolvePath(filePath);
        this.validatePath(fullPath);

        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            return true;
        }

        return false;
    }

    async moveFile(sourcePath, destPath) {
        const fullSource = this.resolvePath(sourcePath);
        const fullDest = this.resolvePath(destPath);

        this.validatePath(fullSource);
        this.validatePath(fullDest);

        fs.renameSync(fullSource, fullDest);
        return fullDest;
    }

    async copyFile(sourcePath, destPath) {
        const fullSource = this.resolvePath(sourcePath);
        const fullDest = this.resolvePath(destPath);

        this.validatePath(fullSource);
        this.validatePath(fullDest);

        fs.copyFileSync(fullSource, fullDest);
        return fullDest;
    }

    getFileInfo(filePath) {
        const fullPath = this.resolvePath(filePath);
        this.validatePath(fullPath);

        if (!fs.existsSync(fullPath)) {
            return null;
        }

        const stats = fs.statSync(fullPath);
        const ext = path.extname(fullPath);

        return {
            path: filePath,
            fullPath: fullPath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            extension: ext,
            isDirectory: stats.isDirectory(),
            readable: this.isReadable(fullPath),
            writable: this.isWritable(fullPath)
        };
    }

    listFiles(directory = '', options = {}) {
        const fullPath = this.resolvePath(directory);
        this.validatePath(fullPath);

        if (!fs.existsSync(fullPath)) {
            return [];
        }

        let files = fs.readdirSync(fullPath);

        if (options.filter) {
            files = files.filter(file => options.filter(file));
        }

        if (options.sort) {
            files.sort(options.sort);
        }

        return files.map(file => {
            const filePath = path.join(directory, file);
            return this.getFileInfo(filePath);
        });
    }

    createDirectory(dirPath) {
        const fullPath = this.resolvePath(dirPath);
        this.validatePath(fullPath);

        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            return true;
        }

        return false;
    }

    deleteDirectory(dirPath, recursive = false) {
        const fullPath = this.resolvePath(dirPath);
        this.validatePath(fullPath);

        if (fs.existsSync(fullPath)) {
            if (recursive) {
                fs.rmdirSync(fullPath, { recursive: true });
            } else {
                fs.rmdirSync(fullPath);
            }
            return true;
        }

        return false;
    }

    resolvePath(filePath) {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }

        return path.resolve(this.baseDir, filePath);
    }

    validatePath(filePath) {
        const resolved = path.resolve(filePath);
        const baseResolved = path.resolve(this.baseDir);

        if (!resolved.startsWith(baseResolved)) {
            throw new Error('Access denied: Path outside allowed directory');
        }

        // Check for dangerous characters
        if (filePath.includes('..') || filePath.includes('\0')) {
            throw new Error('Invalid file path');
        }
    }

    validateFile(filePath, content) {
        const ext = path.extname(filePath).toLowerCase();

        if (!this.allowedExtensions.includes(ext)) {
            throw new Error(`File type not allowed: ${ext}`);
        }

        if (content && content.length > this.maxFileSize) {
            throw new Error(`File too large: ${content.length} bytes`);
        }

        return true;
    }

    generateFileName(originalName, options = {}) {
        const ext = path.extname(originalName);
        const baseName = path.basename(originalName, ext);

        let newName = baseName;

        if (options.prefix) {
            newName = `${options.prefix}_${newName}`;
        }

        if (options.timestamp) {
            newName = `${newName}_${Date.now()}`;
        }

        if (options.hash) {
            const hash = crypto.createHash('md5').update(originalName + Date.now()).digest('hex').substring(0, 8);
            newName = `${newName}_${hash}`;
        }

        return `${newName}${ext}`;
    }

    async uploadFile(file, destination, options = {}) {
        const fileName = this.generateFileName(file.originalname || file.name, options);
        const filePath = path.join(destination, fileName);

        this.validateFile(fileName, file.buffer || file.data);

        if (file.buffer) {
            await this.saveFile(filePath, file.buffer);
        } else if (file.path) {
            await this.copyFile(file.path, filePath);
        }

        return {
            originalName: file.originalname || file.name,
            filename: fileName,
            path: filePath,
            size: file.size,
            mimetype: file.mimetype
        };
    }

    async streamFile(filePath, res, options = {}) {
        const fullPath = this.resolvePath(filePath);
        this.validatePath(fullPath);

        if (!fs.existsSync(fullPath)) {
            throw new Error('File not found');
        }

        const stat = fs.statSync(fullPath);
        const fileSize = stat.size;
        const range = options.range;

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (start >= fileSize) {
                res.status(416).send('Requested range not satisfiable');
                return;
            }

            const chunkSize = (end - start) + 1;
            const file = fs.createReadStream(fullPath, { start, end });

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': this.getMimeType(filePath)
            });

            file.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': this.getMimeType(filePath)
            });

            fs.createReadStream(fullPath).pipe(res);
        }
    }

    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.txt': 'text/plain',
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.jpg': 'image/jpeg',
            '.png': 'image/png',
            '.pdf': 'application/pdf',
            '.zip': 'application/zip'
        };

        return mimeTypes[ext] || 'application/octet-stream';
    }

    async compressFile(filePath, outputPath) {
        const zlib = require('zlib');
        const fullInput = this.resolvePath(filePath);
        const fullOutput = this.resolvePath(outputPath);

        this.validatePath(fullInput);
        this.validatePath(fullOutput);

        return new Promise((resolve, reject) => {
            const gzip = zlib.createGzip();
            const input = fs.createReadStream(fullInput);
            const output = fs.createWriteStream(fullOutput);

            input.pipe(gzip).pipe(output);

            output.on('finish', resolve);
            output.on('error', reject);
        });
    }

    async extractArchive(archivePath, extractTo) {
        // Placeholder for archive extraction
        const fullArchive = this.resolvePath(archivePath);
        const fullExtract = this.resolvePath(extractTo);

        this.validatePath(fullArchive);
        this.validatePath(fullExtract);

        // Mock extraction
        console.log(`Extracting ${archivePath} to ${extractTo}`);
        return true;
    }

    searchFiles(directory, searchTerm, options = {}) {
        const files = this.listFiles(directory, options);
        const results = [];

        for (const file of files) {
            if (file.isDirectory) continue;

            try {
                const content = this.readFile(file.path, { encoding: 'utf8' });
                if (content.includes(searchTerm)) {
                    results.push({
                        file: file,
                        matches: (content.match(new RegExp(searchTerm, 'g')) || []).length
                    });
                }
            } catch (error) {
                // Skip files that can't be read
            }
        }

        return results;
    }

    calculateDirectorySize(directory) {
        const files = this.listFiles(directory);
        let totalSize = 0;

        for (const file of files) {
            if (!file.isDirectory) {
                totalSize += file.size;
            } else {
                totalSize += this.calculateDirectorySize(file.path);
            }
        }

        return totalSize;
    }

    isReadable(filePath) {
        try {
            fs.accessSync(filePath, fs.constants.R_OK);
            return true;
        } catch (error) {
            return false;
        }
    }

    isWritable(filePath) {
        try {
            fs.accessSync(filePath, fs.constants.W_OK);
            return true;
        } catch (error) {
            return false;
        }
    }

    getDiskUsage() {
        // Placeholder for disk usage
        return {
            total: 1000000000, // 1GB
            used: 500000000,   // 500MB
            available: 500000000
        };
    }

    createBackup(sourceDir, backupName) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join('./backups', `${backupName}_${timestamp}.tar.gz`);

        // Placeholder for backup creation
        console.log(`Creating backup: ${sourceDir} -> ${backupPath}`);
        return backupPath;
    }

    cleanupTempFiles(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
        const cutoff = Date.now() - maxAge;
        const tempFiles = this.listFiles(this.tempDir);

        for (const file of tempFiles) {
            if (file.modified.getTime() < cutoff) {
                this.deleteFile(file.path);
            }
        }
    }

    getStats() {
        return {
            baseDir: this.baseDir,
            totalFiles: this.countFiles(),
            totalSize: this.calculateDirectorySize(''),
            tempFiles: this.listFiles(this.tempDir).length,
            diskUsage: this.getDiskUsage()
        };
    }

    countFiles(directory = '') {
        const items = this.listFiles(directory);
        let count = 0;

        for (const item of items) {
            if (item.isDirectory) {
                count += this.countFiles(item.path);
            } else {
                count++;
            }
        }

        return count;
    }

    watchDirectory(directory, callback) {
        const fullPath = this.resolvePath(directory);
        this.validatePath(fullPath);

        return fs.watch(fullPath, (eventType, filename) => {
            if (filename) {
                callback(eventType, filename);
            }
        });
    }

    async generateThumbnail(imagePath, outputPath, size = 200) {
        // Placeholder for image thumbnail generation
        const fullImage = this.resolvePath(imagePath);
        const fullOutput = this.resolvePath(outputPath);

        this.validatePath(fullImage);
        this.validatePath(fullOutput);

        // Mock thumbnail generation
        const content = `Thumbnail of ${imagePath} at ${size}x${size}`;
        await this.saveFile(outputPath, content);

        return outputPath;
    }

    validateImageFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const allowedImageExt = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];

        if (!allowedImageExt.includes(ext)) {
            throw new Error('Invalid image file type');
        }

        // Mock image validation
        return true;
    }

    getFileHash(filePath) {
        const fullPath = this.resolvePath(filePath);
        this.validatePath(fullPath);

        const content = fs.readFileSync(fullPath);
        return crypto.createHash('sha256').update(content).digest('hex');
    }
}

module.exports = FileManager;
