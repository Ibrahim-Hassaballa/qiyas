from openai import AzureOpenAI, AsyncAzureOpenAI
from openai.types.chat import ChatCompletion
from Backend.Source.Core.Config.Config import settings
from Backend.Source.Core.Logging import logger
from typing import Dict, List, Optional, Any, Union
import re
import json
import numpy as np

# Enhanced standard descriptions with rich Arabic keywords for better embedding matching
STANDARD_DESCRIPTIONS = {
    # 5.2 - Digital Transformation Governance
    "5.2.1": "تأسيس لجنة للتحول الرقمي وحوكمة التحول الرقمي لجنة توجيهية قرار تشكيل اللجنة صلاحيات اللجنة اجتماعات دورية محاضر اجتماعات",
    "5.2.2": "إطار حوكمة التحول الرقمي ومبادرات التحول وبطاقات المبادرات خطة التحول الرقمي استراتيجية رقمية مؤشرات أداء KPIs",
    "5.2.3": "التعاون المشترك بين الجهات والمشاريع المشتركة والاتفاقيات المشتركة وتقارير دورية مشتركة مذكرات تفاهم شراكات حكومية تكامل الخدمات",

    # 5.3 - Enterprise Architecture
    "5.3.1": "تأسيس وحدة البنية المؤسسية فريق البنية المؤسسية هيكل تنظيمي مهام ومسؤوليات",
    "5.3.2": "تطبيق ممارسة البنية المؤسسية معمارية المؤسسة TOGAF نماذج معمارية وثائق البنية",

    # 5.8 - Risk Management
    "5.8.1": "إدارة مخاطر تقنية المعلومات سجل المخاطر تحليل المخاطر خطط معالجة المخاطر مصفوفة المخاطر",
    "5.8.2": "تقييم المخاطر الأمنية اختبار الاختراق فحص الثغرات تدقيق أمني مراجعة أمنية",

    # 5.9 - Business Continuity
    "5.9.1": "استمرارية الأعمال وخطة التعافي من الكوارث خطة استمرارية BCP DRP موقع بديل نسخ احتياطي",
    "5.9.2": "تحليل أثر الأعمال BIA تحديد الأنظمة الحرجة وقت التعافي RTO RPO",
    "5.9.3": "اختبار خطط استمرارية الأعمال تمارين محاكاة سيناريوهات الطوارئ",

    # 5.10 - Digital Project Management
    "5.10.1": "تأسيس مكتب إدارة المشاريع الرقمية PMO مكتب المشاريع منهجية إدارة المشاريع حوكمة المشاريع",
    "5.10.2": "استخدام الأنظمة الرقمية لإدارة المشاريع ولوحات التحكم والتقارير نظام إدارة المشاريع dashboard متابعة المشاريع تقارير الإنجاز",

    # 5.13 - Government Platforms
    "5.13.1": "منصات الحكومة الشاملة والخدمات المشتركة منصة حكومية تكامل الأنظمة خدمات مشتركة بوابة إلكترونية",

    # 5.15 - Digital Channels and Services
    "5.15.1": "القنوات الرقمية والخدمات الإلكترونية تطبيق جوال موقع إلكتروني خدمات إلكترونية تجربة المستخدم UX",

    # 5.17 - Data and AI
    "5.17.1": "البيانات والذكاء الاصطناعي وتحليل البيانات حوكمة البيانات جودة البيانات تعلم آلي نماذج ذكاء اصطناعي",

    # 5.18 - Cloud Computing
    "5.18.1": "الحوسبة السحابية والبنية التحتية السحابية خدمات سحابية IaaS PaaS SaaS هجرة سحابية",
}

def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculate cosine similarity between two vectors with edge case handling."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

def extract_meaningful_content(doc_text: str, max_chars: int = 800) -> str:
    """
    Extract meaningful content from document, skipping headers and metadata.
    Returns the most content-rich portion of the document.
    """
    if not doc_text or len(doc_text.strip()) == 0:
        return ""

    # Split into lines and filter
    lines = doc_text.split('\n')
    meaningful_lines = []

    # Skip common header patterns (Arabic and English)
    skip_patterns = [
        r'^بسم الله',  # Bismillah
        r'^المملكة العربية',  # Kingdom header
        r'^وزارة',  # Ministry
        r'^هيئة',  # Authority
        r'^\d+[/-]\d+[/-]\d+',  # Dates
        r'^page\s*\d+',  # Page numbers
        r'^\s*$',  # Empty lines
    ]

    for line in lines:
        line = line.strip()
        # Skip short lines (likely headers) and lines matching skip patterns
        if len(line) < 15:
            continue
        if any(re.match(pattern, line, re.IGNORECASE) for pattern in skip_patterns):
            continue
        meaningful_lines.append(line)

    # Join meaningful content
    content = ' '.join(meaningful_lines)

    # If still too short, fall back to original text
    if len(content) < 100:
        content = doc_text.replace('\n', ' ')

    return content[:max_chars]

