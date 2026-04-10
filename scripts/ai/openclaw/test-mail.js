import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: 'devapp@cic.com.vn', pass: 'hxkmwrulkqodpcxj' }
});
transporter.verify().then(() => console.log('SMTP OK')).catch(e => console.error('SMTP ERROR:', e.message));
