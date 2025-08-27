import PDFDocument from 'pdfkit';
import { Buffer } from 'buffer';
import { IContractAnalysis } from '../models/contract.model';

interface PDFMetadata {
    companyName: string;
    userName: string;
    generatedDate: Date;
    contractId: string;
}

interface ContractSection {
    title: string;
    content: string;
    isClause: boolean;
    hasModification?: boolean;
    modificationText?: string;
}

// Enhanced contract text parser
const parseContractContent = (text: string): ContractSection[] => {
    const sections: ContractSection[] = [];
    
    // Split by double line breaks to identify sections
    const rawSections = text.split(/\n\s*\n/);
    
    for (let i = 0; i < rawSections.length; i++) {
        const section = rawSections[i].trim();
        if (!section) continue;
        
        // Check if this looks like a title/header (short line, possibly numbered)
        const lines = section.split('\n');
        const firstLine = lines[0].trim();
        
        // Title patterns: numbered sections, all caps, or short lines that end with colon
        const isTitlePattern = /^(\d+\.?\s+|[A-Z\s]{3,}:?\s*$|ARTICLE|SECTION|CLAUSE)/i.test(firstLine);
        const isShortTitle = firstLine.length < 100 && (firstLine.endsWith(':') || lines.length === 1);
        
        if ((isTitlePattern || isShortTitle) && lines.length === 1) {
            // This is likely a section title
            sections.push({
                title: firstLine,
                content: '',
                isClause: false
            });
        } else if (firstLine.match(/^(\d+\.?\s+|[A-Z\s]{3,}:)/i) && lines.length > 1) {
            // This is a titled section with content
            sections.push({
                title: firstLine,
                content: lines.slice(1).join('\n').trim(),
                isClause: true
            });
        } else {
            // This is regular content
            sections.push({
                title: '',
                content: section,
                isClause: true
            });
        }
    }
    
    return sections;
};

// Clean modified content by removing modification markers
const cleanModifiedContent = (text: string): string => {
    return text.replace(/\[MODIFIED\](.*?)\[\/MODIFIED\]/g, '$1');
};

// Extract modifications for separate highlighting with improved parsing
const extractModifications = (text: string): { 
    cleanText: string; 
    modifications: Array<{ start: number; end: number; text: string; originalText?: string }> 
} => {
    const modifications: Array<{ start: number; end: number; text: string; originalText?: string }> = [];
    let cleanText = '';
    let lastIndex = 0;
    
    const regex = /\[MODIFIED\](.*?)\[\/MODIFIED\]/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        // Add text before modification
        const beforeText = text.substring(lastIndex, match.index);
        cleanText += beforeText;
        
        // Add modified text
        const modifiedText = match[1];
        const start = cleanText.length;
        cleanText += modifiedText;
        const end = cleanText.length;
        
        modifications.push({
            start,
            end,
            text: modifiedText
        });
        
        lastIndex = regex.lastIndex;
    }
    
    // Add remaining text
    cleanText += text.substring(lastIndex);
    
    return { cleanText, modifications };
};

// Enhanced parse for modified contract content
const parseModifiedContractContent = (text: string): ContractSection[] => {
    const { cleanText, modifications } = extractModifications(text);
    const sections = parseContractContent(cleanText);
    
    // Mark sections that contain modifications
    sections.forEach((section) => {
        const sectionText = section.title + ' ' + section.content;
        const sectionStart = cleanText.indexOf(sectionText);
        
        if (sectionStart !== -1) {
            const sectionEnd = sectionStart + sectionText.length;
            const hasModification = modifications.some(mod => 
                (mod.start >= sectionStart && mod.start < sectionEnd) ||
                (mod.end > sectionStart && mod.end <= sectionEnd) ||
                (mod.start <= sectionStart && mod.end >= sectionEnd)
            );
            
            if (hasModification) {
                section.hasModification = true;
                // Find the specific modification text in this section
                const sectionModifications = modifications.filter(mod => 
                    (mod.start >= sectionStart && mod.start < sectionEnd) ||
                    (mod.end > sectionStart && mod.end <= sectionEnd) ||
                    (mod.start <= sectionStart && mod.end >= sectionEnd)
                );
                section.modificationText = sectionModifications.map(mod => mod.text).join('; ');
            }
        }
    });
    
    return sections;
};

