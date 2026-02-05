
import cv2
import numpy as np
import os
import sys

def analyze_image(path):
    print(f"🔍 Analyzing: {path}")
    if not os.path.exists(path):
        print("❌ File not found")
        return

    try:
        img = cv2.imread(path)
    except AttributeError:
        # Fallback
        from cv2 import imread
        img = imread(path)
        
    if img is None:
        print("❌ Could not read image")
        return

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 1. Laplacian Variance (Blur/Texture)
    # Real faces > 100-300 (Sharp)
    # Screens/Blurry Photos < 100
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    print(f"📉 Laplacian Variance (Texture): {laplacian_var:.2f}")

    # 2. FFT Moiré Check (Old Logic)
    gray_resized = cv2.resize(gray, (256, 256))
    f = np.fft.fft2(gray_resized.astype(np.float32))
    fshift = np.fft.fftshift(f)
    magnitude = np.abs(fshift)
    magnitude_log = np.log1p(magnitude)
    
    h, w = magnitude_log.shape
    center_y, center_x = h // 2, w // 2
    low_radius = int(min(h, w) * 0.1)
    high_radius = int(min(h, w) * 0.4)
    
    y, x = np.ogrid[:h, :w]
    dist = np.sqrt((x - center_x)**2 + (y - center_y)**2)
    high_mask = (dist > int(min(h, w) * 0.25)) & (dist <= high_radius)
    
    high_freq_mean = np.mean(magnitude_log[high_mask]) if np.any(high_mask) else 0
    high_freq_std = np.std(magnitude_log[high_mask]) if np.any(high_mask) else 0
    high_freq_max = np.max(magnitude_log[high_mask]) if np.any(high_mask) else 0
    
    peak_ratio = (high_freq_max - high_freq_mean) / (high_freq_std + 1e-6)
    print(f"📊 FFT Peak Ratio (Moiré): {peak_ratio:.2f}")
    print(f"📊 FFT High Freq Std: {high_freq_std:.2f}")

    # 3. Histogram Analysis (Reflections/Washout)
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
    # Check for clipping at ends
    dark_clip = np.sum(hist[:5])
    bright_clip = np.sum(hist[250:])
    print(f"🎨 Histogram Clipping: Dark={dark_clip}, Bright={bright_clip}")
    
    # 4. Color Channels (HSV) - Screens often have unnatural saturation
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    sat_mean = np.mean(hsv[:,:,1])
    print(f"🌈 Mean Saturation: {sat_mean:.2f}")

    print("-" * 30)

if __name__ == "__main__":
    target_file = r"E:\Rework\faceSanncerToolForGettingDataForFaceDetectionModelTraning\backend\media\login_frames\JAI\001_20260204_150635_checkout.jpg"
    analyze_image(target_file)
