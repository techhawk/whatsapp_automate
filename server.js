
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');


// For frontend
const targetNumber = '+918888174720'; // Replace with actual number
const message = 'Hello';
const whatsappLink = `https://wa.me/${targetNumber}?text=${encodeURIComponent(message)}`;

// Generate Terminal QR Code
qrcode.generate(whatsappLink, { small: true });

// Generate Image QR Code
QRCode.toFile('./whatsapp_qr.png', whatsappLink, function (err) {
    if (err) console.error(err);
    console.log("✅ QR Code saved as 'whatsapp_qr.png'. Scan to send 'Hello'.");
});


// for backend

const whatsapp = new Client({
    authStrategy: new LocalAuth()
});

// Ensure `resumes` folder exists
const resumeFolder = path.join(__dirname, 'resumes');
if (!fs.existsSync(resumeFolder)) {
    fs.mkdirSync(resumeFolder);
}

// Temporary storage for user data
const userResponses = {};

// Function to send user data to API
const sendUserDataToAPI = async (userData) => {
    const apiUrl = 'http://localhost:3000/api/saveUserToDB'; // Replace with your actual API endpoint

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        if (!response.ok) {
            throw new Error(`Failed to send data: ${response.statusText}`);
        }

        console.log("✅ Data successfully sent to API:", userData);
    } catch (error) {
        console.error("❌ Error sending data to API:", error);
    }
};

// QR Code Handling
whatsapp.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

// Message Handling
whatsapp.on('message', async message => {
    const userNumber = message.from;

    // Ignore groups and status updates
    if (userNumber.includes("@g.us") || userNumber.includes("status@broadcast")) {
        return;
    }

    const userMessage = message.body.trim();

    if (!userResponses[userNumber]) {
        userResponses[userNumber] = {};
    }

    const userData = userResponses[userNumber];

    if (!userData.state && userMessage.toLowerCase() === "hello") {
        message.reply("Hello! Welcome to OptimIQ. What's your name?");
        userData.state = "waiting_for_name";

    } else if (userData.state === "waiting_for_name") {
        userData.name = userMessage;
        message.reply(`Nice to meet you, ${userMessage}! Please provide your email.`);
        userData.state = "waiting_for_email";

    } else if (userData.state === "waiting_for_email") {
        userData.email = userMessage;
        message.reply(`Got it! What type of job are you looking for? (Reply with one of the options)\n\n✅ Freelance\n✅ Full-time\n✅ Part-time\n✅ Contract`);
        userData.state = "waiting_for_job_type";

    } else if (userData.state === "waiting_for_job_type") {
        const validJobTypes = ["freelance", "fulltime", "parttime", "contract"];
        if (validJobTypes.includes(userMessage.toLowerCase())) {
            userData.job_type = userMessage;
            message.reply(`Great! What field are you interested in? (e.g., Front-end, Back-end, UI/UX)`);
            userData.state = "waiting_for_field";
        } else {
            message.reply("Please select a valid job type: Freelance, Full-time, Part-time, or Contract.");
        }

    } else if (userData.state === "waiting_for_field") {
        userData.field = userMessage;
        message.reply(`Awesome! How many years of experience do you have in this field?`);
        userData.state = "waiting_for_experience";

    } else if (userData.state === "waiting_for_experience") {
        userData.experience = userMessage;
        message.reply(`Great! Which web technologies do you specialize in? You can select multiple by separating them with commas.\n\n✅ React\n✅ Angular\n✅ Vue\n✅ Node.js\n✅ Django\n✅ Laravel\n✅ PHP\n✅ WordPress`);
        userData.state = "waiting_for_tech_stack";

    } else if (userData.state === "waiting_for_tech_stack") {
        userData.tech_stack = userMessage;
        message.reply(`Awesome! Now please upload your resume (PDF format).`);
        userData.state = "waiting_for_resume";

    } else if (userData.state === "waiting_for_resume" && message.hasMedia) {
        const media = await message.downloadMedia();

        if (media.mimetype === "application/pdf") {
            const filePath = `./resumes/${userNumber}.pdf`;
            fs.writeFileSync(filePath, media.data, { encoding: 'base64' });

            userData.resume = filePath;
            message.reply("✅ Your resume has been successfully uploaded!\n\nThank you for your information. We will review your details and get back to you soon!");

            // Send all collected data to API
            await sendUserDataToAPI(userData);

            // Remove user data after submission
            delete userResponses[userNumber];
        } else {
            message.reply("Please upload a valid PDF file.");
        }

    } else if (userData.state === "waiting_for_resume") {
        message.reply("Please upload a valid PDF file.");
    }
});

// Bot Ready Event
whatsapp.on('ready', () => {
    console.log("Client is ready");
});

whatsapp.initialize();