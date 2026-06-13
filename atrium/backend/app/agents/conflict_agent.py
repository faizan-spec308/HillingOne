"""The Conflict Resolution Agent.

This is the genuine agentic AI in Atrium. It receives a goal, has access to
six real tools that touch the database, and autonomously decides which tools
to call in what order until the goal is achieved or escalation is needed.

The agent uses Gemini 2.5 Flash with native function calling. Each step of the
agent's reasoning is captured and exposed to the frontend so judges can watch
the agent think live.
"""
import json
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.agents.tools import ALL_TOOL_DECLARATIONS, AgentTools
from app.models.booking import Booking
from app.models.asset import Asset
from app.models.agent_run import AgentRun


AGENT_SYSTEM_PROMPT = """You are the Atrium Conflict Resolution Agent for Hillingdon Council's booking system.

Your goal: resolve booking conflicts respectfully and intelligently.

Strict principles:
1. Never cancel a confirmed booking unilaterally. You can only ASK the resident to consider a swap.
2. Find the best alternative venue that genuinely matches the resident's original needs.
3. The resident has full right to decline. State this clearly in your message.
4. Offer a 20 percent flexibility credit as goodwill for considering the swap.
5. If no good alternative exists (best score below 60), escalate to human staff instead of asking.
6. Always end your run by calling log_decision with your final outcome.

Approach — try hard before giving up:
- First call search_inventory for the same ward and category with sufficient capacity, matching the original booking's kitchen and step-free access needs.
- If that returns no usable candidates, WIDEN your search progressively before escalating: (a) drop the kitchen/step-free filters and treat them as scoring factors instead, then (b) allow any category in the same ward, then (c) search borough-wide. Only conclude there is no alternative after these attempts.
- For every promising candidate, call check_availability at the original time window, then score_alternative. Evaluate several candidates, not just the first, and prefer the highest score.
- If the best available candidate scores >= 60, call send_swap_request with a polite message.
- Only call escalate_to_staff if, after widening, no available venue scores >= 60. When you escalate, give a specific reason (no venues, all booked, or best score too low).
- Finally, always call log_decision with your final outcome and concise reasoning.

Be efficient. Use British English. Never invent facts."""