// Add watermark/logo
const addWatermark = (doc: PDFKit.PDFDocument, isGold: boolean = false) => {
    doc.save();
    doc.opacity(0.08);
    
    const centerX = doc.page.width / 2;
    const centerY = doc.page.height / 2;
    
    // Rotate and add watermark text in one line
    doc.rotate(45, { origin: [centerX, centerY] });
    
    if (isGold) {
        doc.fontSize(48)
           .fillColor('#f59e0b')
           .text('LEXALYZE GOLD', centerX - 120, centerY - 15, { 
               align: 'center',
               width: 240
           });
    } else {
        doc.fontSize(48)
           .fillColor('#1a56db')
           .text('LEXALYZE', centerX - 80, centerY - 15, { 
               align: 'center',
               width: 160
           });
    }
    
    doc.restore();
};

// Enhanced header function
const addHeader = (doc: PDFKit.PDFDocument, title: string, metadata: PDFMetadata, isGold: boolean = false) => {
    const headerColor = isGold ? '#f59e0b' : '#1a56db';
    const bgColor = isGold ? '#fffbeb' : '#eff6ff';
    
    // Header background
    doc.rect(0, 0, doc.page.width, 100)
       .fill(bgColor);
    
    // Company branding
    doc.fontSize(16)
       .fillColor(headerColor)
       .font('Helvetica-Bold')
       .text('LEXALYZE', 40, 25);
    
    if (isGold) {
        doc.fontSize(12)
           .fillColor('#d97706')
           .text('GOLD', 40, 45);
    }
    
    // Contract info
    doc.fontSize(10)
       .fillColor('#6b7280')
       .font('Helvetica')
       .text(`Contract ID: ${metadata.contractId}`, doc.page.width - 200, 25, { width: 160, align: 'right' })
       .text(`Generated: ${metadata.generatedDate.toLocaleDateString()}`, doc.page.width - 200, 50, { width: 160, align: 'right' })
       .text(`For: ${metadata.userName}`, doc.page.width - 200, 65, { width: 160, align: 'right' });
    
    // Title
    doc.fontSize(22)
       .fillColor('#1f2937')
       .font('Helvetica-Bold')
       .text(title, 40, 120, { align: 'center', width: doc.page.width - 80 });
    
    return 160; // Return the Y position where content should start
};


// Helper function to create new page with watermark only (footer added separately)
const createNewPage = (doc: PDFKit.PDFDocument, pageNum: number, isGold: boolean = false): number => {
    doc.addPage();
    addWatermark(doc, isGold);
    return 60; // Return starting Y position for content
};

// Helper function to check if we need a new page - IMPROVED with footer space calculation
const checkPageBreak = (doc: PDFKit.PDFDocument, currentY: number, neededHeight: number, pageNum: { value: number }, isGold: boolean = false): number => {
    const pageHeight = doc.page.height;
    const footerSpace = 80; // Space reserved for footer
    
    if (currentY + neededHeight > pageHeight - footerSpace) {
        // Add footer to current page before creating new one
        pageNum.value++;
        return createNewPage(doc, pageNum.value, isGold);
    }
    
    return currentY;
};

// Enhanced text rendering with modification highlighting
const renderTextWithHighlight = (
    doc: PDFKit.PDFDocument, 
    text: string, 
    x: number, 
    y: number, 
    options: any, 
    isModified: boolean = false
) => {
    if (isModified) {
        // Calculate text dimensions for background highlight
        const textHeight = doc.heightOfString(text, options);
        
        // Add background highlight with rounded corners
        doc.save();
        doc.rect(x - 5, y - 3, options.width + 10, textHeight + 6)
           .fill('#fff3cd'); // Light yellow background
        
        // Add left border indicator for modifications
        doc.rect(x - 5, y - 3, 4, textHeight + 6)
           .fill('#ffc107'); // Yellow left border
        doc.restore();
        
        // Render text with slightly bold appearance
        doc.fontSize(options.fontSize || 11)
           .fillColor('#856404') // Darker text for modified content
           .font('Helvetica-Bold')
           .text(text, x, y, options);
    } else {
        // Render normal text
        doc.fontSize(options.fontSize || 11)
           .fillColor('#111827')
           .font('Helvetica')
           .text(text, x, y, options);
    }
    
    return doc.y;
};

