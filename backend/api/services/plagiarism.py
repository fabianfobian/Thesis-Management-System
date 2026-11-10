import os
import random
import time
import requests

class PlagiarismService:
    @staticmethod
    def check_text(text: str) -> dict:
        # If the text is empty, don't even try
        if not text or len(text.strip()) < 10:
            return {
                "score": 0.0,
                "status": "checked",
                "report": {"summary": "Document is too short to analyze."}
            }

        api_key = os.getenv("PLAGIARISM_API_KEY")
        
        # MOCK MODE: If no API key is found, return fake data
        if not api_key or api_key == "your_key_here" or api_key == "":
            print("MOCK PLAGIARISM CHECK RUNNING...")
            time.sleep(2) 
            mock_score = round(random.uniform(2.0, 25.0), 1)
            return {
                "score": mock_score,
                "status": "checked",
                "report": {
                    "summary": f"Mock Report: We found {mock_score}% similarity with public sources.",
                    "flagged": []
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
            print(f"Plagiarism API Error: {e}")
            return {
                "score": None,
                "report": {"error": str(e)},
                "status": "failed"
            }