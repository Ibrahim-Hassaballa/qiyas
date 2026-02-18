from fastapi import APIRouter, UploadFile, File, Form, Depends, Request, HTTPException
import asyncio
from fastapi.responses import StreamingResponse
from typing import Optional
from uuid import UUID as PyUUID
from openai import OpenAI
from pydantic import BaseModel
from Backend.Source.Services.AIService import ai_service, get_ai_service
from Backend.Source.Services.DocumentService import DocumentService
from Backend.Source.Services.KnowledgeBaseService import get_kb_service
from Backend.Source.Services.ChatHistoryService import chat_history_service
import json
import re
from Backend.Source.Services.SettingsService import settings_service
from Backend.Source.Services.UserManagementService import user_management_service
from Backend.Source.Api.Routes.Auth import get_current_user
from Backend.Source.Models.User import User
from Backend.Source.Core.Config.Config import settings
from Backend.Source.Core.Logging import logger
from Backend.Source.Core.Database import get_db
from Backend.Source.Middleware.RateLimiting import limiter
from Backend.Source.Utils.CSRF import verify_csrf, cleanup_expired_tokens

class TopicGuard(BaseModel):
    on_topic: bool

router = APIRouter()

# Stream timeout in seconds
STREAM_TIMEOUT = 300  # 5 minutes

# Per-model pricing (per million tokens)
MODEL_PRICING = {
    "openai/gpt-oss-120b": {"input": 0.15, "output": 0.60},
    "moonshotai/kimi-k2-instruct-0905": {"input": 1.00, "output": 3.00},
}

