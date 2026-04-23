import PDFDocument from 'pdfkit';

const doc = new PDFDocument({ size: 'A4', margin: 50 });
const chunks = [];
doc.on('data', chunk => chunks.push(chunk));
const done = new Promise((res, rej) => {
  doc.on('end', () => res(Buffer.concat(chunks)));
  doc.on('error', rej);
});
doc.fontSize(24).font('Helvetica-Bold').text('Test PDF AgilesTest');
doc.moveDown();
doc.fontSize(12).font('Helvetica').text('Si ce texte apparaît, pdfkit fonctionne.');
doc.end();
const buf = await done;
console.log('PDF generated successfully, size:', buf.length, 'bytes');

import fs from 'fs';
fs.writeFileSync('/tmp/test-agilestest.pdf', buf);
console.log('Written to /tmp/test-agilestest.pdf');