export const generateContractPDF = async (
    contractText: string,
    contractType: string,
    metadata: PDFMetadata
): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 40, bottom: 60, left: 40, right: 40 },
                info: {
                    Title: `${contractType} Contract`,
                    Author: metadata.companyName,
                    Subject: 'Contract Document',
                    Creator: 'Lexalyze',
                }
            });

            const buffers: Buffer[] = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            let pageNum = { value: 1 };
            
            // Add watermark to first page
            addWatermark(doc, false);
            
            // Add header
            let yPosition = addHeader(doc, `${contractType.toUpperCase()} CONTRACT`, metadata, false);
            
            // Parse contract content
            const sections = parseContractContent(contractText);
            
            // Content margins
            const leftMargin = 60;
            const rightMargin = 60;
            const contentWidth = doc.page.width - leftMargin - rightMargin;
            
            yPosition += 30; // Space after header
            
            for (let i = 0; i < sections.length; i++) {
                const section = sections[i];
                
                if (section.title && !section.isClause) {
                    // Section header - estimate height needed
                    const titleHeight = doc.heightOfString(section.title, { 
                        width: contentWidth, 
                        align: 'left' 
                    }) + 15;
                    
                    yPosition = checkPageBreak(doc, yPosition, titleHeight, pageNum, false);
                    
                    doc.fontSize(16)
                       .fillColor('#1f2937')
                       .font('Helvetica-Bold')
                       .text(section.title, leftMargin, yPosition, { 
                           width: contentWidth, 
                           align: 'left' 
                       });
                    yPosition = doc.y + 15;
                    
                } else if (section.title && section.isClause) {
                    // Clause with title - estimate height needed
                    let totalHeight = doc.heightOfString(section.title, { 
                        width: contentWidth, 
                        align: 'left' 
                    }) + 10;
                    
                    if (section.content) {
                        totalHeight += doc.heightOfString(section.content, {
                            width: contentWidth,
                            align: 'justify',
                            lineGap: 3
                        }) + 20;
                    }
                    
                    yPosition = checkPageBreak(doc, yPosition, totalHeight, pageNum, false);
                    
                    doc.fontSize(14)
                       .fillColor('#374151')
                       .font('Helvetica-Bold')
                       .text(section.title, leftMargin, yPosition, { 
                           width: contentWidth, 
                           align: 'left' 
                       });
                    yPosition = doc.y + 10;
                    
                    if (section.content) {
                        doc.fontSize(11)
                           .fillColor('#111827')
                           .font('Helvetica')
                           .text(section.content, leftMargin, yPosition, {
                               width: contentWidth,
                               align: 'justify',
                               lineGap: 3
                           });
                        yPosition = doc.y + 20;
                    }
                    
                } else if (section.content) {
                    // Regular content - estimate height needed
                    const contentHeight = doc.heightOfString(section.content, {
                        width: contentWidth,
                        align: 'justify',
                        lineGap: 3
                    }) + 15;
                    
                    yPosition = checkPageBreak(doc, yPosition, contentHeight, pageNum, false);
                    
                    doc.fontSize(11)
                       .fillColor('#111827')
                       .font('Helvetica')
                       .text(section.content, leftMargin, yPosition, {
                           width: contentWidth,
                           align: 'justify',
                           lineGap: 3
                       });
                    yPosition = doc.y + 15;
                }
            }
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

