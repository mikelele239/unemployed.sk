'use strict';

/**
 * CV Generator — produces a PDF in the exact unemployed.sk house format.
 *
 * Layout (matches provided template):
 *   • Name — centred, 26pt bold
 *   • Contact line — centred, 10pt
 *   • SECTION HEADERS — all-caps 11pt, full-width underline rule
 *   • Institution / Role — left bold, Location right-aligned (same line)
 *   • Degree / Company — left regular, Date right-aligned (same line)
 *   • Bullet points — "- " prefix, 10pt
 *   • SKILLS — "Category: value" lines
 */

const PDFDocument = require('pdfkit');

// ── Constants ─────────────────────────────────────────────────────────────────

const MARGIN   = 57;    // pt (≈ 2 cm)
const PAGE_W   = 595.28; // A4
const CONTENT_W = PAGE_W - MARGIN * 2;
const FONT_NORMAL  = 'Helvetica';
const FONT_BOLD    = 'Helvetica-Bold';
const SIZE_NAME    = 26;
const SIZE_CONTACT = 10;
const SIZE_SECTION = 11;
const SIZE_BODY    = 10;
const SIZE_BULLET  = 10;
const COLOR_BLACK  = '#000000';
const SECTION_GAP  = 10;   // space before each section header
const AFTER_RULE   = 4;    // space after the section rule
const LINE_GAP     = 2;    // extra gap between body lines

// ── Helpers ───────────────────────────────────────────────────────────────────

function addSectionHeader(doc, title) {
  doc.moveDown(SECTION_GAP / SIZE_BODY);
  doc.font(FONT_NORMAL).fontSize(SIZE_SECTION).fillColor(COLOR_BLACK);
  doc.text(title.toUpperCase(), MARGIN, doc.y, { width: CONTENT_W });
  const ruleY = doc.y + 2;
  doc.moveTo(MARGIN, ruleY).lineTo(MARGIN + CONTENT_W, ruleY).lineWidth(0.75).stroke(COLOR_BLACK);
  doc.moveDown(AFTER_RULE / SIZE_SECTION);
}

/**
 * Write a two-column line: left text (bold optional), right text aligned right.
 */
function addTwoCol(doc, left, right, { bold = false, fontSize = SIZE_BODY } = {}) {
  doc.fontSize(fontSize).fillColor(COLOR_BLACK);

  const rightW = right ? doc.widthOfString(right, { fontSize }) + 2 : 0;
  const leftW  = CONTENT_W - rightW;

  const y = doc.y;

  // Left side
  doc.font(bold ? FONT_BOLD : FONT_NORMAL)
     .text(left || '', MARGIN, y, { width: leftW, lineBreak: false });

  // Right side (right-aligned)
  if (right) {
    doc.font(FONT_NORMAL)
       .text(right, MARGIN + leftW, y, { width: rightW, align: 'right', lineBreak: false });
  }

  doc.moveDown(0.1);
  doc.y = y + fontSize + LINE_GAP;
}

/**
 * Write a bullet point "- text"
 */
function addBullet(doc, text, indent = 10) {
  doc.font(FONT_NORMAL).fontSize(SIZE_BULLET).fillColor(COLOR_BLACK);
  doc.text(`- ${text}`, MARGIN + indent, doc.y, { width: CONTENT_W - indent, lineGap: LINE_GAP });
}

// ── Main Generator ────────────────────────────────────────────────────────────

/**
 * Generate a PDF buffer from a structured CV data object.
 *
 * @param {Object} cv
 * @param {string} cv.name               Full name
 * @param {string} cv.phone              Phone number(s)
 * @param {string} cv.email
 * @param {string} cv.location           City / Country
 * @param {string} cv.nationality        Optional
 * @param {Array}  cv.education          [{school, degree, location, start, end}]
 * @param {Array}  cv.work_experience    [{title, company, location, start, end, bullets:[]}]
 * @param {Array}  cv.extracurricular    [{title, date, bullets:[]}]
 * @param {Object} cv.skills             {primary:[], technical:[], linguistic:[]}
 * @returns {Promise<Buffer>}
 */
