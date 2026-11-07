from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Depends
from app.models.schemas import (
    DuplicateListResponse, KnowledgeGraphResponse,
    CompareDocumentsRequest, CompareDocumentsResponse,
    DocumentTimelineResponse, OrganizeProposalResponse,
    ExecuteOrganizeRequest, GenericSuccessResponse
)
from app.services.duplicate_service import duplicate_service
from app.services.knowledge_service import knowledge_service
from app.services.comparison_service import comparison_service
from app.services.timeline_service import timeline_service
from app.services.organization_service import organization_service
from app.core.security import verify_api_authorization

router = APIRouter(prefix="/api/discovery", tags=["Discovery and Intelligence"])


# ---------------- Duplicate Manager ----------------
@router.get("/duplicates", response_model=DuplicateListResponse)
def get_duplicates():
    """Identifies exact (content hash) and near-duplicate (vector similarity) files with wasted storage estimates."""
    return duplicate_service.find_duplicates()


@router.post("/duplicates/delete", response_model=GenericSuccessResponse, dependencies=[Depends(verify_api_authorization)])
def safe_delete_duplicate(
    file_id: int = Query(..., ge=1),
    confirm: bool = Query(default=False)
):
    """Safely removes a duplicate document with explicit confirmation."""
    success, msg = duplicate_service.safe_delete_file(file_id, confirm=confirm)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return GenericSuccessResponse(success=True, message=msg)


# ---------------- Knowledge Graph ----------------
@router.get("/graph", response_model=KnowledgeGraphResponse)
def get_knowledge_graph(filter_group: Optional[str] = Query(default=None)):
    """Provides interactive entity and document relationship graph data."""
    return knowledge_service.get_knowledge_graph(filter_group=filter_group)


# ---------------- Document Comparison ----------------
@router.post("/compare", response_model=CompareDocumentsResponse)
def compare_documents(req: CompareDocumentsRequest):
    """Performs side-by-side textual diff comparison and highlights clause/content changes."""
    try:
        return comparison_service.compare_documents(req.file_id_a, req.file_id_b)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {e}")


# ---------------- Document Timeline ----------------
@router.get("/timeline", response_model=DocumentTimelineResponse)
def get_document_timeline(limit: int = Query(default=100, ge=1, le=500)):
    """Returns chronological events and milestones extracted from indexed documents."""
    return timeline_service.get_timeline(limit=limit)


# ---------------- Intelligent Organization ----------------
@router.get("/organize/propose", response_model=OrganizeProposalResponse)
def propose_organization(folder_id: int = Query(..., ge=1)):
    """
    Generates dry-run folder organization proposals based on categories and dates.
    Does NOT move or rename any files without explicit approval.
    """
    try:
        return organization_service.propose_organization(folder_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/organize/execute", response_model=GenericSuccessResponse, dependencies=[Depends(verify_api_authorization)])
def execute_organization(req: ExecuteOrganizeRequest):
    """Executes explicitly approved file organization moves within security boundaries."""
    if not req.approved_moves:
        raise HTTPException(status_code=400, detail="No approved moves provided")
    res = organization_service.execute_organization(req.approved_moves)
    return GenericSuccessResponse(
        success=True,
        message=res["message"],
        data=res
    )

