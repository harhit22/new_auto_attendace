import torch
from PIL import Image
from transformers import BlipProcessor, BlipForQuestionAnswering
import sys
import os

def check_liveness_blip(image_path):
    print(f"🔄 Loading BLIP model... (This might take a while first time)")
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"⚙️ Device: {device}")

    try:
        processor = BlipProcessor.from_pretrained("Salesforce/blip-vqa-base")
        model = BlipForQuestionAnswering.from_pretrained("Salesforce/blip-vqa-base").to(device)
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return

    try:
        raw_image = Image.open(image_path).convert('RGB')
    except Exception as e:
        print(f"❌ Could not open image {image_path}: {e}")
        return

    # Questions to ask
    questions = [
        "Is this a photo of a real person or a digital screen?",
        "Is there a phone bezel or screen frame in the image?",
        "Does this look like a high resolution photo on a screen?",
        "Is this a real human face?"
    ]

    print(f"\n📸 Analyzing: {image_path}")
    print("-" * 40)

    try:
        for question in questions:
            inputs = processor(raw_image, question, return_tensors="pt").to(device)
            out = model.generate(**inputs)
            answer = processor.decode(out[0], skip_special_tokens=True)
            print(f"❓ {question}")
            print(f"💡 {answer}\n")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ Error during inference: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        img_path = sys.argv[1]
        check_liveness_blip(img_path)
    else:
        print("Usage: python try_blip.py <path_to_image>")
