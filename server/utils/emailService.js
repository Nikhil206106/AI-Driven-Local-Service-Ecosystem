import nodemailer from 'nodemailer';

// Create a transporter using Gmail (or any SMTP service)
// Ensure you add EMAIL_USER and EMAIL_PASS to your .env file
const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_PASS, // Your Gmail App Password (not login password)
  },
});

export const sendOtpEmail = async (to, otp, customerName) => {
  const mailOptions = {
    from: `"Swayam Services" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: 'Service Completion Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #2563eb; padding: 20px; text-align: center;">
          <h2 style="color: white; margin: 0;">Service Verification</h2>
        </div>
        <div style="padding: 20px;">
          <p>Hello <strong>${customerName}</strong>,</p>
          <p>Your vendor has requested to mark the service as completed. Please provide the following OTP to verify the work:</p>
          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="letter-spacing: 5px; color: #1f2937; margin: 0; font-size: 32px;">${otp}</h1>
          </div>
          <p style="color: #6b7280; font-size: 14px;">If you did not authorize this, please contact support.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 OTP Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending OTP email:', error);
    return false;
  }
};