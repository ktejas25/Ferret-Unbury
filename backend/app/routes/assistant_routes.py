from typing import List
from fastapi import APIRouter, HTTPException, Path, Depends
from app.models.schemas import (
    ChatRequest, ChatResponse, SummarizeRequest, SummarizeResponse,
    ConversationItem, ConversationDetailResponse, GenericSuccessResponse
)
from app.services.ai_assistant_service import ai_assistant_service
from app.core.security import verify_api_authorization

router = APIRouter(prefix="/api/assistant", tags=["AI Assistant"])


@router.post("/chat", response_model=ChatResponse)
def assistant_chat(req: ChatRequest):
    """Answers questions across indexed documents using retrieval-augmented generation (RAG) with traceable citations."""
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    return ai_assistant_service.chat(
        message=req.message,
        conversation_id=req.conversation_id,
        scope_type=req.scope_type,
        scope_id=req.scope_id,
        document_ids=req.document_ids
    )


@router.post("/summarize", response_model=SummarizeResponse)
def summarize_document(req: SummarizeRequest):
    """Generates grounded executive summary, key points, and action items for a document."""
    try:
        return ai_assistant_service.summarize_document(req.file_id, req.mode)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization error: {e}")


@router.get("/conversations", response_model=List[ConversationItem])
def list_conversations():
    """Lists recent AI assistant conversation threads."""
    return ai_assistant_service.list_conversations()


@router.get("/conversations/{conv_id}", response_model=ConversationDetailResponse)
def get_conversation(conv_id: str = Path(..., min_length=1)):
    """Retrieves full message history and citations for a conversation thread."""
    conv_data = ai_assistant_service.get_conversation(conv_id)
    if not conv_data:
        raise HTTPException(status_code=404, detail=f"Conversation {conv_id} not found")
    return ConversationDetailResponse(
        conversation=conv_data["conversation"],
        messages=conv_data["messages"]
    )


@router.delete("/conversations/{conv_id}", response_model=GenericSuccessResponse, dependencies=[Depends(verify_api_authorization)])
def delete_conversation(conv_id: str = Path(..., min_length=1)):
    """Deletes an assistant conversation thread."""
    success = ai_assistant_service.delete_conversation(conv_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Conversation {conv_id} not found")
    return GenericSuccessResponse(success=True, message="Conversation deleted successfully")

