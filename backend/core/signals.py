"""
Signal handlers for Core models.
Auto-delete files from storage when model instances are deleted.
"""
import os
from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver
from .models import LoginDetectionResult, VehicleComplianceRecord


@receiver(post_delete, sender=LoginDetectionResult)
def auto_delete_login_frame_on_delete(sender, instance, **kwargs):
    """
    Deletes frame_image file from filesystem when LoginDetectionResult is deleted.
    Works with both local storage and Firebase.
    """
    if instance.frame_image:
        if os.path.isfile(instance.frame_image.path):
            os.remove(instance.frame_image.path)


@receiver(pre_save, sender=LoginDetectionResult)
def auto_delete_login_frame_on_change(sender, instance, **kwargs):
    """
    Deletes old frame_image file when LoginDetectionResult is updated with a new file.
    """
    if not instance.pk:
        return  # New instance, no old file to delete
    
    try:
        old_instance = LoginDetectionResult.objects.get(pk=instance.pk)
    except LoginDetectionResult.DoesNotExist:
        return
    
    old_file = old_instance.frame_image
    new_file = instance.frame_image
    
    # If file changed, delete old one
    if old_file and old_file != new_file:
        if os.path.isfile(old_file.path):
            os.remove(old_file.path)


@receiver(post_delete, sender=VehicleComplianceRecord)
def auto_delete_vehicle_image_on_delete(sender, instance, **kwargs):
    """
    Deletes vehicle_image file from filesystem when VehicleComplianceRecord is deleted.
    """
    if instance.vehicle_image:
        if os.path.isfile(instance.vehicle_image.path):
            os.remove(instance.vehicle_image.path)


@receiver(pre_save, sender=VehicleComplianceRecord)
def auto_delete_vehicle_image_on_change(sender, instance, **kwargs):
    """
    Deletes old vehicle_image file when VehicleComplianceRecord is updated with a new file.
    """
    if not instance.pk:
        return
    
    try:
        old_instance = VehicleComplianceRecord.objects.get(pk=instance.pk)
    except VehicleComplianceRecord.DoesNotExist:
        return
    
    old_file = old_instance.vehicle_image
    new_file = instance.vehicle_image
    
    if old_file and old_file != new_file:
        if os.path.isfile(old_file.path):
            os.remove(old_file.path)
