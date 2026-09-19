import json
import uuid
import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from backend.config import HISTORY_FILE, SETTINGS_FILE, DEFAULT_SETTINGS

class HistoryManager:
    def __init__(self):
        self._ensure_files()

    def _ensure_files(self):
        if not HISTORY_FILE.exists():
            default_history = {
                "active_session_id": "default-session",
                "sessions": {
                    "default-session": {
                        "id": "default-session",
                        "title": "Welcome to Aura",
                        "created_at": datetime.datetime.now().isoformat(),
                        "updated_at": datetime.datetime.now().isoformat(),
                        "messages": [
                            {
                                "id": "msg-welcome",
                                "role": "assistant",
                                "content": "Hello! I'm **Aura**, your private, offline AI companion. I'm running directly on your machine with zero cloud connectivity, so your conversations remain 100% confidential. How can I help you today?",
                                "timestamp": datetime.datetime.now().isoformat()
                            }
                        ]
                    }
                }
            }
            self._save_json(HISTORY_FILE, default_history)

        if not SETTINGS_FILE.exists():
            self._save_json(SETTINGS_FILE, DEFAULT_SETTINGS)

    def _load_json(self, path: Path) -> Dict[str, Any]:
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _save_json(self, path: Path, data: Any):
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def get_all_sessions(self) -> List[Dict[str, Any]]:
        data = self._load_json(HISTORY_FILE)
        sessions = list(data.get("sessions", {}).values())
        sessions.sort(key=lambda s: s.get("updated_at", ""), reverse=True)
        return sessions

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        data = self._load_json(HISTORY_FILE)
        return data.get("sessions", {}).get(session_id)

    def create_session(self, title: str = "New Conversation") -> Dict[str, Any]:
        data = self._load_json(HISTORY_FILE)
        session_id = str(uuid.uuid4())
        now = datetime.datetime.now().isoformat()
        new_session = {
            "id": session_id,
            "title": title,
            "created_at": now,
            "updated_at": now,
            "messages": []
        }
        if "sessions" not in data:
            data["sessions"] = {}
        data["sessions"][session_id] = new_session
        data["active_session_id"] = session_id
        self._save_json(HISTORY_FILE, data)
        return new_session

    def add_message(self, session_id: str, role: str, content: str) -> Dict[str, Any]:
        data = self._load_json(HISTORY_FILE)
        if "sessions" not in data or session_id not in data["sessions"]:
            now = datetime.datetime.now().isoformat()
            data.setdefault("sessions", {})[session_id] = {
                "id": session_id,
                "title": content[:30] + "..." if len(content) > 30 else content,
                "created_at": now,
                "updated_at": now,
                "messages": []
            }

        session = data["sessions"][session_id]
        msg_id = str(uuid.uuid4())
        now = datetime.datetime.now().isoformat()
        msg = {
            "id": msg_id,
            "role": role,
            "content": content,
            "timestamp": now
        }
        session["messages"].append(msg)
        session["updated_at"] = now

        # Update title automatically if it's the first user message
        if role == "user" and (session.get("title") == "New Conversation" or session.get("title") == "Welcome to Aura"):
            cleaned = content.strip().replace("\n", " ")
            session["title"] = cleaned[:35] + ("..." if len(cleaned) > 35 else "")

        self._save_json(HISTORY_FILE, data)
        return msg

    def delete_session(self, session_id: str) -> bool:
        data = self._load_json(HISTORY_FILE)
        if "sessions" in data and session_id in data["sessions"]:
            del data["sessions"][session_id]
            if data.get("active_session_id") == session_id:
                remaining = list(data["sessions"].keys())
                data["active_session_id"] = remaining[0] if remaining else None
            self._save_json(HISTORY_FILE, data)
            return True
        return False

    def clear_all_history(self):
        data = {
            "active_session_id": "default-session",
            "sessions": {
                "default-session": {
                    "id": "default-session",
                    "title": "Fresh Conversation",
                    "created_at": datetime.datetime.now().isoformat(),
                    "updated_at": datetime.datetime.now().isoformat(),
                    "messages": []
                }
            }
        }
        self._save_json(HISTORY_FILE, data)
        return data

    def get_settings(self) -> Dict[str, Any]:
        saved = self._load_json(SETTINGS_FILE)
        merged = {**DEFAULT_SETTINGS, **saved}
        return merged

    def update_settings(self, new_settings: Dict[str, Any]) -> Dict[str, Any]:
        current = self.get_settings()
        current.update(new_settings)
        self._save_json(SETTINGS_FILE, current)
        return current

history_mgr = HistoryManager()
