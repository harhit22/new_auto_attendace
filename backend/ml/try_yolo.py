from ultralytics import YOLO
import sys
import os

def detect_spoof_objects(image_path):
    print(f"🔄 Loading YOLOv8n (Standard)...")
    model = YOLO('yolov8n.pt') # Standard model with 80 classes
    
    # Classes we care about (Spoof Tools)
    # 67: cell phone, 63: laptop, 62: tv, 64: mouse, 65: remote, 66: keyboard
    SPOOF_CLASSES = [67, 63, 62, 64, 65, 66]
    CLASS_NAMES = model.names

    print(f"📸 Scanning image for spoof devices: {image_path}")
    results = model(image_path, verbose=False)
    
    spoof_found = False
    
    for r in results:
        boxes = r.boxes
        for box in boxes:
            cls = int(box.cls[0])
            conf = float(box.conf[0])
            name = CLASS_NAMES[cls]
            
            if cls in SPOOF_CLASSES:
                print(f"⚠️ DETECTED SPOOF DEVICE: {name} ({conf:.2f})")
                spoof_found = True
            elif name == 'person':
                print(f"✅ DETECTED: {name} ({conf:.2f})")
            else:
                print(f"ℹ️ DETECTED: {name} ({conf:.2f})")

    if not spoof_found:
        print("\n✅ CLEAN: No suspicious devices (phones/laptops) detected.")
    else:
        print("\n❌ WARNING: Potential spoofing device detected!")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        img_path = sys.argv[1]
        detect_spoof_objects(img_path)
    else:
        print("Usage: python try_yolo.py <path_to_image>")
