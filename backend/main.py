import os
import json
import asyncio
import time
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

from backend.config import BASE_DIR, OLLAMA_HOST, DEFAULT_SYSTEM_PROMPT
from backend.history_manager import history_mgr

app = FastAPI(title="Aura AI Companion", version="1.0.0")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default-session"
    model: Optional[str] = None
    temperature: Optional[float] = 0.7
    system_prompt: Optional[str] = None

class SessionCreate(BaseModel):
    title: Optional[str] = "New Conversation"

class SettingsUpdate(BaseModel):
    model: Optional[str] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    system_prompt: Optional[str] = None
    auto_tts: Optional[bool] = None
    voice_rate: Optional[float] = None
    voice_pitch: Optional[float] = None
    selected_voice: Optional[str] = None
    simulation_mode: Optional[bool] = None

class ModelPullRequest(BaseModel):
    model: str

@app.get("/api/status")
async def get_status():
    """Check Ollama connectivity and list local installed models."""
    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            resp = await client.get(f"{OLLAMA_HOST}/api/tags")
            latency_ms = round((time.time() - start_time) * 1000, 1)
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("name") for m in data.get("models", [])]
                return {
                    "online": True,
                    "endpoint": OLLAMA_HOST,
                    "latency_ms": latency_ms,
                    "models": models,
                    "model_count": len(models),
                    "message": f"Connected to local Ollama with {len(models)} model(s) available." if models else "Ollama is running, but no models are downloaded yet."
                }
            else:
                return {
                    "online": False,
                    "endpoint": OLLAMA_HOST,
                    "latency_ms": latency_ms,
                    "models": [],
                    "model_count": 0,
                    "message": f"Ollama returned HTTP {resp.status_code}"
                }
    except Exception as e:
        return {
            "online": False,
            "endpoint": OLLAMA_HOST,
            "latency_ms": None,
            "models": [],
            "model_count": 0,
            "message": f"Cannot connect to Ollama at {OLLAMA_HOST}. Is Ollama running?"
        }

@app.post("/api/ollama/pull")
async def pull_model_endpoint(req: ModelPullRequest):
    """Streams live model pull progress from Ollama."""
    async def pull_generator():
        try:
            async with httpx.AsyncClient(timeout=900.0) as client:
                async with client.stream(
                    "POST",
                    f"{OLLAMA_HOST}/api/pull",
                    json={"name": req.model, "stream": True}
                ) as resp:
                    if resp.status_code == 200:
                        async for line in resp.aiter_lines():
                            if line.strip():
                                yield f"data: {line}\n\n"
                    else:
                        yield f"data: {json.dumps({'error': f'Failed with status {resp.status_code}'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        pull_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )

@app.get("/api/sessions")
def list_sessions():
    return history_mgr.get_all_sessions()

@app.post("/api/sessions")
def create_session(data: SessionCreate):
    return history_mgr.create_session(data.title or "New Conversation")

@app.get("/api/sessions/{session_id}")
def get_session(session_id: str):
    session = history_mgr.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str):
    success = history_mgr.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted", "session_id": session_id}

@app.delete("/api/history")
def clear_history():
    return history_mgr.clear_all_history()

@app.get("/api/settings")
def get_settings():
    return history_mgr.get_settings()

@app.post("/api/settings")
def update_settings(data: SettingsUpdate):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    return history_mgr.update_settings(updates)

@app.get("/api/export/{session_id}")
def export_session(session_id: str, format: str = "markdown"):
    session = history_mgr.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if format == "json":
        return JSONResponse(
            content=session,
            headers={"Content-Disposition": f'attachment; filename="aura_session_{session_id}.json"'}
        )

    # Markdown export
    lines = [
        f"# {session.get('title', 'Aura Conversation')}",
        f"**Date**: {session.get('created_at', '')}",
        f"**Session ID**: `{session_id}`",
        "",
        "---",
        ""
    ]
    for msg in session.get("messages", []):
        role_label = "👤 **User**" if msg.get("role") == "user" else "✨ **Aura**"
        lines.append(f"### {role_label}  *({msg.get('timestamp', '')})*")
        lines.append("")
        lines.append(msg.get("content", ""))
        lines.append("")
        lines.append("---")
        lines.append("")

    content = "\n".join(lines)
    return JSONResponse(
        content={"markdown": content, "filename": f"aura_session_{session_id}.md"}
    )