@router.post("/chat")
@limiter.limit(settings.RATE_LIMIT_CHAT)
async def chat_endpoint(
    request: Request,
    message: Optional[str] = Form(None),
    history: str = Form(None),
    file: UploadFile = File(None),
    conversation_id: Optional[str] = Form(None),
    model_provider: Optional[str] = Form("azure"),
    model_name: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db = Depends(get_db),
    _csrf: None = Depends(verify_csrf)  # CSRF verification added
):
    """
    Unified Chat Endpoint with Dual RAG and History Persistence.
    All operations are scoped to the current user's tenant.
    """
    # Periodic CSRF token cleanup (lightweight, runs occasionally)
    cleanup_expired_tokens()

    # Validate conversation_id as UUID if provided
    if conversation_id:
        try:
            conversation_id = PyUUID(conversation_id)
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="Invalid conversation ID format")

    # Check cost budget before processing
    user_management_service.check_cost_limit(db, current_user.id)

    # Extract tenant context from authenticated user
    tenant_id = current_user.tenant_id

    kb = get_kb_service()
    
    # --- 0. TOPIC GUARD: Reject off-topic questions (Groq structured output) ---
    user_query = message if message else ""

    # Fetch tenant settings early (reused for topic guard, system prompt, and model config)
    tenant_settings = settings_service.get_settings(str(tenant_id))

    if user_query and not file and settings.GROQ_API_KEY:
        try:
            guard_client = OpenAI(
                api_key=settings.GROQ_API_KEY,
                base_url="https://api.groq.com/openai/v1",
            )
            # Build guard input with conversation history for follow-up context
            guard_input = [
                {"role": "system", "content": tenant_settings.topic_guard_prompt},
            ]

            # Include recent chat history so the guard understands follow-up questions
            if conversation_id:
                try:
                    recent_history = chat_history_service.get_recent_messages(
                        conversation_id, current_user.id, tenant_id, limit=6
                    )
                    if recent_history:
                        for msg in recent_history[-6:]:
                            if msg.content and msg.role in ("user", "assistant"):
                                guard_input.append({
                                    "role": msg.role,
                                    "content": msg.content
                                })
                        logger.debug(f"Topic guard: included {len(recent_history)} history messages for context")
                except Exception as e:
                    logger.warning(f"Topic guard: failed to load chat history, proceeding without context: {e}")

            guard_input.append({"role": "user", "content": user_query})

            guard_response = guard_client.responses.parse(
                model=settings.GROQ_MODEL,
                input=guard_input,
                text_format=TopicGuard,
            )
            guard_result = guard_response.output_parsed
            logger.info(f"Topic guard: on_topic={guard_result.on_topic} for query: '{user_query[:80]}'")

            if not guard_result.on_topic:
                refusal = "عذراً، أنا مساعد متخصص فقط في معايير قياس للتحول الرقمي الصادرة عن هيئة الحكومة الرقمية (DGA). لا أستطيع المساعدة في مواضيع أخرى. يرجى طرح سؤال يتعلق بمعايير قياس."

                if conversation_id:
                    chat_history_service.add_message(conversation_id=conversation_id, role="user", content=user_query)
                    chat_history_service.add_message(conversation_id=conversation_id, role="assistant", content=refusal)

                async def refusal_stream():
                    yield refusal
                return StreamingResponse(refusal_stream(), media_type="text/event-stream")
        except Exception as e:
            logger.warning(f"Topic guard failed, allowing through: {e}")

    # --- 1. HANDLE USER MESSAGE & FILE PERSISTENCE ---
    doc_text = ""
    file_keywords = ""
    extracted_key_terms = []
    detected_context = []  # Track document context for targeted RAG search

    # File Processing
    if file:
        try:
            # Extract Text
            doc_text = await DocumentService.extract_text(file)

            # Persist to DB (History) with original user message (no fallback)
            if conversation_id:
                chat_history_service.add_message(
                    conversation_id=conversation_id,
                    role="user",
                    content=user_query or "",
                    attachment_name=file.filename,
                    attachment_content=doc_text
                )

                # Persist to Chroma (Session RAG) — scoped by tenant
                kb.add_session_document(doc_text, conversation_id, file.filename, str(tenant_id))

            # Set Arabic fallback AFTER saving — only used for AI prompt
            if not user_query:
                user_query = "يرجى تحليل مدى امتثال هذا المستند المرفق للمعايير."

            # Perform AI-Powered Document Analysis
            ai_analysis = await ai_service.analyze_document_for_standard(doc_text, file.filename)
            detected_standard_id = ai_analysis.get("standard_id")
            analysis_confidence = ai_analysis.get("confidence", "low")
            analysis_reasoning = ai_analysis.get("reasoning", "")

            analysis_tier = ai_analysis.get("tier", "unknown")
            logger.info(f"AI Document Analysis: standard={detected_standard_id}, confidence={analysis_confidence}, tier={analysis_tier}, reason={analysis_reasoning}")

            # Store detected standard for targeted RAG search
            if detected_standard_id and analysis_confidence in ["high", "medium"]:
                detected_context.append(f"ai_detected:{detected_standard_id}")
                logger.info(f"AI Pre-Analysis identified standard {detected_standard_id} with {analysis_confidence} confidence")

            # Extract header lines for semantic search enhancement
            header_lines = [line.strip() for line in doc_text.split('\n') if 10 < len(line.strip()) < 60][:5]
            file_keywords = " ".join(header_lines)

        except Exception as e:
            logger.error(f"File processing error for {file.filename}: {e}", exc_info=True)
            doc_text = f"[Error reading file: {str(e)}]"
    
    elif conversation_id and user_query:
        # Text-only message: Save to History
        chat_history_service.add_message(
            conversation_id=conversation_id,
            role="user",
            content=user_query
        )

    # --- 2. DUAL RAG RETRIEVAL (tenant-scoped) ---
    global_context = ""
    session_context = ""

    # A. GLOBAL RAG (Qiyas Standards) — scoped to tenant's knowledge base
    expanded_context_set = set()
    collected_chunks = []

    # ID Detection - check if user specified a standard ID
    id_match_3 = re.search(r'\b(\d+\.\d+\.\d+)\b', user_query)
    target_id_3 = id_match_3.group(1) if id_match_3 else None

    if target_id_3:
        # User specified a standard ID - do exact search (tenant-scoped)
        exact_results = kb.search_exact(target_id_3, tenant_id=str(tenant_id))
        if exact_results['ids']:
            first_meta = exact_results['metadatas'][0]
            expanded_chunks = kb.get_neighbors(first_meta.get('source'), first_meta.get('chunk_index'), window=3, tenant_id=str(tenant_id))
            global_context = "\n\n".join(expanded_chunks)
    else:
        # No ID specified - use intelligent search based on document context
        ai_high_confidence = False

        # If AI pre-analysis detected a standard, do targeted exact search
        if file and detected_context:
            for context_item in detected_context:
                if context_item.startswith("ai_detected:"):
                    ai_standard_id = context_item.split(":")[1]
                    exact_results = kb.search_exact(ai_standard_id, tenant_id=str(tenant_id))
                    if exact_results['ids']:
                        first_meta = exact_results['metadatas'][0]
                        neighbors = kb.get_neighbors(first_meta.get('source'), first_meta.get('chunk_index'), window=2, tenant_id=str(tenant_id))
                        for chunk in neighbors:
                            if chunk not in expanded_context_set:
                                expanded_context_set.add(chunk)
                                collected_chunks.append(chunk)
                        logger.info(f"Added standard {ai_standard_id} context via AI pre-analysis")
                        # If high confidence, skip expensive semantic search
                        if analysis_confidence == "high":
                            ai_high_confidence = True

        # Only do semantic search if AI confidence is not high (saves tokens)
        if not ai_high_confidence:
            search_query = f"{user_query} {file_keywords}"
            # Use Hybrid Search (Semantic + Lexical) — tenant-scoped
            context_results = kb.search_hybrid(
                query_text=search_query, 
                n_results=5,
                lexical_query=user_query,
                tenant_id=str(tenant_id)
            )

            if context_results['metadatas']:
                metas = context_results['metadatas'][0]

                for meta in metas:
                    source = meta.get('source')
                    index = meta.get('chunk_index')
                    if source and index is not None:
                        neighbors = kb.get_neighbors(source, index, window=1, tenant_id=str(tenant_id))
                        for chunk in neighbors:
                            if chunk not in expanded_context_set:
                                expanded_context_set.add(chunk)
                                collected_chunks.append(chunk)

        logger.debug(f"Global search: {len(collected_chunks)} chunks (high_confidence={ai_high_confidence})")
        global_context = "\n\n".join(collected_chunks)

    # B. SESSION RAG (Uploaded Files) — tenant-scoped
    if conversation_id:
        logger.debug(f"Session RAG: Querying conversation {conversation_id}")
        session_results = kb.query_session(user_query, conversation_id, n_results=5, tenant_id=str(tenant_id))
        if session_results['documents']:
            session_context = "\n\n".join(session_results['documents'][0])
            logger.debug(f"Found {len(session_results['documents'][0])} session chunks for conversation {conversation_id}")

    # --- 3. CONTEXT INJECTION & PROMPT ---
    context_parts = []

    if global_context:
        context_parts.append(f"[OFFICIAL QIYAS STANDARDS]:\n{global_context}")

    if session_context:
        context_parts.append(f"[SESSION DOCUMENTS]:\n{session_context}")

    # Only include raw doc_text if file was uploaded
    if doc_text:
        context_parts.append(f"[UPLOADED FILE]:\n{doc_text[:4000]}")

    final_context = "\n\n".join(context_parts) if context_parts else "No context available."
    
    # Get tenant-specific system prompt (tenant_settings fetched earlier before topic guard)
    system_prompt = tenant_settings.system_prompt
    try:
        system_prompt = system_prompt.format(context_text=final_context, user_query=user_query)
    except (KeyError, ValueError) as e:
        logger.warning(f"Failed to format system prompt: {e}. Using fallback format.")
        system_prompt = f"{system_prompt}\n\nCONTEXT:\n{final_context}\n"

    # --- 4. HISTORY (Context Window) ---
    messages = [{"role": "system", "content": system_prompt}]
    
    # Load recent history from DB if available, else from props
    if conversation_id:
        # Fetch last 8 messages from DB (tenant-scoped)
        db_history = chat_history_service.get_recent_messages(conversation_id, current_user.id, tenant_id, limit=8)
        if db_history:
            prior_messages = db_history[:-1] if len(db_history) > 1 else []
            recent_db = prior_messages[-6:]
            messages.extend([
                {"role": m.role, "content": m.content or (f"[Attached file: {m.attachment_name}]" if m.attachment_name else "")}
                for m in recent_db if m.content or m.attachment_name
            ])
    elif history:
        # Fallback to frontend-provided history (for non-persisted chats)
        try:
            json_hist = json.loads(history)
            messages.extend([m for m in json_hist if m['role'] in ['user', 'assistant']][-6:])
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.warning(f"Failed to parse history from frontend: {e}")

    messages.append({"role": "user", "content": user_query})

    # --- 5. STREAM & SAVE RESPONSE ---

    # Read model settings from tenant settings (admin-configured, fetched earlier), fall back to form params
    provider = tenant_settings.model_provider if tenant_settings.model_provider in ("azure", "groq") else "azure"
    # Form params override only if tenant settings are default (backward compat during transition)
    if tenant_settings.model_provider == "azure" and model_provider in ("azure", "groq"):
        provider = model_provider
    selected_ai_service = get_ai_service(provider)
    # Use tenant groq_model if set, otherwise fall back to form param
    effective_form_model = model_name
    if provider == "groq" and tenant_settings.groq_model:
        effective_form_model = tenant_settings.groq_model
    elif provider == "groq" and model_name:
        effective_form_model = model_name
    logger.info(f"Chat request using provider: {provider}, model_name: {effective_form_model}")

    # Determine effective model name for cost calculation
    effective_model_name = effective_form_model
    if provider == "groq" and not effective_model_name:
        effective_model_name = settings.GROQ_MODEL

    async def stream_generator():
        full_response = ""
        total_tokens = 0
        prompt_tokens = 0
        completion_tokens = 0
        try:
            # Add timeout to prevent hung connections
            response = await asyncio.wait_for(
                selected_ai_service.get_chat_response(messages, stream=True, model_name=effective_form_model),
                timeout=STREAM_TIMEOUT
            )

            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    content_chunk = chunk.choices[0].delta.content
                    full_response += content_chunk
                    yield content_chunk
                # Capture usage from the final chunk (stream_options includes it)
                if hasattr(chunk, 'usage') and chunk.usage is not None:
                    total_tokens = chunk.usage.total_tokens
                    prompt_tokens = getattr(chunk.usage, 'prompt_tokens', 0) or 0
                    completion_tokens = getattr(chunk.usage, 'completion_tokens', 0) or 0

        except asyncio.TimeoutError:
            logger.error(f"Stream timeout after {STREAM_TIMEOUT}s for conversation {conversation_id}")
            yield "\n\n[Error: Response timeout. Please try again.]"
        except Exception as e:
            logger.error(f"Stream error: {e}", exc_info=True)
            yield f"\n\n[Error: {str(e)}]"
        finally:
            # SAVE ASSISTANT RESPONSE (even partial)
            if conversation_id and full_response:
                chat_history_service.add_message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=full_response
                )
            # Track token usage
            if total_tokens > 0:
                try:
                    user_management_service.increment_tokens_used(db, current_user.id, total_tokens)
                except Exception as e:
                    logger.error(f"Failed to increment token usage: {e}")
            # Compute and track cost
            if prompt_tokens > 0 or completion_tokens > 0:
                try:
                    cost = 0.0
                    pricing = MODEL_PRICING.get(effective_model_name, None)
                    if pricing:
                        cost = round((prompt_tokens * pricing["input"] + completion_tokens * pricing["output"]) / 1_000_000, 6)
                    if cost > 0:
                        user_management_service.increment_cost_used(db, current_user.id, cost)
                        logger.info(f"Cost for user {current_user.id}: ${cost:.6f} (model={effective_model_name}, in={prompt_tokens}, out={completion_tokens})")
                except Exception as e:
                    logger.error(f"Failed to compute/increment cost: {e}")

    return StreamingResponse(stream_generator(), media_type="text/event-stream")
