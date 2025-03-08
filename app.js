const video = document.getElementById('video');
const movementDisplay = document.getElementById('movement');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let handCenter = null; // Store the center of the hand
const PIXELS_PER_CM = 37.7952755906; // Conversion factor from pixels to centimeters

// Function to start webcam stream
async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        console.log("Webcam stream started");
    } catch (err) {
        console.error("Error accessing webcam:", err);
        alert("Webcam access denied or not available. Please allow access to your webcam.");
    }
}

// Load the handpose and COCO-SSD models
async function setupDetection() {
    try {
        await startWebcam(); // Ensure webcam starts before tracking

        // Load both models
        const handposeModel = await handpose.load();
        const cocoSsdModel = await cocoSsd.load();
        console.log("Handpose and COCO-SSD models loaded");

        // Start detection loops
        detectHandMovement(handposeModel);
        detectCups(cocoSsdModel);
    } catch (err) {
        console.error("Error setting up detection:", err);
        alert("Failed to load the models. Please check your internet connection.");
    }
}

// Function to track hand movement and draw landmarks
async function detectHandMovement(model) {
    let lastHandPosition = null;

    async function detect() {
        // Clear the canvas before drawing new landmarks
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const predictions = await model.estimateHands(video);
        console.log("Hand predictions:", predictions); // Log predictions for debugging

        if (predictions.length > 0) {
            const landmarks = predictions[0].landmarks;

            // Draw hand landmarks (red circles)
            for (let i = 0; i < landmarks.length; i++) {
                const [x, y] = landmarks[i];
                const mirroredX = canvas.width - x; // Mirror the x-coordinate
                ctx.beginPath();
                ctx.arc(mirroredX, y, 5, 0, 2 * Math.PI); // Draw a circle at each landmark
                ctx.fillStyle = 'red';
                ctx.fill();
            }

            // Draw lines connecting the landmarks to form a mesh (green lines)
            const connections = [
                [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
                [0, 5], [5, 6], [6, 7], [7, 8], // Index finger
                [5, 9], [9, 10], [10, 11], [11, 12], // Middle finger
                [9, 13], [13, 14], [14, 15], [15, 16], // Ring finger
                [13, 17], [17, 18], [18, 19], [19, 20], // Pinky finger
                [0, 17] // Palm base
            ];

            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            connections.forEach(([start, end]) => {
                const [startX, startY] = landmarks[start];
                const [endX, endY] = landmarks[end];
                const mirroredStartX = canvas.width - startX; // Mirror the start x-coordinate
                const mirroredEndX = canvas.width - endX; // Mirror the end x-coordinate
                ctx.beginPath();
                ctx.moveTo(mirroredStartX, startY);
                ctx.lineTo(mirroredEndX, endY);
                ctx.stroke();
            });

            // Calculate the center of the hand
            const centerX = landmarks.reduce((sum, point) => sum + point[0], 0) / landmarks.length;
            const centerY = landmarks.reduce((sum, point) => sum + point[1], 0) / landmarks.length;
            const mirroredCenterX = canvas.width - centerX; // Mirror the center x-coordinate
            handCenter = { x: mirroredCenterX, y: centerY }; // Update hand center

            if (lastHandPosition) {
                const distance = Math.sqrt(
                    Math.pow(mirroredCenterX - lastHandPosition.x, 2) +
                    Math.pow(centerY - lastHandPosition.y, 2)
                );
                movementDisplay.textContent = `Movement detected! Distance: ${distance.toFixed(2)}px`;
            }
            lastHandPosition = { x: mirroredCenterX, y: centerY };
        } else {
            movementDisplay.textContent = 'No hand detected.';
            handCenter = null; // Reset hand center if no hand is detected
        }

        // Repeat the detection
        requestAnimationFrame(detect);
    }

    // Start the detection loop
    detect();
}

// Function to detect glass cups
async function detectCups(model) {
    async function detect() {
        const predictions = await model.detect(video);
        console.log("Cup predictions:", predictions); // Log predictions for debugging

        // Draw bounding boxes and labels for each prediction
        predictions.forEach(prediction => {
            if (prediction.class === 'cup') { // Filter for 'cup' class
                const [x, y, width, height] = prediction.bbox;
                const mirroredX = canvas.width - x - width; // Mirror the x-coordinate of the bounding box

                ctx.strokeStyle = 'blue';
                ctx.lineWidth = 2;
                ctx.strokeRect(mirroredX, y, width, height);

                ctx.fillStyle = 'blue';
                ctx.font = '18px Arial';
                ctx.fillText(
                    `${prediction.class} (${Math.round(prediction.score * 100)}%)`,
                    mirroredX,
                    y > 10 ? y - 5 : 10
                );

                // Calculate the center of the cup
                const cupCenterX = mirroredX + width / 2;
                const cupCenterY = y + height / 2;

                // Calculate the distance between the hand center and the cup center
                if (handCenter) {
                    const distancePx = Math.sqrt(
                        Math.pow(cupCenterX - handCenter.x, 2) +
                        Math.pow(cupCenterY - handCenter.y, 2)
                    );
                    const distanceCm = distancePx / PIXELS_PER_CM;

                    // Draw a line between the hand center and the cup center
                    ctx.strokeStyle = 'yellow';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(handCenter.x, handCenter.y);
                    ctx.lineTo(cupCenterX, cupCenterY);
                    ctx.stroke();

                    // Display the distance in centimeters
                    ctx.fillStyle = 'yellow';
                    ctx.font = '18px Arial';
                    ctx.fillText(
                        `${distanceCm.toFixed(2)} cm`,
                        (handCenter.x + cupCenterX) / 2,
                        (handCenter.y + cupCenterY) / 2
                    );

                    console.log(`Distance between hand and cup: ${distanceCm.toFixed(2)} cm`);
                }
            }
        });

        // Repeat the detection
        requestAnimationFrame(detect);
    }

    // Start the detection loop
    detect();
}

// Start the detection process
setupDetection().catch(err => console.error("Error setting up detection:", err));