async def generate_simulated_stream(user_message: str):
    """Fallback companion generator when Ollama is offline or in simulation mode."""
    intro = "✨ **Note:** *I am currently running in Offline Standby Simulation Mode because your local Ollama instance isn't detected at `http://localhost:11434`.* \n\n"
    
    # Context-aware simulated empathetic companion response
    msg_lower = user_message.lower()
    if any(k in msg_lower for k in ["hello", "hi", "hey", "who are you"]):
        body = (
            "Hello there! I'm **Aura**, your private and empathetic offline AI companion. "
            "I'm designed to guide you step-by-step through complex tasks, brainstorm ideas, "
            "and solve technical challenges without transmitting a single byte of your data to the cloud.\n\n"
            "To connect me to a full local neural model:\n"
            "1. Install [Ollama](https://ollama.com)\n"
            "2. Open a terminal and run `ollama run llama3` (or `mistral`, `phi3`)\n"
            "3. Refresh or select your model from the left panel!\n\n"
            "What would you like to explore or work on today?"
        )
    elif any(k in msg_lower for k in ["code", "python", "javascript", "function", "debug"]):
        body = (
            "I'd love to help you build or debug your code! Let's break this down step-by-step.\n\n"
            "Here is a quick clean template for local offline async processing in Python:\n\n"
            "```python\n"
            "# Offline task processor\n"
            "import asyncio\n\n"
            "async def process_task(task_name: str, steps: list[str]):\n"
            "    print(f'Starting task: {task_name}')\n"
            "    for i, step in enumerate(steps, 1):\n"
            "        await asyncio.sleep(0.3)\n"
            "        print(f' [Step {i}/{len(steps)}] {step} completed.')\n"
            "    return {'status': 'success', 'task': task_name}\n\n"
            "# Run the event loop\n"
            "asyncio.run(process_task('Data Cleanse', ['Load CSV', 'Normalize', 'Index']))\n"
            "```\n\n"
            "Feel free to paste your specific code snippet, and I'll review it line-by-line with you!"
        )
    else:
        body = (
            f"Thank you for sharing that with me! You asked: *\"{user_message}\"*\n\n"
            "Here is how I approach this step-by-step:\n\n"
            "1. **Clarify the Core Concept**: Breaking the problem down into its fundamental building blocks ensures we don't miss subtle nuances.\n"
            "2. **Evaluate Solutions**: We compare practical, lightweight approaches that can be tested locally.\n"
            "3. **Iterative Next Step**: Let's test the easiest part first to build momentum!\n\n"
            "Once you have Ollama running with your favorite model (`llama3`, `mistral`, or `deepseek-r1`), "
            "I will generate deep, unbounded local intelligence for every question. How would you like to proceed?"
        )

    full_text = intro + body
    # Stream in word chunks
    words = full_text.split(" ")
    for i, word in enumerate(words):
        chunk = word + (" " if i < len(words) - 1 else "")
        yield f"data: {json.dumps({'token': chunk, 'done': False})}\n\n"
        await asyncio.sleep(0.025)

    yield f"data: {json.dumps({'done': True, 'full_response': full_text})}\n\n"

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """Streams response from local Ollama or simulated companion."""
    settings = history_mgr.get_settings()
    model = request.model or settings.get("model", "llama3")
    temperature = request.temperature if request.temperature is not None else settings.get("temperature", 0.7)
    system_prompt = request.system_prompt or settings.get("system_prompt", DEFAULT_SYSTEM_PROMPT)
    session_id = request.session_id or "default-session"

    # Persist user message
    history_mgr.add_message(session_id, "user", request.message)

    # Fetch recent conversation context for multi-turn coherence
    session = history_mgr.get_session(session_id)
    raw_messages = session.get("messages", []) if session else []
    
    # Format messages for Ollama /api/chat
    chat_context = [{"role": "system", "content": system_prompt}]
    for msg in raw_messages[-10:]:  # Keep last 10 messages for context
        chat_context.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", "")
        })

    async def event_generator():
        accumulated_response = []
        is_ollama_reachable = False
        available_models = []

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                # Test ping & fetch available models
                try:
                    ping = await client.get(f"{OLLAMA_HOST}/api/tags", timeout=2.0)
                    if ping.status_code == 200:
                        is_ollama_reachable = True
                        data = ping.json()
                        available_models = [m.get("name") for m in data.get("models", [])]
                except Exception:
                    is_ollama_reachable = False

                # Resolve target model against installed models
                target_model = model
                if is_ollama_reachable and available_models:
                    # Match exact or prefix
                    matched = next((m for m in available_models if target_model in m or m.startswith(target_model.split(':')[0])), None)
                    target_model = matched or available_models[0]

                if is_ollama_reachable and available_models:
                    # Stream from Ollama /api/chat or /api/generate
                    ollama_payload = {
                        "model": target_model,
                        "messages": chat_context,
                        "options": {
                            "temperature": temperature,
                            "top_p": settings.get("top_p", 0.9)
                        },
                        "stream": True
                    }

                    streamed_successfully = False
                    # 1. Try /api/chat
                    try:
                        async with client.stream(
                            "POST",
                            f"{OLLAMA_HOST}/api/chat",
                            json=ollama_payload,
                            timeout=180.0
                        ) as resp:
                            if resp.status_code == 200:
                                async for line in resp.aiter_lines():
                                    if line.strip():
                                        try:
                                            chunk_data = json.loads(line)
                                            msg_chunk = chunk_data.get("message", {}).get("content", "")
                                            done = chunk_data.get("done", False)

                                            if msg_chunk:
                                                streamed_successfully = True
                                                accumulated_response.append(msg_chunk)
                                                yield f"data: {json.dumps({'token': msg_chunk, 'done': False})}\n\n"

                                            if done:
                                                full_content = "".join(accumulated_response)
                                                history_mgr.add_message(session_id, "assistant", full_content)
                                                yield f"data: {json.dumps({'done': True, 'full_response': full_content})}\n\n"
                                                return
                                        except Exception:
                                            continue
                    except Exception as err:
                        print("Error on /api/chat, falling back to /api/generate:", err)

                    # 2. Fallback to /api/generate if /api/chat not supported or empty
                    if not streamed_successfully:
                        # Build prompt for /api/generate
                        prompt_lines = [f"System: {system_prompt}\n"]
                        for msg in raw_messages[-10:]:
                            r = "User" if msg.get("role") == "user" else "Assistant"
                            prompt_lines.append(f"{r}: {msg.get('content', '')}")
                        prompt_lines.append(f"User: {request.message}\nAssistant:")
                        full_prompt = "\n".join(prompt_lines)

                        generate_payload = {
                            "model": model,
                            "prompt": full_prompt,
                            "options": {
                                "temperature": temperature,
                                "top_p": settings.get("top_p", 0.9)
                            },
                            "stream": True
                        }

                        try:
                            async with client.stream(
                                "POST",
                                f"{OLLAMA_HOST}/api/generate",
                                json=generate_payload,
                                timeout=180.0
                            ) as resp:
                                if resp.status_code == 200:
                                    async for line in resp.aiter_lines():
                                        if line.strip():
                                            try:
                                                chunk_data = json.loads(line)
                                                msg_chunk = chunk_data.get("response", "")
                                                done = chunk_data.get("done", False)

                                                if msg_chunk:
                                                    streamed_successfully = True
                                                    accumulated_response.append(msg_chunk)
                                                    yield f"data: {json.dumps({'token': msg_chunk, 'done': False})}\n\n"

                                                if done:
                                                    full_content = "".join(accumulated_response)
                                                    history_mgr.add_message(session_id, "assistant", full_content)
                                                    yield f"data: {json.dumps({'done': True, 'full_response': full_content})}\n\n"
                                                    return
                                            except Exception:
                                                continue
                        except Exception as e:
                            print("Error on /api/generate:", e)
                
                # If Ollama is not reachable, stream fallback simulation
                if not is_ollama_reachable or not accumulated_response:
                    async for chunk in generate_simulated_stream(request.message):
                        # extract token
                        if "token" in chunk:
                            try:
                                raw_json = json.loads(chunk.replace("data: ", "").strip())
                                if raw_json.get("token"):
                                    accumulated_response.append(raw_json["token"])
                            except Exception:
                                pass
                        yield chunk
                    full_content = "".join(accumulated_response)
                    history_mgr.add_message(session_id, "assistant", full_content)

        except Exception as e:
            err_msg = f"\n\n*(Aura internal notice: {str(e)})*"
            accumulated_response.append(err_msg)
            full_content = "".join(accumulated_response)
            history_mgr.add_message(session_id, "assistant", full_content)
            yield f"data: {json.dumps({'token': err_msg, 'done': True, 'full_response': full_content})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

# Mount Frontend static files
frontend_dir = BASE_DIR / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
