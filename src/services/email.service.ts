import emailjs from '@emailjs/nodejs';

// Initialize EmailJS with your credentials
emailjs.init({
  publicKey: process.env.EMAILJS_PUBLIC_KEY,
  privateKey: process.env.EMAILJS_PRIVATE_KEY
});

export const sendPremiumConfirmationEmail = async (
  userEmail: string,
  userName: string
) => {
  try {
    // Create template parameters - this will replace variables in your EmailJS template
    const templateParams = {
      user_email: userEmail,
      user_name: userName,
      // You can add more parameters here if needed for your template
    };

    // Send the email using EmailJS
    const response = await emailjs.send(
      process.env.EMAILJS_SERVICE_ID as string,    // Your EmailJS service ID
      process.env.EMAILJS_PREMIUM_TEMPLATE_ID as string,  // Your EmailJS template ID
      templateParams
    );

    console.log('Email sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
};