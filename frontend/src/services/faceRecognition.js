/**
 * Face Recognition Service - Enhanced for Better Accuracy
 * More augmentations, export/import functionality
 */
import * as faceapi from 'face-api.js';

const MODELS_URL = '/models';

class FaceRecognitionService {
    constructor() {
        this.modelsLoaded = false;
        this.labeledFaceDescriptors = null;
        this.faceMatcher = null;
    }

    async loadModels() {
        if (this.modelsLoaded) return;

        try {
            console.log('Loading face-api.js models...');
            const modelPaths = [
                MODELS_URL,
                'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'
            ];

            let loaded = false;
            for (const modelPath of modelPaths) {
                try {
                    console.log(`Trying: ${modelPath}`);
                    await Promise.all([
                        faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
                        faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
                        faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
                    ]);
                    loaded = true;
                    console.log(`Models loaded from: ${modelPath}`);
                    break;
                } catch (e) {
                    console.log(`Failed: ${modelPath}`);
                }
            }

            if (!loaded) throw new Error('Could not load models');
            this.modelsLoaded = true;
            return true;
        } catch (error) {
            console.error('Error loading models:', error);
            throw new Error('Failed to load face recognition models.');
        }
    }

    /**
     * Enhanced augmentations for better accuracy
     */
    applyAugmentations(canvas) {
        const augmentations = [];

        // Original
        augmentations.push(canvas.toDataURL('image/jpeg', 0.95));

        // Scale variations (near/far simulation) - MORE LEVELS
        const scales = [0.6, 0.75, 0.85, 0.95, 1.05, 1.15, 1.25, 1.4];
        scales.forEach(scale => {
            const temp = document.createElement('canvas');
            temp.width = canvas.width;
            temp.height = canvas.height;
            const ctx = temp.getContext('2d');
            const sw = Math.floor(canvas.width * scale);
            const sh = Math.floor(canvas.height * scale);
            const ox = (canvas.width - sw) / 2;
            const oy = (canvas.height - sh) / 2;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, temp.width, temp.height);
            ctx.drawImage(canvas, ox, oy, sw, sh);
            augmentations.push(temp.toDataURL('image/jpeg', 0.95));
        });

        // Brightness variations - MORE LEVELS
        [0.7, 0.85, 1.15, 1.3].forEach(brightness => {
            const temp = document.createElement('canvas');
            temp.width = canvas.width;
            temp.height = canvas.height;
            const ctx = temp.getContext('2d');
            ctx.filter = `brightness(${brightness})`;
            ctx.drawImage(canvas, 0, 0);
            augmentations.push(temp.toDataURL('image/jpeg', 0.95));
        });

        // Contrast variations
        [0.9, 1.1].forEach(contrast => {
            const temp = document.createElement('canvas');
            temp.width = canvas.width;
            temp.height = canvas.height;
            const ctx = temp.getContext('2d');
            ctx.filter = `contrast(${contrast})`;
            ctx.drawImage(canvas, 0, 0);
            augmentations.push(temp.toDataURL('image/jpeg', 0.95));
        });

        // Slight rotation variations
        [-5, 5, -10, 10].forEach(angle => {
            const temp = document.createElement('canvas');
            temp.width = canvas.width;
            temp.height = canvas.height;
            const ctx = temp.getContext('2d');
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((angle * Math.PI) / 180);
            ctx.translate(-canvas.width / 2, -canvas.height / 2);
            ctx.drawImage(canvas, 0, 0);
            augmentations.push(temp.toDataURL('image/jpeg', 0.95));
        });

        // Horizontal flip
        const flip = document.createElement('canvas');
        flip.width = canvas.width;
        flip.height = canvas.height;
        const flipCtx = flip.getContext('2d');
        flipCtx.scale(-1, 1);
        flipCtx.drawImage(canvas, -canvas.width, 0);
        augmentations.push(flip.toDataURL('image/jpeg', 0.95));

        // Slight blur (simulate motion/focus issues)
        const blur = document.createElement('canvas');
        blur.width = canvas.width;
        blur.height = canvas.height;
        const blurCtx = blur.getContext('2d');
        blurCtx.filter = 'blur(1px)';
        blurCtx.drawImage(canvas, 0, 0);
        augmentations.push(blur.toDataURL('image/jpeg', 0.95));

