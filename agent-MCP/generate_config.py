import os
import json

# 현재 폴더의 절대 경로
current_dir = os.path.dirname(os.path.abspath(__file__))
unix_path = current_dir.replace("\\", "/")

# Claude Desktop 설정 생성
config = {
    "mcpServers": {
        "personal-notes": {
            "command": "uv",
            "args": [
                "--directory",
                unix_path,
                "run",
                "--locked",
                "python",
                "main.py"
            ]
        }
    }
}

print("=" * 60)
print("Claude Desktop 설정 (claude_desktop_config.json)")
print("=" * 60)
print(json.dumps(config, indent=2))
print("\n설정 파일 위치:")
print("Windows: %APPDATA%\\Claude\\claude_desktop_config.json")