async function generateCvPdf(cv) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: { Title: `${cv.name || 'CV'} — unemployed.sk`, Author: cv.name || '' },
    });

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── HEADER ────────────────────────────────────────────────────────────────
    doc.font(FONT_BOLD).fontSize(SIZE_NAME).fillColor(COLOR_BLACK);
    doc.text(cv.name || 'Your Name', MARGIN, MARGIN, { width: CONTENT_W, align: 'center' });
    doc.moveDown(0.3);

    // Contact line
    const contactParts = [cv.phone, cv.email, cv.location].filter(Boolean);
    if (cv.nationality) contactParts.push(cv.nationality);
    doc.font(FONT_NORMAL).fontSize(SIZE_CONTACT).fillColor(COLOR_BLACK);
    doc.text(contactParts.join('  |  '), MARGIN, doc.y, { width: CONTENT_W, align: 'center' });
    doc.moveDown(0.5);

    // ── EDUCATION ────────────────────────────────────────────────────────────
    const education = cv.education || [];
    if (education.length > 0) {
      addSectionHeader(doc, 'Education');
      for (const edu of education) {
        addTwoCol(doc, edu.school || '', edu.location || '', { bold: true });
        addTwoCol(doc, edu.degree || '', `${edu.start || ''} - ${edu.end || 'Present'}`.trim());
        if (edu.note) addBullet(doc, edu.note);
        doc.moveDown(0.3);
      }
    }

    // ── WORK EXPERIENCE ───────────────────────────────────────────────────────
    const work = cv.work_experience || [];
    if (work.length > 0) {
      addSectionHeader(doc, 'Work Experience');
      for (const job of work) {
        addTwoCol(doc, job.title || '', job.location || '', { bold: true });
        addTwoCol(doc, job.company || '', `${job.start || ''} - ${job.end || 'Present'}`.trim());
        for (const bullet of (job.bullets || [])) {
          addBullet(doc, bullet);
        }
        doc.moveDown(0.3);
      }
    }

    // ── EXTRACURRICULAR / LEADERSHIP ─────────────────────────────────────────
    const extra = cv.extracurricular || [];
    if (extra.length > 0) {
      addSectionHeader(doc, 'Extracurricular / Leadership');
      for (const item of extra) {
        addTwoCol(doc, item.title || '', item.date || '', { bold: true });
        for (const bullet of (item.bullets || [])) {
          addBullet(doc, bullet);
        }
        doc.moveDown(0.3);
      }
    }

    // ── SKILLS ────────────────────────────────────────────────────────────────
    const skills = cv.skills || {};
    const hasSkills = (skills.primary?.length || skills.technical?.length || skills.linguistic?.length);
    if (hasSkills) {
      addSectionHeader(doc, 'Skills');
      doc.fontSize(SIZE_BODY).fillColor(COLOR_BLACK);

      if (skills.primary?.length) {
        doc.font(FONT_BOLD).text('Primary: ', MARGIN, doc.y, { continued: true, lineGap: LINE_GAP });
        doc.font(FONT_NORMAL).text(skills.primary.join(', '), { lineGap: LINE_GAP });
      }
      if (skills.technical?.length) {
        doc.font(FONT_BOLD).text('Technological: ', MARGIN, doc.y, { continued: true, lineGap: LINE_GAP });
        doc.font(FONT_NORMAL).text(skills.technical.join(', '), { lineGap: LINE_GAP });
      }
      if (skills.linguistic?.length) {
        doc.font(FONT_BOLD).text('Linguistic: ', MARGIN, doc.y, { continued: true, lineGap: LINE_GAP });
        doc.font(FONT_NORMAL).text(skills.linguistic.join(', '), { lineGap: LINE_GAP });
      }
    }

    doc.end();
  });
}

module.exports = { generateCvPdf };
