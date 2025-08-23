const fs = require('fs');
const path = require('path');

class PDFGenerator {
    constructor() {
        this.outputDir = './invoices/pdf';
        this.tempDir = './temp';
        this.options = {
            format: 'A4',
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            },
            printBackground: true,
            preferCSSPageSize: true
        };
    }

    async generateInvoicePDF(invoiceHtml, invoiceNumber, options = {}) {
        try {
            const mergedOptions = { ...this.options, ...options };
            const fileName = `invoice_${invoiceNumber}_${Date.now()}.pdf`;
            const outputPath = path.join(this.outputDir, fileName);

            if (!fs.existsSync(this.outputDir)) {
                fs.mkdirSync(this.outputDir, { recursive: true });
            }

            const puppeteer = require('puppeteer');
            const browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            await page.setContent(invoiceHtml, { waitUntil: 'networkidle0' });

            await page.pdf({
                path: outputPath,
                format: mergedOptions.format,
                margin: mergedOptions.margin,
                printBackground: mergedOptions.printBackground,
                preferCSSPageSize: mergedOptions.preferCSSPageSize
            });

            await browser.close();

            return {
                success: true,
                filePath: outputPath,
                fileName: fileName,
                fileSize: fs.statSync(outputPath).size
            };

        } catch (error) {
            console.error('PDF generation failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async generateBatchPDFs(invoices) {
        const results = [];

        for (const invoice of invoices) {
            try {
                const result = await this.generateInvoicePDF(
                    invoice.html,
                    invoice.invoiceNumber,
                    invoice.options
                );
                results.push({
                    invoiceNumber: invoice.invoiceNumber,
                    ...result
                });
            } catch (error) {
                results.push({
                    invoiceNumber: invoice.invoiceNumber,
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    async addWatermark(pdfPath, watermarkText) {
        try {
            const PDFDocument = require('pdf-lib').PDFDocument;
            const fs = require('fs');

            const existingPdfBytes = fs.readFileSync(pdfPath);
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            const pages = pdfDoc.getPages();

            for (const page of pages) {
                const { width, height } = page.getSize();
                page.drawText(watermarkText, {
                    x: width / 2 - 50,
                    y: height / 2,
                    size: 50,
                    opacity: 0.2,
                    rotate: { type: 'degrees', angle: 45 }
                });
            }

            const pdfBytes = await pdfDoc.save();
            fs.writeFileSync(pdfPath, pdfBytes);

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async mergePDFs(pdfPaths, outputFileName) {
        try {
            const PDFDocument = require('pdf-lib').PDFDocument;
            const mergedPdf = await PDFDocument.create();

            for (const pdfPath of pdfPaths) {
                const pdfBytes = fs.readFileSync(pdfPath);
                const pdf = await PDFDocument.load(pdfBytes);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            const mergedPdfBytes = await mergedPdf.save();
            const outputPath = path.join(this.outputDir, outputFileName);
            fs.writeFileSync(outputPath, mergedPdfBytes);

            return {
                success: true,
                filePath: outputPath,
                fileSize: mergedPdfBytes.length
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async compressPDF(pdfPath, quality = 'medium') {
        const qualitySettings = {
            low: { imageQuality: 50, colorImageResolution: 150 },
            medium: { imageQuality: 75, colorImageResolution: 200 },
            high: { imageQuality: 90, colorImageResolution: 300 }
        };

        const settings = qualitySettings[quality] || qualitySettings.medium;

        try {
            return { success: true, message: 'Compression simulated', settings };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async splitPDF(pdfPath, pageRanges) {
        try {
            const PDFDocument = require('pdf-lib').PDFDocument;
            const pdfBytes = fs.readFileSync(pdfPath);
            const pdf = await PDFDocument.load(pdfBytes);
            const results = [];

            for (let i = 0; i < pageRanges.length; i++) {
                const range = pageRanges[i];
                const newPdf = await PDFDocument.create();
                const pages = await newPdf.copyPages(pdf, range);
                pages.forEach(page => newPdf.addPage(page));

                const newPdfBytes = await newPdf.save();
                const fileName = `split_${i + 1}_${Date.now()}.pdf`;
                const outputPath = path.join(this.outputDir, fileName);
                fs.writeFileSync(outputPath, newPdfBytes);

                results.push({
                    fileName: fileName,
                    filePath: outputPath,
                    pageRange: range
                });
            }

            return { success: true, files: results };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    setOutputDirectory(directory) {
        this.outputDir = directory;
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }
    }

    listGeneratedPDFs() {
        try {
            if (!fs.existsSync(this.outputDir)) {
                return [];
            }

            const files = fs.readdirSync(this.outputDir);
            return files
                .filter(file => file.endsWith('.pdf'))
                .map(file => {
                    const filePath = path.join(this.outputDir, file);
                    const stats = fs.statSync(filePath);
                    return {
                        fileName: file,
                        filePath: filePath,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    };
                });
        } catch (error) {
            return [];
        }
    }

    async deletePDF(fileName) {
        try {
            const filePath = path.join(this.outputDir, fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return { success: true };
            }
            return { success: false, error: 'File not found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    cleanupTempFiles() {
        try {
            if (fs.existsSync(this.tempDir)) {
                const files = fs.readdirSync(this.tempDir);
                for (const file of files) {
                    fs.unlinkSync(path.join(this.tempDir, file));
                }
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    getStorageStats() {
        try {
            const files = this.listGeneratedPDFs();
            const totalSize = files.reduce((sum, file) => sum + file.size, 0);
            
            return {
                totalFiles: files.length,
                totalSize: totalSize,
                totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
                oldestFile: files.length > 0 ? Math.min(...files.map(f => f.created)) : null,
                newestFile: files.length > 0 ? Math.max(...files.map(f => f.created)) : null
            };
        } catch (error) {
            return { error: error.message };
        }
    }
}

module.exports = PDFGenerator;
