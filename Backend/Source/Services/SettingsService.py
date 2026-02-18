
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
SETTINGS_DIR = DATA_DIR / "tenant_settings"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
SETTINGS_DIR.mkdir(parents=True, exist_ok=True)

# Legacy settings file path
LEGACY_SETTINGS_FILE = DATA_DIR / "settings.json"

class SettingsModel(BaseModel):
    """
    Pydantic model for application settings.
    Defines the schema and validation rules.
    """
    context_memory_enabled: bool = True
    model_provider: str = Field(default="azure", description="AI model provider: 'azure' or 'groq'")
    groq_model: str = Field(default="", description="Groq model name, e.g. 'openai/gpt-oss-120b'")
    topic_guard_prompt: str = Field(
        default="أنت مصنف أسئلة. حدد هل السؤال يتعلق بأي من المواضيع التالية:\n- قياس أو معايير قياس\n- هيئة الحكومة الرقمية (DGA)\n- التحول الرقمي الحكومي\n- الامتثال أو الضوابط أو المحاور أو المعايير الحكومية\n- البنية المؤسسية أو إدارة المخاطر أو استمرارية الأعمال أو إدارة المشاريع الرقمية\n- الحوسبة السحابية أو البيانات والذكاء الاصطناعي في سياق حكومي\n\nقاعدة مهمة: أي سؤال يحتوي على رقم معيار أو ضابط (مثل 3.1.3 أو 5.2.1 أو 5.17) يعتبر دائماً on_topic: true حتى لو كان مكتوباً بالعامية.\n\nقاعدة المحادثة: ستصلك أحياناً رسائل سابقة من المحادثة. إذا كانت المحادثة السابقة تتعلق بالمواضيع أعلاه، فإن أسئلة المتابعة (مثل \"وضح أكثر\" أو \"جيبلي الدليل\" أو \"بايش استدليت\" أو \"ايش تقصد\") تعتبر on_topic: true لأنها تكمل محادثة قائمة. لكن إذا غيّر المستخدم الموضوع بشكل واضح (مثل سؤال عن الطقس بعد سؤال عن معيار) فأجب on_topic: false.\n\nإذا كان السؤال يتعلق بأي من هذه المواضيع أجب on_topic: true.\nإذا كان السؤال عن موضوع آخر تماماً (طقس، برمجة، رياضيات، ثقافة عامة، محادثة عادية) أجب on_topic: false.",
        description="System prompt for the Groq topic guard classifier."
    )
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
        self._default_settings = None
        self._tenant_settings_cache = {}
        self._load_default_settings()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def _get_tenant_settings_path(self, tenant_id: str) -> Path:
        """Get the settings file path for a specific tenant."""
        return SETTINGS_DIR / f"{tenant_id}.json"

    def _load_default_settings(self):
        """Load default settings from legacy file or create defaults."""
        if LEGACY_SETTINGS_FILE.exists():
            try:
                with open(LEGACY_SETTINGS_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self._default_settings = SettingsModel(**data)
            except Exception as e:
                logger.warning(f"Error loading legacy settings: {e}. Using defaults.")
                self._default_settings = SettingsModel()
        else:
            self._default_settings = SettingsModel()

    def get_settings(self, tenant_id: str = None) -> SettingsModel:
        """
        Get settings for a specific tenant.
        Falls back to default settings if no tenant-specific settings exist.
        """
        if not tenant_id:
            return self._default_settings

        # Check cache first
        if tenant_id in self._tenant_settings_cache:
            return self._tenant_settings_cache[tenant_id]

        # Try loading from disk
        settings_path = self._get_tenant_settings_path(tenant_id)
        if settings_path.exists():
            try:
                with open(settings_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    tenant_settings = SettingsModel(**data)
                    self._tenant_settings_cache[tenant_id] = tenant_settings
                    return tenant_settings
            except Exception as e:
                logger.warning(f"Error loading settings for tenant {tenant_id}: {e}. Using defaults.")

        # Return default settings (inherited from global)
        return self._default_settings

    def save_settings(self, new_settings: SettingsModel, tenant_id: str = None):
        """
        Save settings. If tenant_id is provided, saves tenant-specific settings.
        Otherwise, saves global defaults.
        """
        if tenant_id:
            self._tenant_settings_cache[tenant_id] = new_settings
            settings_path = self._get_tenant_settings_path(tenant_id)
        else:
            self._default_settings = new_settings
            settings_path = LEGACY_SETTINGS_FILE
        
        # Atomic Write Strategy
        try:
            target_dir = settings_path.parent
            target_dir.mkdir(parents=True, exist_ok=True)
            
            with tempfile.NamedTemporaryFile('w', dir=target_dir, delete=False, encoding='utf-8') as tmp_file:
                json.dump(new_settings.model_dump(), tmp_file, ensure_ascii=False, indent=4)
                temp_path = tmp_file.name
            
            shutil.move(temp_path, settings_path)
            logger.info(f"Settings saved successfully" + (f" for tenant {tenant_id}" if tenant_id else ""))

        except Exception as e:
            logger.error(f"Failed to save settings: {e}", exc_info=True)
            if 'temp_path' in locals() and os.path.exists(temp_path):
                os.remove(temp_path)
            raise e

# Global Accessor
settings_service = SettingsService.get_instance()
