from fastapi import APIRouter, UploadFile, File, Form, Depends, Request
import asyncio
from fastapi.responses import StreamingResponse
from typing import Optional
from Backend.Source.Services.AIService import ai_service
from Backend.Source.Services.DocumentService import DocumentService
from Backend.Source.Services.KnowledgeBaseService import get_kb_service
from Backend.Source.Services.ChatHistoryService import chat_history_service
import json
import re
from Backend.Source.Services.SettingsService import settings_service
from Backend.Source.Api.Routes.Auth import get_current_user
from Backend.Source.Models.User import User
from Backend.Source.Core.Config.Config import settings
from Backend.Source.Core.Logging import logger
from Backend.Source.Middleware.RateLimiting import limiter
from Backend.Source.Utils.CSRF import verify_csrf, cleanup_expired_tokens

router = APIRouter()

# Stream timeout in seconds
STREAM_TIMEOUT = 300  # 5 minutes

@router.post("/chat")
@limiter.limit(settings.RATE_LIMIT_CHAT)
async def chat_endpoint(
    request: Request,
    message: Optional[str] = Form(None),
    history: str = Form(None),
    file: UploadFile = File(None),
    conversation_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    _csrf: None = Depends(verify_csrf)  # CSRF verification added
):
    """
    Unified Chat Endpoint with Dual RAG and History Persistence.
    """
    # Periodic CSRF token cleanup (lightweight, runs occasionally)
    cleanup_expired_tokens()

    kb = get_kb_service()
    
    # --- 1. HANDLE USER MESSAGE & FILE PERSISTENCE ---
    user_query = message if message else ""
    doc_text = ""
    file_keywords = ""
    extracted_key_terms = []
    detected_context = []  # Track document context for targeted RAG search
    
    # File Processing
    if file:
        if not user_query:
            user_query = "يرجى تحليل مدى امتثال هذا المستند المرفق للمعايير."
        
        try:
            # Extract Text
            doc_text = await DocumentService.extract_text(file)
            
            # Persist to SQLite (History)
            if conversation_id:
                chat_history_service.add_message(
                    conversation_id=conversation_id,
                    role="user",
                    content=user_query,
                    attachment_name=file.filename,
                    attachment_content=doc_text
                )
                
                # Persist to Chroma (Session RAG)
                kb.add_session_document(doc_text, conversation_id, file.filename)
                
            # Perform AI-Powered Document Analysis
            # Use LLM to intelligently identify the most relevant DGA standard

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

    # --- 2. DUAL RAG RETRIEVAL ---
    global_context = ""
    session_context = ""

    # A. GLOBAL RAG (Qiyas Standards)
    expanded_context_set = set()
    collected_chunks = []

    # ID Detection - check if user specified a standard ID
    id_match_3 = re.search(r'\b(\d+\.\d+\.\d+)\b', user_query)
    target_id_3 = id_match_3.group(1) if id_match_3 else None

    if target_id_3:
        # User specified a standard ID - do exact search
        exact_results = kb.search_exact(target_id_3)
        if exact_results['ids']:
            first_meta = exact_results['metadatas'][0]
            expanded_chunks = kb.get_neighbors(first_meta.get('source'), first_meta.get('chunk_index'), window=3)
            global_context = "\n\n".join(expanded_chunks)
    else:
        # No ID specified - use intelligent search based on document context
        ai_high_confidence = False

        # If AI pre-analysis detected a standard, do targeted exact search
        if file and detected_context:
            for context_item in detected_context:
                if context_item.startswith("ai_detected:"):
                    ai_standard_id = context_item.split(":")[1]
                    exact_results = kb.search_exact(ai_standard_id)
                    if exact_results['ids']:
                        first_meta = exact_results['metadatas'][0]
                        neighbors = kb.get_neighbors(first_meta.get('source'), first_meta.get('chunk_index'), window=2)
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
            # Use Hybrid Search (Semantic + Lexical)
            # Pass enriched query for semantic search (vectors)
            # Pass raw user query for lexical search (exact strings)
            context_results = kb.search_hybrid(
                query_text=search_query, 
                n_results=5,
                lexical_query=user_query
            )

            if context_results['metadatas']:
                metas = context_results['metadatas'][0]

                for meta in metas:
                    source = meta.get('source')
                    index = meta.get('chunk_index')
                    if source and index is not None:
                        neighbors = kb.get_neighbors(source, index, window=1)
                        for chunk in neighbors:
                            if chunk not in expanded_context_set:
                                expanded_context_set.add(chunk)
                                collected_chunks.append(chunk)

        logger.debug(f"Global search: {len(collected_chunks)} chunks (high_confidence={ai_high_confidence})")
        global_context = "\n\n".join(collected_chunks)

    # B. SESSION RAG (Uploaded Files)
    if conversation_id:
        logger.debug(f"Session RAG: Querying conversation {conversation_id}")
        session_results = kb.query_session(user_query, conversation_id, n_results=5)
        if session_results['documents']:
            session_context = "\n\n".join(session_results['documents'][0])
            logger.debug(f"Found {len(session_results['documents'][0])} session chunks for conversation {conversation_id}")

    # --- 3. CONTEXT INJECTION & PROMPT ---
    # Optimize: Only include raw doc_text if NOT already in Session RAG
    # This avoids sending the same content twice (saves ~3000 tokens per file upload)

    context_parts = []

    if global_context:
        context_parts.append(f"[OFFICIAL QIYAS STANDARDS]:\n{global_context}")

    if session_context:
        context_parts.append(f"[SESSION DOCUMENTS]:\n{session_context}")

    # Only include raw doc_text if:
    # 1. File was uploaded (Always include it for the immediate turn to ensure AI sees it)
    if doc_text:
        context_parts.append(f"[UPLOADED FILE]:\n{doc_text[:4000]}")

    final_context = "\n\n".join(context_parts) if context_parts else "No context available."
    
    system_prompt = settings_service.get_settings().system_prompt
    try:
        system_prompt = system_prompt.format(context_text=final_context, user_query=user_query)
    except (KeyError, ValueError) as e:
        logger.warning(f"Failed to format system prompt: {e}. Using fallback format.")
        system_prompt = f"{system_prompt}\n\nCONTEXT:\n{final_context}\n"

    # --- 4. HISTORY (Context Window) ---
    messages = [{"role": "system", "content": system_prompt}]
    
    # Load recent history from DB if available, else from props
    if conversation_id:
        # Fetch last 8 messages from DB (we'll use 6 for context, excluding current user msg)
        db_history = chat_history_service.get_recent_messages(conversation_id, current_user.id, limit=8)
        if db_history:
            # Convert to OpenAI format
            # Filter out the very latest user message we just added (it's the last one in db_history)
            # We want the *context* (previous turns), up to 6 messages

            # Slice: Get everything EXCEPT the last one (current user msg), then take the last 6 of those
            prior_messages = db_history[:-1] if len(db_history) > 1 else []
            recent_db = prior_messages[-6:]

            messages.extend([{"role": m.role, "content": m.content} for m in recent_db])
    elif history:
        # Fallback to frontend-provided history (for non-persisted chats)
        try:
            json_hist = json.loads(history)
            messages.extend([m for m in json_hist if m['role'] in ['user', 'assistant']][-6:])
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.warning(f"Failed to parse history from frontend: {e}")

    messages.append({"role": "user", "content": user_query})

    # --- 5. STREAM & SAVE RESPONSE ---
    
    async def stream_generator():
        full_response = ""
        try:
            # Add timeout to prevent hung connections
            response = await asyncio.wait_for(
                ai_service.get_chat_response(messages, stream=True),
                timeout=STREAM_TIMEOUT
            )

            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    content_chunk = chunk.choices[0].delta.content
                    full_response += content_chunk
                    yield content_chunk

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

    return StreamingResponse(stream_generator(), media_type="text/event-stream")