export const generateModifiedContractPDF = async (
    contractText: string,
    contractType: string,
    versionInfo: string,
    metadata: PDFMetadata
): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 40, bottom: 60, left: 40, right: 40 },
                info: {
                    Title: `${contractType} Contract - ${versionInfo}`,
                    Author: metadata.companyName,
                    Subject: 'Modified Contract Document',
                    Creator: 'Lexalyze Gold',
                }
            });

            const buffers: Buffer[] = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            let pageNum = { value: 1 };
            
            // Add watermark to first page
            addWatermark(doc, true);
            
            // Add header
            let yPosition = addHeader(doc, `${contractType.toUpperCase()} CONTRACT - MODIFIED`, metadata, true);
            
            // Parse modified contract content with highlighting
            const sections = parseModifiedContractContent(contractText);
            const { modifications } = extractModifications(contractText);
            
            // Content margins
            const leftMargin = 60;
            const rightMargin = 60;
            const contentWidth = doc.page.width - leftMargin - rightMargin;
            
            // Add modification legend if there are modifications
            if (modifications.length > 0) {
                yPosition += 10;
                
                yPosition = checkPageBreak(doc, yPosition, 80, pageNum, true);
                
                // Enhanced modification notice with professional styling
                doc.rect(leftMargin, yPosition, contentWidth, 60)
                   .fillAndStroke('#fff3cd', '#ffc107')
                   .lineWidth(2);
                   
                // Add icon-like indicator
                doc.rect(leftMargin + 10, yPosition + 10, 4, 40)
                   .fill('#ff8c00');
                
                doc.fontSize(12)
                   .fillColor('#856404')
                   .font('Helvetica-Bold')
                   .text('MODIFICATION NOTICE', leftMargin + 25, yPosition + 15)
                   .fontSize(10)
                   .font('Helvetica')
                   .text(`This document contains ${modifications.length} modification(s). `, 
                         leftMargin + 25, yPosition + 32)
                yPosition += 70;
            }
            
            yPosition += 20; // Space after header
            
            for (let i = 0; i < sections.length; i++) {
                const section = sections[i];
                
                if (section.title && !section.isClause) {
                    // Section header
                    const titleHeight = doc.heightOfString(section.title, { 
                        width: contentWidth, 
                        align: 'left' 
                    }) + 15;
                    
                    yPosition = checkPageBreak(doc, yPosition, titleHeight, pageNum, true);
                    
                    if (section.hasModification) {
                        // Highlight section titles that are modified
                        renderTextWithHighlight(doc, section.title, leftMargin, yPosition, {
                            width: contentWidth,
                            align: 'left',
                            fontSize: 16
                        }, true);
                    } else {
                        doc.fontSize(16)
                           .fillColor('#1f2937')
                           .font('Helvetica-Bold')
                           .text(section.title, leftMargin, yPosition, { 
                               width: contentWidth, 
                               align: 'left' 
                           });
                    }
                    yPosition = doc.y + 15;
                    
                } else if (section.title && section.isClause) {
                    // Clause with title
                    let totalHeight = doc.heightOfString(section.title, { 
                        width: contentWidth, 
                        align: 'left' 
                    }) + 10;
                    
                    if (section.content) {
                        totalHeight += doc.heightOfString(section.content, {
                            width: contentWidth,
                            align: 'justify',
                            lineGap: 3
                        }) + 30; // Extra space for potential highlighting
                    }
                    
                    yPosition = checkPageBreak(doc, yPosition, totalHeight, pageNum, true);
                    
                    // Render clause title with potential highlighting
                    if (section.hasModification) {
                        renderTextWithHighlight(doc, section.title, leftMargin, yPosition, {
                            width: contentWidth,
                            align: 'left',
                            fontSize: 14
                        }, true);
                    } else {
                        doc.fontSize(14)
                           .fillColor('#374151')
                           .font('Helvetica-Bold')
                           .text(section.title, leftMargin, yPosition, { 
                               width: contentWidth, 
                               align: 'left' 
                           });
                    }
                    yPosition = doc.y + 10;
                    
                    if (section.content) {
                        // Render content with highlighting if modified
                        yPosition = renderTextWithHighlight(doc, section.content, leftMargin, yPosition, {
                            width: contentWidth,
                            align: 'justify',
                            lineGap: 3,
                            fontSize: 11
                        }, section.hasModification);
                        yPosition += 20;
                    }
                    
                } else if (section.content) {
                    // Regular content
                    const contentHeight = doc.heightOfString(section.content, {
                        width: contentWidth,
                        align: 'justify',
                        lineGap: 3
                    }) + 25; // Extra space for potential highlighting
                    
                    yPosition = checkPageBreak(doc, yPosition, contentHeight, pageNum, true);
                    
                    // Render content with highlighting if modified
                    yPosition = renderTextWithHighlight(doc, section.content, leftMargin, yPosition, {
                        width: contentWidth,
                        align: 'justify',
                        lineGap: 3,
                        fontSize: 11
                    }, section.hasModification);
                    yPosition += 15;
                }
            }
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