class ConflictResolutionAgent:
    """Autonomous agent for resolving booking conflicts.

    Uses Gemini 2.5 Flash function calling to autonomously plan and execute
    a multi-step resolution strategy.
    """

    MAX_ITERATIONS = 10

    def __init__(self, db: AsyncSession):
        self.db = db
        self.tools_impl = AgentTools(db)
        self.steps: list[dict] = []
        self._client = None

    def _get_client(self):
        if self._client is not None:
            return self._client
        try:
            from google import genai
            self._client = genai.Client(api_key=settings.gemini_api_key)
            return self._client
        except ImportError:
            return None

    async def resolve(
        self,
        confirmed_booking_id: str,
        priority_request_summary: str,
    ) -> dict:
        """Run the autonomous agent loop.

        Returns the full step trace plus final decision.
        """
        booking = await self.db.get(Booking, confirmed_booking_id)
        if not booking:
            return self._fail("Booking not found")

        asset = await self.db.get(Asset, booking.asset_id)

        goal = self._build_goal(
            booking=booking,
            asset=asset,
            priority_request_summary=priority_request_summary,
        )

        client = self._get_client()
        if client is None or not settings.gemini_api_key or settings.gemini_api_key == "paste_your_key_from_aistudio.google.com_here":
            # Fallback to deterministic agent execution if no API key.
            # Useful so the demo never breaks even when offline.
            return await self._fallback_agent(
                booking=booking,
                asset=asset,
                priority_summary=priority_request_summary,
            )

        try:
            return await self._run_with_gemini(client, goal, confirmed_booking_id)
        except Exception as exc:
            self.steps.append({
                "step": len(self.steps) + 1,
                "type": "error",
                "content": f"Agent execution failed: {exc}. Falling back to deterministic resolution.",
                "timestamp": datetime.utcnow().isoformat(),
            })
            return await self._fallback_agent(
                booking=booking,
                asset=asset,
                priority_summary=priority_request_summary,
            )

    def _build_goal(self, booking: Booking, asset: Asset, priority_request_summary: str) -> str:
        return (
            f"A confirmed booking at {asset.name} in {asset.ward} (capacity {asset.capacity}) "
            f"needs to be reconsidered because of this priority need:\n\n"
            f"{priority_request_summary}\n\n"
            f"Original booking details:\n"
            f"- Booking ID: {booking.id}\n"
            f"- Asset ID: {booking.asset_id}\n"
            f"- Time: {booking.start_time.isoformat()} to {booking.end_time.isoformat()}\n"
            f"- Attendees: {booking.attendee_count}\n"
            f"- Purpose: {booking.purpose}\n"
            f"- Original ward: {asset.ward}\n"
            f"- Kitchen needed: {(asset.amenities or {}).get('kitchen', False)}\n"
            f"- Wheelchair access needed: {(asset.accessibility or {}).get('wheelchair_access', False)}\n\n"
            f"Find the best alternative for the resident, send a polite swap request, and log your decision. "
            f"The resident can decline. Respect that."
        )

    async def _run_with_gemini(
        self,
        client,
        goal: str,
        confirmed_booking_id: str,
    ) -> dict:
        from google.genai import types

        tools_config = [{"function_declarations": ALL_TOOL_DECLARATIONS}]
        config = types.GenerateContentConfig(
            tools=tools_config,
            system_instruction=AGENT_SYSTEM_PROMPT,
            temperature=0.3,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )

        history = [
            types.Content(role="user", parts=[types.Part.from_text(text=goal)]),
        ]

        final_decision = None

        for iteration in range(self.MAX_ITERATIONS):
            response = await client.aio.models.generate_content(
                model=settings.gemini_model,
                contents=history,
                config=config,
            )

            if not response.candidates:
                break

            candidate = response.candidates[0]
            if not candidate.content or not candidate.content.parts:
                break

            part = candidate.content.parts[0]

            # Function call branch
            fn_call = getattr(part, "function_call", None)
            if fn_call:
                fn_name = fn_call.name
                fn_args = dict(fn_call.args) if fn_call.args else {}

                self.steps.append({
                    "step": len(self.steps) + 1,
                    "type": "tool_call",
                    "tool": fn_name,
                    "args": fn_args,
                    "timestamp": datetime.utcnow().isoformat(),
                })

                tool_method = getattr(self.tools_impl, fn_name, None)
                if tool_method is None:
                    tool_result = {"error": f"Unknown tool: {fn_name}"}
                else:
                    try:
                        tool_result = await tool_method(**fn_args)
                    except TypeError as exc:
                        tool_result = {"error": f"Invalid arguments: {exc}"}
                    except Exception as exc:
                        tool_result = {"error": str(exc)}

                self.steps.append({
                    "step": len(self.steps),
                    "type": "tool_result",
                    "tool": fn_name,
                    "result": tool_result,
                    "timestamp": datetime.utcnow().isoformat(),
                })

                history.append(candidate.content)
                history.append(types.Content(
                    role="user",
                    parts=[types.Part.from_function_response(
                        name=fn_name,
                        response=tool_result,
                    )],
                ))

                if fn_name == "log_decision":
                    final_decision = fn_args.get("decision")
                    break
                continue

            # Text branch (agent thought without tool call - usually means done)
            text_content = getattr(part, "text", None)
            if text_content:
                self.steps.append({
                    "step": len(self.steps) + 1,
                    "type": "agent_thought",
                    "content": text_content,
                    "timestamp": datetime.utcnow().isoformat(),
                })
            break

        run_record = AgentRun(
            id=uuid.uuid4(),
            agent_name="conflict_resolution",
            goal=goal[:1000],
            steps=self.steps,
            final_outcome=final_decision or "incomplete",
            related_booking_id=confirmed_booking_id,
        )
        self.db.add(run_record)
        await self.db.commit()

        return {
            "agent_run_id": str(run_record.id),
            "agent": "conflict_resolution",
            "goal_summary": goal[:200],
            "steps": self.steps,
            "final_decision": final_decision or "incomplete",
            "iterations_used": len([s for s in self.steps if s["type"] == "tool_call"]),
        }

    async def _fallback_agent(
        self,
        booking: Booking,
        asset: Asset,
        priority_summary: str,
    ) -> dict:
        """Deterministic resolution that tries hard before escalating.

        Searches with strict criteria first, then progressively widens
        (drop amenity requirements → any category → borough-wide), evaluates
        every available candidate, and proposes the best-scoring one. It only
        escalates when nothing clears the bar — and records exactly why.
        """
        amenities = asset.amenities or {}
        accessibility = asset.accessibility or {}
        attendees = booking.attendee_count or 0
        min_cap = attendees if attendees > 0 else 1
        needs_kitchen = amenities.get("kitchen", False)
        needs_wheelchair = accessibility.get("wheelchair_access", False)

        start_iso = booking.start_time.isoformat()
        end_iso = booking.end_time.isoformat()

        def _record(tool, args, result):
            n = len([s for s in self.steps if s["type"] == "tool_call"]) + 1
            ts = datetime.utcnow().isoformat()
            self.steps.append({"step": n, "type": "tool_call", "tool": tool, "args": args, "timestamp": ts})
            self.steps.append({"step": n, "type": "tool_result", "tool": tool, "result": result, "timestamp": ts})

        # ── Progressive search: strict first, then widen until options appear ──
        plans = [
            ("Same ward, same type, matching kitchen & step-free access", asset.ward, asset.category, needs_kitchen, needs_wheelchair),
            ("Same ward, same type", asset.ward, asset.category, False, False),
            ("Same ward, any type", asset.ward, "any", False, False),
            ("Borough-wide, same type, matching features", "any", asset.category, needs_kitchen, needs_wheelchair),
            ("Borough-wide, same type", "any", asset.category, False, False),
        ]

        candidates: dict = {}
        for label, ward, category, k_req, w_req in plans:
            res = await self.tools_impl.search_inventory(
                ward=ward, min_capacity=min_cap, category=category,
                kitchen_required=k_req, wheelchair_required=w_req,
            )
            _record("search_inventory", {
                "strategy": label, "ward": ward, "min_capacity": min_cap,
                "category": category, "kitchen_required": k_req, "wheelchair_required": w_req,
            }, res)
            for a in res.get("assets", []):
                if a["id"] != str(asset.id):
                    candidates.setdefault(a["id"], a)
            if len(candidates) >= 3:
                break

        if not candidates:
            return await self._escalate_and_log(
                booking.id, "no_candidates_found",
                f"No active venue, even borough-wide, has capacity for {min_cap}+ attendees. "
                f"A human officer is needed to find or free up a space.",
            )

        # ── Evaluate availability + fit for each candidate; keep the best ──
        scored = []
        for cand in list(candidates.values())[:6]:
            avail = await self.tools_impl.check_availability(
                asset_id=cand["id"], start_time_iso=start_iso, end_time_iso=end_iso,
            )
            _record("check_availability", {"asset_id": cand["id"], "asset_name": cand["name"]}, avail)
            if not avail.get("available"):
                continue
            sc = await self.tools_impl.score_alternative(
                alternative_asset_id=cand["id"], original_booking_id=str(booking.id),
            )
            _record("score_alternative", {"asset_id": cand["id"], "asset_name": cand["name"]}, sc)
            scored.append((sc.get("score", 0), cand, sc))

        if not scored:
            return await self._escalate_and_log(
                booking.id, "no_available_alternatives",
                f"Found {len(candidates)} comparable venue(s), but every one is already booked "
                f"at this time. A human officer should negotiate an alternative time or space.",
            )

        scored.sort(key=lambda x: x[0], reverse=True)
        best_score, best, best_detail = scored[0]

        if best_score < 60:
            return await self._escalate_and_log(
                booking.id, "low_match_score",
                f"The closest available option, {best['name']}, scored only {best_score}/100 "
                f"({best_detail.get('reasoning')}) — below the 60-point bar for a fair swap. "
                f"A human officer should review.",
            )

        # ── Propose the best alternative ──
        swap_message = (
            f"Hello, an unexpected priority need has come up for your booking at {asset.name}. "
            f"We would like to ask whether you would consider moving to {best['name']} "
            f"at the same time. As a thank you for your flexibility, we will apply a 20 percent "
            f"goodwill credit to your next booking. Please feel free to decline and your current "
            f"booking will stay exactly as it is. No pressure at all."
        )
        swap_args = {
            "booking_id": str(booking.id),
            "alternative_asset_id": best["id"],
            "swap_message": swap_message,
            "flexibility_credit_percent": 20,
        }
        _record("send_swap_request", swap_args, await self.tools_impl.send_swap_request(**swap_args))

        log_args = {
            "booking_id": str(booking.id),
            "decision": "swap_proposed",
            "reasoning": (
                f"Evaluated {len(scored)} available alternative(s); best match {best['name']} "
                f"scored {best_score}/100 ({best_detail.get('reasoning')}). Sent a polite swap "
                f"request with a 20 percent goodwill credit. The resident may decline."
            ),
        }
        _record("log_decision", log_args, await self.tools_impl.log_decision(**log_args))

        run_record = AgentRun(
            id=uuid.uuid4(),
            agent_name="conflict_resolution",
            goal=f"Resolve conflict for booking {booking.id}",
            steps=self.steps,
            final_outcome="swap_proposed",
            related_booking_id=booking.id,
        )
        self.db.add(run_record)
        await self.db.commit()

        return {
            "agent_run_id": str(run_record.id),
            "agent": "conflict_resolution",
            "steps": self.steps,
            "final_decision": "swap_proposed",
            "iterations_used": len([s for s in self.steps if s["type"] == "tool_call"]),
        }

    async def _escalate_and_log(self, booking_id, reason, recommendation):
        await self.tools_impl.escalate_to_staff(
            booking_id=str(booking_id),
            reason=reason,
            recommendation=recommendation,
        )
        self.steps.append({
            "step": len(self.steps) + 1,
            "type": "tool_call",
            "tool": "escalate_to_staff",
            "args": {"booking_id": str(booking_id), "reason": reason, "recommendation": recommendation},
            "timestamp": datetime.utcnow().isoformat(),
        })
        await self.tools_impl.log_decision(
            booking_id=str(booking_id),
            decision="escalated",
            reasoning=recommendation,
        )
        run_record = AgentRun(
            id=uuid.uuid4(),
            agent_name="conflict_resolution",
            goal="Resolve booking conflict",
            steps=self.steps,
            final_outcome="escalated",
            related_booking_id=booking_id,
        )
        self.db.add(run_record)
        await self.db.commit()
        return {
            "agent_run_id": str(run_record.id),
            "agent": "conflict_resolution",
            "steps": self.steps,
            "final_decision": "escalated",
            "iterations_used": len(self.steps),
        }

    def _fail(self, msg: str) -> dict:
        return {
            "agent": "conflict_resolution",
            "steps": [{"type": "error", "content": msg}],
            "final_decision": "failed",
            "iterations_used": 0,
        }
