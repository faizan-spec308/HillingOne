"""Agent router: trigger autonomous Conflict Resolution Agent and stream its reasoning."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.dependencies import require_staff
from app.schemas.search import AgentTriggerRequest
from app.agents.conflict_agent import ConflictResolutionAgent
from app.models.agent_run import AgentRun

# Staff-only: triggering the agent and reading its runs both expose booking
# details and are operational actions, so the whole router requires staff auth.
router = APIRouter(prefix="/api/agent", tags=["agent"], dependencies=[Depends(require_staff)])


@router.post("/conflict-resolution")
async def trigger_agent(req: AgentTriggerRequest, db: AsyncSession = Depends(get_db)):
    """Trigger the autonomous Conflict Resolution Agent.

    The agent receives the goal and the available tools, then independently
    decides which tools to call in what order to achieve the goal.
    """
    agent = ConflictResolutionAgent(db)
    result = await agent.resolve(
        confirmed_booking_id=str(req.confirmed_booking_id),
        priority_request_summary=req.priority_request_summary,
    )
    return result


@router.get("/runs/recent")
async def recent_runs(limit: int = 20, db: AsyncSession = Depends(get_db)):
    stmt = select(AgentRun).order_by(desc(AgentRun.created_at)).limit(limit)
    result = await db.execute(stmt)
    return [r.to_dict() for r in result.scalars().all()]


@router.get("/runs/{run_id}")
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await db.get(AgentRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Agent run not found")
    return run.to_dict()