class AzureOpenAIService:
    def __init__(self):
        self.client = AsyncAzureOpenAI(
            azure_endpoint=settings.AZURE_CHAT_ENDPOINT,
            api_key=settings.AZURE_CHAT_KEY,
            api_version=settings.AZURE_CHAT_API_VERSION
        )
        self.deployment_name = settings.AZURE_CHAT_DEPLOYMENT

        # Sync client for embeddings (used in similarity matching)
        self.sync_client = AzureOpenAI(
            azure_endpoint=settings.AZURE_EMBEDDING_ENDPOINT,
            api_key=settings.AZURE_EMBEDDING_KEY,
            api_version=settings.AZURE_EMBEDDING_API_VERSION
        )
        self.embedding_deployment = settings.AZURE_EMBEDDING_DEPLOYMENT

        # Cache for standard embeddings (computed lazily)
        self._standard_embeddings = None
        self._embeddings_initialized = False

    def _get_standard_embeddings(self) -> Dict[str, List[float]]:
        """Get or compute embeddings for all standards (cached, lazy initialization)."""
        if not self._embeddings_initialized:
            logger.info("Computing standard embeddings for similarity matching (one-time)...")
            self._standard_embeddings = {}

            # Batch compute embeddings for efficiency
            try:
                descriptions = list(STANDARD_DESCRIPTIONS.values())
                std_ids = list(STANDARD_DESCRIPTIONS.keys())

                response = self.sync_client.embeddings.create(
                    input=descriptions,
                    model=self.embedding_deployment
                )

                for i, embedding_data in enumerate(response.data):
                    self._standard_embeddings[std_ids[i]] = embedding_data.embedding

                logger.info(f"Cached embeddings for {len(self._standard_embeddings)} standards")
                self._embeddings_initialized = True

            except Exception as e:
                logger.error(f"Failed to compute standard embeddings: {e}")
                # Fall back to individual computation
                for std_id, description in STANDARD_DESCRIPTIONS.items():
                    try:
                        response = self.sync_client.embeddings.create(
                            input=description,
                            model=self.embedding_deployment
                        )
                        self._standard_embeddings[std_id] = response.data[0].embedding
                    except Exception as e2:
                        logger.error(f"Failed to compute embedding for {std_id}: {e2}")
                self._embeddings_initialized = True

        return self._standard_embeddings

    async def get_chat_response(self, messages: List[Dict[str, str]], stream: bool = True) -> Any:
        """
        Sends messages to Azure OpenAI and returns the response.
        Supports streaming.

        Args:
            messages: List of message dicts with 'role' and 'content' keys
            stream: Whether to stream the response

        Returns:
            Async stream or ChatCompletion depending on stream parameter
        """
        response = await self.client.chat.completions.create(
            model=self.deployment_name,
            messages=messages,
            stream=stream
        )
        return response

    async def get_embedding(self, text: str) -> List[float]:
        """
        Generates embeddings for the given text.

        Args:
            text: Text to generate embeddings for

        Returns:
            List of float values representing the embedding vector
        """
        response = await self.client.embeddings.create(
            input=text,
            model="text-embedding-ada-002"
        )
        return response.data[0].embedding

    async def analyze_document_for_standard(self, doc_text: str, filename: str) -> Dict[str, Any]:
        """
        Smart multi-tier document classification (10/10 logic):
        - Tier 1: Filename hint (boost only, never trusted alone)
        - Tier 2: Embedding similarity (primary classification with 3 confidence levels)
        - Tier 3: LLM analysis (only if Tier 2 confidence is very low)

        Args:
            doc_text: The document text content
            filename: Original filename (used as hint)

        Returns:
            Dict with keys: standard_id, confidence, reasoning, tier
        """

        # === INPUT VALIDATION ===
        if not doc_text or len(doc_text.strip()) < 50:
            logger.warning(f"Document too short or empty: {len(doc_text) if doc_text else 0} chars")
            return {
                "standard_id": None,
                "confidence": "low",
                "reasoning": "Document too short for analysis",
                "tier": 0
            }

        # === TIER 1: Filename Hint (0 tokens, boost only) ===
        filename_hint = None
        filename_lower = filename.lower()
        id_match = re.search(r'(\d+\.\d+\.\d+)', filename_lower)
        if id_match:
            detected_id = id_match.group(1)
            if detected_id in STANDARD_DESCRIPTIONS:
                filename_hint = detected_id
                logger.info(f"Tier 1: Filename hint detected: {detected_id}")

        # === TIER 2: Embedding Similarity (primary classification) ===
        try:
            # Extract meaningful content (skip headers, get substance)
            doc_preview = extract_meaningful_content(doc_text, max_chars=800)

            if len(doc_preview) < 30:
                logger.warning("Could not extract meaningful content from document")
                doc_preview = doc_text[:800]

            # Get document embedding
            doc_response = self.sync_client.embeddings.create(
                input=doc_preview,
                model=self.embedding_deployment
            )
            doc_embedding = doc_response.data[0].embedding

            # Compare with standard embeddings
            standard_embeddings = self._get_standard_embeddings()

            best_match = None
            best_score = -1
            second_best_score = -1
            scores = []

            for std_id, std_embedding in standard_embeddings.items():
                score = cosine_similarity(doc_embedding, std_embedding)
                scores.append((std_id, score))
                if score > best_score:
                    second_best_score = best_score
                    best_score = score
                    best_match = std_id
                elif score > second_best_score:
                    second_best_score = score

            # Sort scores for logging
            scores.sort(key=lambda x: x[1], reverse=True)
            logger.debug(f"Tier 2 similarity scores (top 5): {scores[:5]}")

            # Calculate confidence margin (difference between best and second best)
            confidence_margin = best_score - second_best_score

            # Boost score if filename hint matches embedding result
            filename_confirmed = False
            if filename_hint and filename_hint == best_match:
                best_score += 0.08  # Boost for filename confirmation
                filename_confirmed = True
                logger.info(f"Tier 2: Filename hint confirmed by embedding (+0.08 boost)")
            elif filename_hint and filename_hint != best_match:
                logger.warning(f"Filename hint ({filename_hint}) differs from embedding match ({best_match}). Trusting content.")

            # Determine confidence level based on score AND margin
            if best_score > 0.82 or (best_score > 0.78 and confidence_margin > 0.05):
                confidence = "high"
            elif best_score > 0.72 or (best_score > 0.68 and confidence_margin > 0.03):
                confidence = "medium"
            elif best_score > 0.60:
                confidence = "low"
            else:
                # Very low score - fall through to Tier 3
                confidence = None

            if confidence:
                reasoning = f"Embedding similarity: {best_score:.2f}, margin: {confidence_margin:.2f}"
                if filename_confirmed:
                    reasoning += " (filename confirmed)"

                logger.info(f"Tier 2 {confidence} match: {best_match} (score={best_score:.3f}, margin={confidence_margin:.3f})")
                return {
                    "standard_id": best_match,
                    "confidence": confidence,
                    "reasoning": reasoning,
                    "tier": 2
                }

        except Exception as e:
            logger.warning(f"Tier 2 embedding matching failed: {e}")

        # === TIER 3: LLM Analysis (expensive - only if Tier 2 failed) ===
        logger.info("Falling back to Tier 3 LLM analysis (low embedding confidence)")

        # Use meaningful content for LLM
        doc_preview = extract_meaningful_content(doc_text, max_chars=1200)

        analysis_prompt = f"""حدد رقم معيار DGA الأنسب للمستند التالي.

المعايير المتاحة:
- 5.2.1: لجنة التحول الرقمي
- 5.2.2: إطار حوكمة التحول الرقمي
- 5.2.3: التعاون المشترك بين الجهات
- 5.3.x: البنية المؤسسية
- 5.8.x: إدارة المخاطر
- 5.9.x: استمرارية الأعمال
- 5.10.1: مكتب إدارة المشاريع
- 5.10.2: أنظمة إدارة المشاريع الرقمية
- 5.13: منصات الحكومة الشاملة
- 5.15: القنوات والخدمات الرقمية
- 5.17: البيانات والذكاء الاصطناعي
- 5.18: الحوسبة السحابية

اسم الملف: {filename}
محتوى المستند:
{doc_preview}

أجب بصيغة JSON فقط:
{{"standard_id": "X.X.X", "confidence": "high/medium/low", "reasoning": "سبب الاختيار"}}"""

        try:
            response = await self.client.chat.completions.create(
                model=self.deployment_name,
                messages=[{"role": "user", "content": analysis_prompt}],
                stream=False,
                temperature=0.1,
                max_tokens=150
            )

            result_text = response.choices[0].message.content.strip()
            json_match = re.search(r'\{[^}]+\}', result_text)
            if json_match:
                result = json.loads(json_match.group())
                result["tier"] = 3
                return result
            else:
                return {"standard_id": None, "confidence": "low", "reasoning": "Could not parse LLM response", "tier": 3}

        except Exception as e:
            return {"standard_id": None, "confidence": "low", "reasoning": f"LLM analysis error: {str(e)}", "tier": 3}

ai_service = AzureOpenAIService()