export const generateModificationReportPDF = async (
    contract: IContractAnalysis, 
    metadata: PDFMetadata
): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: "A4",
                margins: { top: 40, bottom: 60, left: 40, right: 40 }
            });

            const buffers: Buffer[] = [];
            doc.on("data", buffers.push.bind(buffers));
            doc.on("end", () => resolve(Buffer.concat(buffers)));

            let pageNum = { value: 1 };
            
            // Add watermark to first page
            addWatermark(doc, true);
            
            // Title page
            doc.fontSize(28)
               .fillColor('#f59e0b')
               .font('Helvetica-Bold')
               .text('MODIFICATION REPORT', 0, 200, { align: 'center', width: doc.page.width });

            doc.fontSize(18)
               .fillColor('#4b5563')
               .font('Helvetica')
               .text(`${contract.contractType} Contract`, 0, 250, { align: 'center', width: doc.page.width });

            // Summary box
            doc.rect(80, 300, doc.page.width - 160, 120)
               .fillAndStroke('#fef3c7', '#f59e0b');

            doc.fontSize(12)
               .fillColor('#92400e')
               .font('Helvetica-Bold')
               .text('REPORT SUMMARY', 100, 320)
               .fontSize(11)
               .font('Helvetica')
               .text(`Contract ID: ${String(contract._id)}`, 100, 340)
               .text(`Total Modifications: ${contract.modificationHistory?.length || 0}`, 100, 355)
               .text(`Report Generated: ${metadata.generatedDate.toLocaleDateString()}`, 100, 370)
               .text(`Generated for: ${metadata.userName}`, 100, 385)
               .text(`Company: ${metadata.companyName}`, 100, 400);


            // Modification History
            if (contract.modificationHistory?.length) {
                pageNum.value++;
                let yPosition = createNewPage(doc, pageNum.value, true);

                doc.fontSize(20)
                   .fillColor('#1f2937')
                   .font('Helvetica-Bold')
                   .text('MODIFICATION HISTORY', 60, yPosition);

                yPosition += 40;
                const history = contract.modificationHistory;

                history.forEach((mod, index) => {
                    // Calculate needed height for this modification entry
                    const neededHeight = 150; // Estimated height for modification entry
                    
                    yPosition = checkPageBreak(doc, yPosition, neededHeight, pageNum, true);

                    // Version header
                    doc.rect(60, yPosition, doc.page.width - 120, 35)
                       .fillAndStroke('#f3f4f6', '#d1d5db');

                    doc.fontSize(14)
                       .fillColor('#1f2937')
                       .font('Helvetica-Bold')
                       .text(`Version ${mod.version}`, 70, yPosition + 10);

                    yPosition += 45;

                    // Modification details
                    doc.fontSize(11)
                       .fillColor('#4b5563')
                       .font('Helvetica')
                       .text(`Modified by: ${mod.modifiedBy}`, 70, yPosition)
                       .text(`Date: ${new Date(mod.modifiedAt).toLocaleDateString()} at ${new Date(mod.modifiedAt).toLocaleTimeString()}`, 70, yPosition + 15)
                       .text('Changes made:', 70, yPosition + 30)
                       .fontSize(10)
                       .fillColor('#6b7280')
                       .text(mod.changes, 70, yPosition + 45, { 
                           width: doc.page.width - 140, 
                           align: 'justify',
                           lineGap: 2
                       });

                    yPosition = doc.y + 25;

                    if (index < history.length - 1) {
                        doc.moveTo(60, yPosition)
                           .lineTo(doc.page.width - 60, yPosition)
                           .strokeColor('#e5e7eb')
                           .lineWidth(1)
                           .stroke();
                        yPosition += 15;
                    }
                });
            }
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