        return augmentations; // ~20 augmentations per image
    }

    async loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    async getFaceDescriptor(imageSrc) {
        const img = await this.loadImage(imageSrc);
        const detection = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
        return detection?.descriptor || null;
    }

    /**
     * Train with enhanced augmentations
     */
    async trainPerson(label, images, onProgress = () => { }) {
        await this.loadModels();

        const descriptors = [];
        let processed = 0;
        const totalImages = images.length;

        for (const imageFile of images) {
            const imageSrc = URL.createObjectURL(imageFile);

            try {
                const img = await this.loadImage(imageSrc);
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const augmentedImages = this.applyAugmentations(canvas);

                for (const augSrc of augmentedImages) {
                    const descriptor = await this.getFaceDescriptor(augSrc);
                    if (descriptor) {
                        descriptors.push(descriptor);
                    }
                }

                processed++;
                onProgress({
                    stage: 'processing',
                    current: processed,
                    total: totalImages,
                    descriptorsFound: descriptors.length,
                    message: `Processing image ${processed}/${totalImages}... (${descriptors.length} embeddings)`
                });

            } catch (error) {
                console.error('Error processing image:', error);
            } finally {
                URL.revokeObjectURL(imageSrc);
            }
        }

        if (descriptors.length === 0) {
            throw new Error('No face descriptors extracted');
        }

        this.saveTrainedPerson(label, descriptors);

        onProgress({
            stage: 'complete',
            descriptorsFound: descriptors.length,
            message: `Training complete! ${descriptors.length} face embeddings created.`
        });

        return {
            label,
            descriptorCount: descriptors.length,
            success: true
        };
    }

    saveTrainedPerson(label, descriptors) {
        const storage = this.getStoredPersons();
        storage[label] = {
            descriptors: descriptors.map(d => Array.from(d)),
            trainedAt: new Date().toISOString(),
            count: descriptors.length
        };
        localStorage.setItem('face_recognition_data', JSON.stringify(storage));
        this.rebuildFaceMatcher();
    }

    getStoredPersons() {
        try {
            const data = localStorage.getItem('face_recognition_data');
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    }

    getTrainedPersons() {
        const storage = this.getStoredPersons();
        return Object.keys(storage).map(label => ({
            label,
            ...storage[label]
        }));
    }

    deleteTrainedPerson(label) {
        const storage = this.getStoredPersons();
        delete storage[label];
        localStorage.setItem('face_recognition_data', JSON.stringify(storage));
        this.rebuildFaceMatcher();
    }

    rebuildFaceMatcher() {
        const storage = this.getStoredPersons();
        const labels = Object.keys(storage);

        if (labels.length === 0) {
            this.faceMatcher = null;
            return;
        }

        const labeledDescriptors = labels.map(label => {
            const data = storage[label];
            const descriptors = data.descriptors.map(d => new Float32Array(d));
            return new faceapi.LabeledFaceDescriptors(label, descriptors);
        });

        // Lower threshold = stricter matching (0.4 for higher accuracy)
        this.faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.45);
    }

    async recognizeFace(videoElement) {
        if (!this.modelsLoaded) await this.loadModels();
        if (!this.faceMatcher) this.rebuildFaceMatcher();
        if (!this.faceMatcher) return { matched: false, message: 'No trained faces yet' };

        const detection = await faceapi
            .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) return { matched: false, message: 'No face detected' };

        const match = this.faceMatcher.findBestMatch(detection.descriptor);

        if (match.label === 'unknown') {
            return {
                matched: false,
                message: 'Face not recognized',
                distance: match.distance,
                detection
            };
        }

        const labelParts = match.label.split('_');
        const personId = labelParts[0] || match.label;
        const personName = labelParts.slice(1).join(' ') || match.label;

        return {
            matched: true,
            label: match.label,
            personId,
            personName,
            distance: match.distance,
            confidence: Math.round((1 - match.distance) * 100),
            detection
        };
    }

    // ============ EXPORT/IMPORT FUNCTIONS ============

    /**
     * Export all trained data as JSON file
     */
    exportModel() {
        const storage = this.getStoredPersons();
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            persons: storage
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `face_recognition_model_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return exportData;
    }

    /**
     * Import trained data from JSON file
     */
    async importModel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);

                    if (!data.persons) {
                        throw new Error('Invalid model file format');
                    }

                    // Merge with existing data
                    const existing = this.getStoredPersons();
                    const merged = { ...existing, ...data.persons };

                    localStorage.setItem('face_recognition_data', JSON.stringify(merged));
                    this.rebuildFaceMatcher();

                    resolve({
                        success: true,
                        personsImported: Object.keys(data.persons).length,
                        totalPersons: Object.keys(merged).length
                    });
                } catch (error) {
                    reject(new Error('Failed to parse model file: ' + error.message));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Get embeddings for a specific person (for use in other systems)
     */
    getPersonEmbeddings(label) {
        const storage = this.getStoredPersons();
        return storage[label] || null;
    }

    /**
     * Clear all trained data
     */
    clearAllData() {
        localStorage.removeItem('face_recognition_data');
        this.faceMatcher = null;
    }
}

const faceRecognitionService = new FaceRecognitionService();
export default faceRecognitionService;
