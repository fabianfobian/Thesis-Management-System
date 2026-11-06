import os
import random
import time
import requests

class PlagiarismService:
    @staticmethod
    def check_text(text: str) -> dict:
        api_key = os.getenv("PLAGIARISM_API_KEY")
        
        # MOCK MODE
        if not api_key or api_key == "your_key_here" or api_key == "":
            time.sleep(2) # Simulate network delay so you can see the loading state
            mock_score = round(random.uniform(2.0, 25.0), 1)
            return {
                "score": mock_score,
                "status": "checked",
                "report": {
                    "summary": f"Mock Report: We found {mock_score}% similarity with public sources.",
                    "flagged": [
                        {
                            "kind": "copy",
                            "excerpt": text[:100] + "..." if len(text) > 100 else text,
                            "reason": "This exact phrase was found in a 2019 journal article."
                        }
                    ]
                }
            }

        # REAL MODE
        url = "https://api.winston.ai/v1/plagiarism" 
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {"text": text, "language": "en"}
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            data = response.json()
            return {
                "score": data.get("score", 0.0),
                "report": data,
                "status": "checked"
            }
        except Exception as e:
            return {
                "score": None,
                "report": {"error": str(e)},
                "status": "failed"
            }