export const generateComparisonPDF = async (
    originalText: string,
    modifiedText: string,
    contractType: string,
    metadata: PDFMetadata
): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'landscape',
                margins: { top: 40, bottom: 60, left: 40, right: 40 }
            });

            const buffers: Buffer[] = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            let pageNum = { value: 1 };
            
            // Add watermark to first page
            addWatermark(doc, true);
            
            // Title
            doc.fontSize(18)
               .fillColor('#1f2937')
               .font('Helvetica-Bold')
               .text(`${contractType} - COMPARISON VIEW`, 0, 50, { align: 'center', width: doc.page.width });

            // Column headers
            const columnWidth = (doc.page.width - 120) / 2;
            
            doc.rect(60, 100, columnWidth, 30)
               .fillAndStroke('#eff6ff', '#1a56db');
            doc.fontSize(12)
               .fillColor('#1a56db')
               .font('Helvetica-Bold')
               .text('ORIGINAL VERSION', 70, 110);

            doc.rect(80 + columnWidth, 100, columnWidth, 30)
               .fillAndStroke('#fef3c7', '#f59e0b');
            doc.fontSize(12)
               .fillColor('#f59e0b')
               .font('Helvetica-Bold')
               .text('MODIFIED VERSION', 90 + columnWidth, 110);

            // Content
            const originalSections = parseContractContent(originalText);
            const modifiedSections = parseModifiedContractContent(modifiedText);

            let yPosition = 150;
            
            for (let i = 0; i < Math.max(originalSections.length, modifiedSections.length); i++) {
                const originalSection = originalSections[i];
                const modifiedSection = modifiedSections[i];
                
                // Calculate needed height
                let neededHeight = 0;
                if (originalSection) {
                    neededHeight = Math.max(neededHeight, doc.heightOfString(
                        originalSection.title || originalSection.content, 
                        { width: columnWidth - 20, align: 'justify' }
                    ));
                }
                if (modifiedSection) {
                    neededHeight = Math.max(neededHeight, doc.heightOfString(
                        modifiedSection.title || modifiedSection.content, 
                        { width: columnWidth - 20, align: 'justify' }
                    ));
                }
                neededHeight += 20; // Add some padding
                
                yPosition = checkPageBreak(doc, yPosition, neededHeight, pageNum, true);
                
                // If we're on a new page, add column headers again
                if (yPosition === 60) {
                    doc.rect(60, yPosition, columnWidth, 25)
                       .fillAndStroke('#eff6ff', '#1a56db');
                    doc.fontSize(10)
                       .fillColor('#1a56db')
                       .font('Helvetica-Bold')
                       .text('ORIGINAL VERSION', 70, yPosition + 7);

                    doc.rect(80 + columnWidth, yPosition, columnWidth, 25)
                       .fillAndStroke('#fef3c7', '#f59e0b');
                    doc.fontSize(10)
                       .fillColor('#f59e0b')
                       .font('Helvetica-Bold')
                       .text('MODIFIED VERSION', 90 + columnWidth, yPosition + 7);
                    
                    yPosition += 35;
                }

                // Original version content
                if (originalSection) {
                    doc.fontSize(9)
                       .fillColor('#111827')
                       .font('Helvetica')
                       .text(originalSection.title || originalSection.content, 70, yPosition, {
                           width: columnWidth - 20,
                           align: 'justify'
                       });
                }

                // Modified version content with highlighting
                if (modifiedSection) {
                    if (modifiedSection.hasModification) {
                        // Render modified content with highlighting
                        renderTextWithHighlight(doc, modifiedSection.title || modifiedSection.content, 
                            90 + columnWidth, yPosition, {
                                width: columnWidth - 20,
                                align: 'justify',
                                fontSize: 9
                            }, true);
                    } else {
                        doc.fontSize(9)
                           .fillColor('#111827')
                           .font('Helvetica')
                           .text(modifiedSection.title || modifiedSection.content, 90 + columnWidth, yPosition, {
                               width: columnWidth - 20,
                               align: 'justify'
                           });
                    }
                }

                yPosition += neededHeight;
            }
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};