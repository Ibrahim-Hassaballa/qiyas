
import json
import os
import tempfile
import shutil
from pathlib import Path
from pydantic import BaseModel, Field
from threading import Lock
from Backend.Source.Core.Logging import logger

# Constants
DATA_DIR = Path("Backend/Data")
SETTINGS_FILE = DATA_DIR / "settings.json"

class SettingsModel(BaseModel):
    """
    Pydantic model for application settings.
    Defines the schema and validation rules.
    """
    system_prompt: str = Field(
        default="""أنت مساعد امتثال/تفسير رسمي لمعايير هيئة الحكومة الرقمية (DGA) من وثيقة:
"المعايير الأساسية للتحول الرقمي" إصدار 4.0 (مارس 2025).

المرجع الوحيد (CONTEXT):
{context_text}

تعليمات صارمة (GOLDEN RULES):
1. مسموح لك بالاستناد فقط إلى نص هذه الوثيقة (CONTEXT). تمنع الإجابة إذا لم تكن المعلومة موجودة في السياق أعلاه.
2. ممنوع اختراع أرقام صفحات. استخدم "اقتباس" من النص فقط.
3. فهم الترقيم:
   - الأرقام مثل "5.2" أو "5.17" هي "محاور" (Axes).
   - الأرقام مثل "5.2.1" هي "معايير" (Controls).
4. عدم الهلوسة: إذا كانت المعلومات غير كافية، قل "المعلومات غير متوفرة في السياق".

تعليمات تقييم الامتثال (Compliance Assessment Rules):
1. عند طلب تحليل ملف مرفق، قارنه بدقة مع كل "متطلب تطبيق" و "مستند إثبات" وارد في المعيار.
2. قاعدة 100/100: لكي تكون النتيجة "متحقق" (Compliant)، يجب توفر دليل واضح لكل متطلب من متطلبات الإثبات. إذا غاب أي منها، النتيجة "متحقق جزئيًا" أو "غير متحقق".
3. التحقق من صحة الدليل (Validity of Evidence): إذا نص المعيار على وجود "نظام رقمي" أو "أتمتة"، فإن التقارير اليدوية (Manual Reports) أو النصوص المكتوبة لا تُعتبر دليلاً كافياً. يجب أن يظهر الدليل (مثل لقطات الشاشة أو تقارير النظام) بوضوح أنه صادر من النظام. إذا شككت أن التقرير يدوي، اعتبر المتطلب "غير متحقق".
4. كن دقيقاً جداً في تحديد "الفجوات" (Gaps): اذكر بوضوح ما هي الأدلة المفقودة.

تنسيق الإجابة المطلوب (Output Format):
العنوان: [رقم] [اسم المحور/المعيار]
النوع: (محور/معيار)
النص/الوصف الرسمي: ...
الهدف: ...
متطلبات التطبيق: (نقاط مرقمة)
مستندات الإثبات: ...
تقييم الامتثال (للملف المرفق):
- الحالة: (متحقق / متحقق جزئيًا / غير متحقق)
- التحليل: ...
- الفجوات (إن وجدت): ...

سؤال المستخدم: "{user_query}"
""",
        description="The system prompt used for the AI assistant."
    )

class SettingsService:
    _instance = None
    _lock = Lock()
    
    def __init__(self):
        self._settings = None
        # Ensure Data directory exists
        if not DATA_DIR.exists():
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            
        self._load_settings()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def _load_settings(self):
        """Loads settings from disk or creates default if missing."""
        if not SETTINGS_FILE.exists():
            logger.info("Settings file not found. Creating default settings.")
            self._settings = SettingsModel()
            self.save_settings(self._settings)
        else:
            try:
                with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self._settings = SettingsModel(**data)
            except Exception as e:
                logger.warning(f"Error loading settings: {e}. Reverting to defaults.")
                self._settings = SettingsModel()

    def get_settings(self) -> SettingsModel:
        """Returns the current settings object."""
        return self._settings

    def save_settings(self, new_settings: SettingsModel):
        """
        Saves settings to disk using atomic write.
        1. Write to temp file
        2. Replace actual file
        """
        self._settings = new_settings
        
        # Atomic Write Strategy
        try:
            # Create a temporary file in the same directory
            with tempfile.NamedTemporaryFile('w', dir=DATA_DIR, delete=False, encoding='utf-8') as tmp_file:
                json.dump(new_settings.model_dump(), tmp_file, ensure_ascii=False, indent=4)
                temp_path = tmp_file.name
            
            # Atomic move (replace)
            shutil.move(temp_path, SETTINGS_FILE)
            logger.info("Settings saved successfully")

        except Exception as e:
            logger.error(f"Failed to save settings: {e}", exc_info=True)
            if 'temp_path' in locals() and os.path.exists(temp_path):
                os.remove(temp_path)
            raise e

# Global Accessor
settings_service = SettingsService.get_instance()
